#!/usr/bin/env node
/**
 * オープンワークリクルーティング 自動スカウトスクリプト
 *
 * フロー:
 *   1. https://recruiting.vorkers.com/login にログイン
 *   2. 「スカウト」を選択
 *   3. 「保存した検索条件」を選択
 *   4. 検索条件 (SEARCH_CONDITION_NAME) を選択
 *   5. 候補者ごとに: 名前をクリック → 「スカウトを送る」→ テンプレート選択 → 送付
 *   6. 100件を超える場合は「次へ」でページ送り
 *
 * 環境変数:
 *   OPENWORK_EMAIL / OPENWORK_PASSWORD ... ログイン情報 (必須)
 *   SEARCH_CONDITION_NAME ... 保存した検索条件名 (省略時は既定値)
 *   TEMPLATE_NAME         ... スカウトテンプレート名 (省略時は既定値)
 *   DRY_RUN=1             ... 最後の送付ボタンを押さずに動作確認する
 *   MAX_SCOUTS            ... 1回の実行で送る上限 (既定 300)
 *   HEADFUL=1             ... ブラウザを表示して実行 (デバッグ用)
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
  loginUrl: 'https://recruiting.vorkers.com/login',
  email: process.env.OPENWORK_EMAIL,
  password: process.env.OPENWORK_PASSWORD,
  searchConditionName:
    process.env.SEARCH_CONDITION_NAME || '旭化成ホームズ【東京／神奈川】集合住宅営業',
  templateName:
    process.env.TEMPLATE_NAME || '旭化成ホームズ【東京】集合住宅営業（未経験）',
  dryRun: process.env.DRY_RUN === '1',
  maxScouts: parseInt(process.env.MAX_SCOUTS || '300', 10),
  headful: process.env.HEADFUL === '1',
  stepTimeout: 20_000,
};

// 画面要素のセレクタ / テキスト。サイトのUI変更時はここを直す。
// テキストは正規表現で部分一致させ、多少の表記ゆれに耐えるようにしている。
const UI = {
  loginEmail: [
    'input[type="email"]',
    'input[name*="mail" i]',
    'input[name*="login" i]',
    'input[id*="mail" i]',
    'form input[type="text"]',
  ],
  loginPassword: ['input[type="password"]'],
  loginSubmit: /ログイン/,
  navScout: /^スカウト$|スカウト\s*$/,
  savedSearch: /保存した検索条件/,
  sendScoutButton: /スカウトを送る/,
  alreadyScouted: /スカウト済み|送信済み/,
  templatePicker: /テンプレートから選択できます|テンプレートから選択/,
  finalSendButton: /スカウトの送付|スカウトを送付|送付する|送信する/,
  confirmButton: /^(OK|はい|送信|送付)$/,
  nextPage: /^次へ|次のページ|next/i,
};

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

const RUN_ID = new Date()
  .toISOString()
  .replace(/[:T]/g, '-')
  .slice(0, 19);
const LOG_DIR = path.join(__dirname, 'logs', `run-${RUN_ID}`);
const LEDGER_PATH = path.join(__dirname, 'sent-candidates.json');

fs.mkdirSync(LOG_DIR, { recursive: true });

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function snap(page, name) {
  try {
    await page.screenshot({
      path: path.join(LOG_DIR, `${name}.png`),
      fullPage: false,
    });
  } catch {
    /* スクリーンショット失敗は無視 */
  }
}

async function dumpFailure(page, name, err) {
  log(`ERROR at ${name}: ${err.message}`);
  await snap(page, `FAIL-${name}`);
  try {
    fs.writeFileSync(
      path.join(LOG_DIR, `FAIL-${name}.html`),
      await page.content()
    );
  } catch {
    /* ignore */
  }
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

/**
 * テキスト(正規表現)にマッチする可視のクリック可能要素を探してクリックする。
 * link → button → その他クリック可能要素 の順で試す。
 */
async function clickByText(page, regex, { timeout = CONFIG.stepTimeout } = {}) {
  const candidates = [
    page.getByRole('link', { name: regex }).first(),
    page.getByRole('button', { name: regex }).first(),
    page.getByText(regex).first(),
    page.locator(`input[type="submit"]`).filter({ hasText: regex }).first(),
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

async function fillFirstMatch(page, selectors, value) {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    try {
      if (await loc.isVisible({ timeout: 1000 })) {
        await loc.fill(value);
        return sel;
      }
    } catch {
      /* 次のセレクタへ */
    }
  }
  throw new Error(`no visible input for selectors: ${selectors.join(', ')}`);
}

// ---------------------------------------------------------------------------
// 各ステップ
// ---------------------------------------------------------------------------

async function login(page) {
  log(`ログインページへ移動: ${CONFIG.loginUrl}`);
  await page.goto(CONFIG.loginUrl, { waitUntil: 'domcontentloaded' });
  await snap(page, '01-login-page');

  await fillFirstMatch(page, UI.loginEmail, CONFIG.email);
  await fillFirstMatch(page, UI.loginPassword, CONFIG.password);
  await snap(page, '02-login-filled');

  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    clickByText(page, UI.loginSubmit),
  ]);
  await page.waitForTimeout(2000);
  await snap(page, '03-after-login');

  if (page.url().includes('/login')) {
    throw new Error(
      `ログインに失敗した可能性があります (URLが /login のまま): ${page.url()}`
    );
  }
  log(`ログイン成功: ${page.url()}`);
}

async function openSavedSearch(page) {
  log('「スカウト」メニューを開く');
  await clickByText(page, UI.navScout);
  await page.waitForTimeout(1500);
  await snap(page, '04-scout-menu');

  log('「保存した検索条件」を開く');
  await clickByText(page, UI.savedSearch);
  await page.waitForTimeout(1500);
  await snap(page, '05-saved-searches');

  log(`検索条件「${CONFIG.searchConditionName}」を選択`);
  await clickByText(page, new RegExp(escapeRegex(CONFIG.searchConditionName)));
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);
  await snap(page, '06-candidate-list');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 候補者一覧ページから候補者詳細へのリンクを収集する。
 * href に候補者IDらしきパスを含む a 要素を候補として拾う汎用ヒューリスティック。
 */
async function collectCandidateLinks(page) {
  const links = await page.evaluate(() => {
    const seen = new Set();
    const out = [];
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.href;
      // 候補者詳細ページらしきURLパターン (ID を含むパス)
      if (
        /(candidate|resume|jobseeker|member|user|profile|scout\/detail)/i.test(
          href
        ) &&
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
  return links;
}

/**
 * 候補者詳細ページでスカウトを送る。戻り値: 'sent' | 'skipped' | 'dry-run'
 */
async function sendScoutOnDetailPage(page, candidateLabel) {
  // すでにスカウト済みならスキップ
  const already = page.getByText(UI.alreadyScouted).first();
  try {
    if (await already.isVisible({ timeout: 1500 })) {
      log(`  スカウト済みのためスキップ: ${candidateLabel}`);
      return 'skipped';
    }
  } catch {
    /* 表示なし = 未送信 */
  }

  log('  「スカウトを送る」をクリック');
  await clickByText(page, UI.sendScoutButton);
  await page.waitForTimeout(1500);
  await snap(page, `scout-form-${sanitize(candidateLabel)}`);

  log('  テンプレート選択を開く');
  await clickByText(page, UI.templatePicker);
  await page.waitForTimeout(1000);

  log(`  テンプレート「${CONFIG.templateName}」を選択`);
  await clickByText(page, new RegExp(escapeRegex(CONFIG.templateName)));
  await page.waitForTimeout(1500);
  await snap(page, `template-selected-${sanitize(candidateLabel)}`);

  if (CONFIG.dryRun) {
    log('  DRY_RUN のため送付せず終了');
    return 'dry-run';
  }

  log('  スカウトを送付');
  await clickByText(page, UI.finalSendButton);
  await page.waitForTimeout(1500);

  // 確認ダイアログが出る場合に対応
  try {
    await clickByText(page, UI.confirmButton, { timeout: 3000 });
    await page.waitForTimeout(1500);
  } catch {
    /* 確認ダイアログなし */
  }

  await snap(page, `sent-${sanitize(candidateLabel)}`);
  return 'sent';
}

function sanitize(s) {
  return s.replace(/[^\w぀-ヿ一-龯-]/g, '_').slice(0, 40);
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

async function main() {
  if (!CONFIG.email || !CONFIG.password) {
    console.error(
      'OPENWORK_EMAIL / OPENWORK_PASSWORD 環境変数を設定してください。'
    );
    process.exit(1);
  }

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

  const browser = await chromium.launch({ headless: !CONFIG.headful });
  const context = await browser.newContext({
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(CONFIG.stepTimeout);

  try {
    await login(page);
    await openSavedSearch(page);

    let pageNum = 1;
    let totalSent = 0;

    while (totalSent < CONFIG.maxScouts) {
      log(`--- 候補者一覧 ${pageNum} ページ目を処理 ---`);
      const listUrl = page.url();
      const links = await collectCandidateLinks(page);
      log(`候補者リンク検出: ${links.length} 件`);

      if (links.length === 0) {
        await dumpFailure(
          page,
          `no-candidates-page${pageNum}`,
          new Error('候補者リンクが見つかりませんでした。UIセレクタの調整が必要かもしれません。')
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
          await page.waitForTimeout(1500);

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

      // 一覧へ戻り、次のページへ (100件超は「次へ」が必要)
      await page.goto(listUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      try {
        await clickByText(page, UI.nextPage, { timeout: 5000 });
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2500);
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
