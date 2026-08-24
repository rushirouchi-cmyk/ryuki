import { getDb } from "@/lib/db";
import { eq } from "drizzle-orm";
import { occupations, salaryMarketBenchmarks, regions } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/guards";
import {
  getAgentMatchingConfig,
  getAreaScoreConfig,
  getDiagnosisConfig,
  getQualificationConfig,
} from "@/lib/config/store";
import { SETTING_KEYS } from "@/lib/config/settings";
import { CardTitle, NumTd, PageHeader, TableWrap, Td, Th } from "@/components/ui";
import { formatManRange } from "@/lib/utils/format";
import { SettingEditor } from "./editor";

export default async function DiagnosisSettingsPage() {
  await requireRole("admin");
  const db = await getDb();

  const [diagnosis, areaScore, matching, qualification] = await Promise.all([
    getDiagnosisConfig(db),
    getAreaScoreConfig(db),
    getAgentMatchingConfig(db),
    getQualificationConfig(db),
  ]);

  const benchmarks = await db
    .select({
      id: salaryMarketBenchmarks.id,
      occupationName: occupations.name,
      regionName: regions.name,
      experienceBand: salaryMarketBenchmarks.experienceBand,
      salaryLow: salaryMarketBenchmarks.salaryLow,
      salaryMedian: salaryMarketBenchmarks.salaryMedian,
      salaryHigh: salaryMarketBenchmarks.salaryHigh,
      source: salaryMarketBenchmarks.source,
      sourceDate: salaryMarketBenchmarks.sourceDate,
      confidenceLevel: salaryMarketBenchmarks.confidenceLevel,
      sampleSize: salaryMarketBenchmarks.sampleSize,
    })
    .from(salaryMarketBenchmarks)
    .innerJoin(occupations, eq(salaryMarketBenchmarks.occupationId, occupations.id))
    .leftJoin(regions, eq(salaryMarketBenchmarks.regionId, regions.id))
    .where(eq(salaryMarketBenchmarks.active, true))
    .orderBy(occupations.name, salaryMarketBenchmarks.experienceBand)
    .limit(60);

  return (
    <>
      <PageHeader
        title="診断設定"
        description="重み・しきい値・丸め単位はすべてここから変更でき、コードには埋め込まれていません。"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SettingEditor
          settingKey={SETTING_KEYS.diagnosis}
          title="年収診断エンジン"
          description="Skill / Certification / Experience / Location / Working Condition / Profile の重みは合計100にしてください。ランクのしきい値と表示の丸め単位（円）もここで調整します。"
          value={diagnosis}
        />
        <SettingEditor
          settingKey={SETTING_KEYS.qualification}
          title="有効候補者（Qualified）の判定条件"
          description="送客に値する候補者と判断する条件です。"
          value={qualification}
        />
        <SettingEditor
          settingKey={SETTING_KEYS.areaScore}
          title="エリアスコア"
          description="各指標の重みと、スコアを信頼してよい最小サンプル条件です。"
          value={areaScore}
        />
        <SettingEditor
          settingKey={SETTING_KEYS.agentMatching}
          title="エージェント推薦"
          description="候補者に提示するエージェントの並び順を決めるスコアの重みです。"
          value={matching}
        />
      </div>

      <section className="mt-8">
        <CardTitle>市場年収マスター（先頭60件）</CardTitle>
        <p className="mt-1 text-xs text-ink-500">
          出典と取得日、信頼度、サンプル数を保持しています。将来的に公的統計・求人データ・自社転職実績を
          同じ形式で取り込めます。
        </p>
        <div className="mt-2">
          <TableWrap>
            <thead>
              <tr>
                <Th>職種</Th>
                <Th>地域</Th>
                <Th>経験帯</Th>
                <Th className="text-right">年収レンジ</Th>
                <Th className="text-right">中央値</Th>
                <Th>出典</Th>
                <Th>取得日</Th>
                <Th>信頼度</Th>
                <Th className="text-right">n</Th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((row) => (
                <tr key={row.id}>
                  <Td className="font-medium">{row.occupationName}</Td>
                  <Td>{row.regionName ?? "全国"}</Td>
                  <Td>{row.experienceBand}</Td>
                  <NumTd>{formatManRange(row.salaryLow, row.salaryHigh)}</NumTd>
                  <NumTd>{formatManRange(row.salaryMedian, row.salaryMedian)}</NumTd>
                  <Td className="text-ink-500">{row.source}</Td>
                  <Td className="text-ink-500">{row.sourceDate}</Td>
                  <Td>{row.confidenceLevel}</Td>
                  <NumTd>{row.sampleSize ?? "—"}</NumTd>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </div>
      </section>
    </>
  );
}
