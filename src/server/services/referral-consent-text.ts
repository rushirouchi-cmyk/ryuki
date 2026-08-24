export const CONSENT_TEXT_VERSION = '1.0';

/** Exact wording stored on the consent record. Shared by the UI and the seed. */
export function consentText(agentName: string): string {
  return [
    '【第三者提供に関する同意】',
    `当社は、あなたの以下の個人情報を「${agentName}」へ提供します。`,
    '・氏名、メールアドレス、電話番号、年齢帯',
    '・現在の勤務地、希望勤務地、希望条件',
    '・年収診断結果（現在年収帯、想定年収レンジ、市場価値ランク、推奨職種）',
    '提供目的：転職支援サービスのご案内および求人紹介のため。',
    '同意はいつでも撤回できます（撤回以降の提供は停止されます）。',
  ].join('\n');
}
