#!/usr/bin/env node
/**
 * オープンワークリクルーティング 自動スカウトスクリプト
 *
 * フロー:
 *   1. https://recruiting.vorkers.com/login にログイン
 *   2. 保存した検索条件「旭化成ホームズ【東京／神奈川】集合住宅営業」(id=269013) の候補者一覧を開く
 *   3. 候補者ごとに: 詳細を開く → 「スカウトを送る」→ テンプレート
 *      「旭化成ホームズ【東京】集合住宅営業（未経験）」を選択 → 送付
 *   4. 100件を超える場合は「次へ」でページ送り
 *
 * == 実環境調査で確認済みの事実 (2026-07-16) ==
 *   - ログインフォーム: #email / #password / button#log_in (POST /rec_login_check → 302 /)
 *   - サイトのWAFはChromiumのTLSハンドシェイクをリセットするため、全HTTP通信は
 *     Playwright APIRequestContext (Nodeスタック・環境の許可プロキシ経由) で行い、
 *     ブラウザにはレンダリングのみさせる (context.route ですべて fulfill)。
 *   - 画面はVue SPA。アプリJSは assets.openwork.jp 配信のため、環境の許可ドメインに
 *     assets.openwork.jp が必要 (recruiting.vorkers.com だけでは画面が描画されない)。
 *   - 保存した検索条件API: GET /scout/search_conditions/api/get
 *     対象条件: id=269013「旭化成ホームズ【東京／神奈川】集合住宅営業」
 *   - 候補者一覧URL: /scout/candidates?scout_search_condition_favorite_id=<id>
 *   - スカウト送信などのAPI: /scout/api/send/scout, /scout/api/template ほか
 *     (ペイロード形式は未確認。誤送信リスクがあるため直接APIは叩かず、UI経由で送る)
 *
 * 環境変数:
 *   OPENWORK_EMAIL / OPENWORK_PASSWORD ... ログイン情報 (必須)
 *   SEARCH_CONDITION_NAME ... 保存した検索条件名 (省略時は既定値)
 *   TEMPLATE_NAME         ... スカウトテンプレート名 (省略時は既定値)
 *   DRY_RUN=1             ... 最後の送付ボタンを押さずに動作確認する
 *   MAX_SCOUTS            ... 1回の実行で送る上限 (既定 300)
 *
 * 出力:
 *   logs/run-<日時>/ ... 各ステップのスクリーンショットとエラー時のHTML
 *   logs/result-<日付>.json ... 送信結果サマリー
 *   sent-candidates.json ... 送信済み候補者の台帳 (重複送信防止用・git管理)
 */

const fs = require('fs');
const path = require('path');

// playwright はローカル node_modules がなければグローバルインストールを使う
function requirePlaywright() {
  try {
    return require('playwright');
  } catch {
    return require('/opt/node22/lib/node_modules/playwright');
  }
}
const { chromium } = requirePlaywright();

// ---------------------------------------------------------------------------
// 設定
// ---------------------------------------------------------------------------

const CONFIG = {
  baseUrl: 'https://recruiting.vorkers.com',
  loginUrl: 'https://recruiting.vorkers.com/login',
  email: process.env.OPENWORK_EMAIL,
  password: process.env.OPENWORK_PASSWORD,
  searchConditionName:
    process.env.SEARCH_CONDITION_NAME || '旭化成ホームズ【東京／神奈川】集合住宅営業',
  templateName:
    process.env.TEMPLATE_NAME || '旭化成ホームズ【東京】集合住宅営業（未経験）',
  dryRun: process.env.DRY_RUN === '1',
  maxScouts: parseInt(process.env.MAX_SCOUTS || '300', 10),
  stepTimeout: 25_000,
};

// 画面要素のテキスト。サイトのUI変更時はここを直す。
const UI = {
  sendScoutButton: /スカウトを送る/,
  alreadyScouted: /スカウト済み|送信済み/,
  templatePicker: /テンプレートから選択できます|テンプレートから選択/,
  finalSendButton: /スカウトの送付|スカウトを送付|送付する|送信する/,
  confirmButton: /^(OK|はい|送信|送付)$/,
  nextPage: /^次へ|次のページ/,
};

// ---------------------------------------------------------------------------
// ログ・台帳
// ---------------------------------------------------------------------------

const RUN_ID = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const LOG_DIR = path.join(__dirname, 'logs', `run-${RUN_ID}`);
const LEDGER_PATH = path.join(__dirname, 'sent-candidates.json');

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function snap(page, name) {
  try {
    await page.screenshot({ path: path.join(LOG_DIR, `${name}.png`) });
  } catch {}
}

async function dumpFailure(page, name, err) {
  log(`ERROR at ${name}: ${err.message}`);
  await snap(page, `FAIL-${name}`);
  try {
    fs.writeFileSync(path.join(LOG_DIR, `FAIL-${name}.html`), await page.content());
  } catch {}
}

function loadLedger() {
  try {
    return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveLedger(ledger) {
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitize(s) {
  return String(s).replace(/[^\w぀-ヿ一-龯-]/g, '_').slice(0, 40);
}

// ---------------------------------------------------------------------------
// ブラウザ起動: 全リクエストをNodeスタック (許可プロキシ経由) で処理する
// サイトWAFがChromiumのTLSをリセットするための回避策。通信はすべて環境の
// egressプロキシ (HTTPS_PROXY) を通り、ネットワークポリシーに従う。
// ---------------------------------------------------------------------------

async function launchBrowser() {
  const browser = await chromium.launch({
    proxy: { server: process.env.HTTPS_PROXY },
  });
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    viewport: { width: 1440, height: 900 },
  });

  await ctx.route('**/*', async (route) => {
    const req = route.request();
    const isNav = req.isNavigationRequest();
    try {
      const resp = await ctx.request.fetch(req, {
        maxRedirects: isNav ? 0 : 20,
        timeout: 30000,
      });
      const status = resp.status();
      const headers = { ...resp.headers() };
      const loc = headers['location'];
      if (isNav && status >= 300 && status < 400 && loc) {
        // ナビゲーションの30xはfulfillできないためJSで遷移させる
        const target = new URL(loc, req.url()).href;
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: `<script>location.replace(${JSON.stringify(target)})</script>`,
        });
        return;
      }
      delete headers['content-encoding'];
      delete headers['content-length'];
      delete headers['transfer-encoding'];
      await route.fulfill({ status, headers, body: await resp.body() });
    } catch (e) {
      await route.abort('failed').catch(() => {});
    }
  });

  const page = await ctx.newPage();
  page.setDefaultTimeout(CONFIG.stepTimeout);
  return { browser, ctx, page };
}

// ---------------------------------------------------------------------------
// 各ステップ
// ---------------------------------------------------------------------------

async function login(page) {
  log(`ログイン: ${CONFIG.loginUrl}`);
  await page.goto(CONFIG.loginUrl, { waitUntil: 'domcontentloaded' });
  await snap(page, '01-login-page');
  await page.fill('#email', CONFIG.email);
  await page.fill('#password', CONFIG.password);
  await page.click('#log_in');
  await page.waitForTimeout(5000);
  await snap(page, '02-after-login');
  const url = page.url();
  if (url.includes('/login') || url.startsWith('chrome-error')) {
    throw new Error(`ログイン失敗 (URL: ${url})`);
  }
  log(`ログイン成功: ${url}`);
}

/** 保存した検索条件APIから対象条件のIDを取得する */
async function findSearchConditionId(ctx) {
  const resp = await ctx.request.get(
    `${CONFIG.baseUrl}/scout/search_conditions/api/get`
  );
  if (!resp.ok()) {
    throw new Error(`検索条件APIが ${resp.status()} を返しました`);
  }
  const data = await resp.json();
  const items = data?.data?.scoutSearchConditionFavorites || [];
  const target = items.find((it) => it.name === CONFIG.searchConditionName);
  if (!target) {
    throw new Error(
      `検索条件「${CONFIG.searchConditionName}」が見つかりません。存在する条件: ` +
        items.map((it) => it.name).join(' / ')
    );
  }
  log(`検索条件 id=${target.id}「${target.name}」`);
  return target.id;
}

/** クリック可能要素をテキストで探してクリックする */
async function clickByText(page, regex, { timeout = CONFIG.stepTimeout } = {}) {
  const candidates = [
    page.getByRole('link', { name: regex }).first(),
    page.getByRole('button', { name: regex }).first(),
    page.getByText(regex).first(),
  ];
  const deadline = Date.now() + timeout;
  let lastErr = new Error(`clickable element not found for ${regex}`);
  while (Date.now() < deadline) {
    for (const loc of candidates) {
      try {
        if (await loc.isVisible({ timeout: 500 })) {
          await loc.click({ timeout: 3000 });
          return true;
        }
      } catch (e) {
        lastErr = e;
      }
    }
    await page.waitForTimeout(500);
  }
  throw lastErr;
}

/**
 * 候補者一覧ページから候補者詳細へのリンク/カードを収集する。
 * SPAが描画した一覧から候補者ごとの遷移先を拾う汎用ヒューリスティック。
 * 実画面確認後に必要ならセレクタを固定化する。
 */
async function collectCandidateLinks(page) {
  return page.evaluate(() => {
    const seen = new Set();
    const out = [];
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.href;
      if (
        /(candidate|resume|jobseeker|member|user_id|profile|scout\/detail)/i.test(href) &&
        /\d/.test(href) &&
        !seen.has(href) &&
        a.offsetParent !== null
      ) {
        seen.add(href);
        out.push({ href, text: (a.textContent || '').trim().slice(0, 60) });
      }
    }
    return out;
  });
}

/** 候補者詳細でスカウトを送る。戻り値: 'sent' | 'skipped' | 'dry-run' */
async function sendScoutOnDetailPage(page, candidateLabel) {
  const already = page.getByText(UI.alreadyScouted).first();
  try {
    if (await already.isVisible({ timeout: 1500 })) {
      log(`  スカウト済みのためスキップ: ${candidateLabel}`);
      return 'skipped';
    }
  } catch {}

  log('  「スカウトを送る」をクリック');
  await clickByText(page, UI.sendScoutButton);
  await page.waitForTimeout(2000);
  await snap(page, `scout-form-${sanitize(candidateLabel)}`);

  log('  テンプレート選択を開く');
  await clickByText(page, UI.templatePicker);
  await page.waitForTimeout(1500);

  log(`  テンプレート「${CONFIG.templateName}」を選択`);
  await clickByText(page, new RegExp(escapeRegex(CONFIG.templateName)));
  await page.waitForTimeout(2000);
  await snap(page, `template-selected-${sanitize(candidateLabel)}`);

  if (CONFIG.dryRun) {
    log('  DRY_RUN のため送付せず終了');
    return 'dry-run';
  }

  log('  スカウトを送付');
  await clickByText(page, UI.finalSendButton);
  await page.waitForTimeout(2000);
  try {
    await clickByText(page, UI.confirmButton, { timeout: 3000 });
    await page.waitForTimeout(2000);
  } catch {}

  await snap(page, `sent-${sanitize(candidateLabel)}`);
  return 'sent';
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

async function main() {
  if (!CONFIG.email || !CONFIG.password) {
    console.error('OPENWORK_EMAIL / OPENWORK_PASSWORD 環境変数を設定してください。');
    process.exit(1);
  }
  fs.mkdirSync(LOG_DIR, { recursive: true });

  const ledger = loadLedger();
  const result = {
    date: new Date().toISOString(),
    searchCondition: CONFIG.searchConditionName,
    template: CONFIG.templateName,
    dryRun: CONFIG.dryRun,
    sent: [],
    skipped: [],
    errors: [],
  };

  const { browser, ctx, page } = await launchBrowser();

  try {
    await login(page);
    const conditionId = await findSearchConditionId(ctx);

    const listUrlBase = `${CONFIG.baseUrl}/scout/candidates?scout_search_condition_favorite_id=${conditionId}`;
    await page.goto(listUrlBase, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000); // SPA描画待ち
    await snap(page, '03-candidate-list');

    // SPAが描画できているか確認 (assets.openwork.jp が許可されていないと空になる)
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (/画面の読み込みに問題/.test(bodyText)) {
      throw new Error(
        '画面のJavaScriptが読み込めていません。環境の許可ドメインに assets.openwork.jp を追加してください。'
      );
    }

    let pageNum = 1;
    let totalSent = 0;

    while (totalSent < CONFIG.maxScouts) {
      log(`--- 候補者一覧 ${pageNum} ページ目 ---`);
      const listUrl = page.url();
      const links = await collectCandidateLinks(page);
      log(`候補者リンク検出: ${links.length} 件`);

      if (links.length === 0) {
        await dumpFailure(
          page,
          `no-candidates-page${pageNum}`,
          new Error('候補者リンクが見つかりません。セレクタ調整が必要な可能性があります。')
        );
        break;
      }

      for (const link of links) {
        if (totalSent >= CONFIG.maxScouts) break;
        if (ledger[link.href]) {
          result.skipped.push({ ...link, reason: 'ledger' });
          continue;
        }

        log(`候補者を開く: ${link.text || link.href}`);
        try {
          await page.goto(link.href, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(3000);

          const status = await sendScoutOnDetailPage(page, link.text || 'unknown');
          if (status === 'sent' || status === 'dry-run') {
            totalSent++;
            result.sent.push({ ...link, status });
            if (status === 'sent') {
              ledger[link.href] = new Date().toISOString().slice(0, 10);
              saveLedger(ledger);
            }
          } else {
            result.skipped.push({ ...link, reason: status });
            ledger[link.href] = 'pre-existing';
            saveLedger(ledger);
          }
        } catch (err) {
          await dumpFailure(page, `candidate-${sanitize(link.text || 'x')}`, err);
          result.errors.push({ ...link, error: err.message });
        }
      }

      // 一覧へ戻り「次へ」(100件超のページ送り)
      await page.goto(listUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4000);
      try {
        await clickByText(page, UI.nextPage, { timeout: 5000 });
        await page.waitForTimeout(4000);
        pageNum++;
        await snap(page, `list-page-${pageNum}`);
      } catch {
        log('「次へ」が見つからないため最終ページと判断');
        break;
      }
    }
  } catch (err) {
    await dumpFailure(page, 'fatal', err);
    result.errors.push({ fatal: true, error: err.message });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }

  const resultPath = path.join(
    __dirname,
    'logs',
    `result-${new Date().toISOString().slice(0, 10)}.json`
  );
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n');
  log(
    `完了: 送信 ${result.sent.length} 件 / スキップ ${result.skipped.length} 件 / エラー ${result.errors.length} 件`
  );
  log(`結果ファイル: ${resultPath}`);
}

main();
