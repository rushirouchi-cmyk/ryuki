import type {
  ExternalAction,
  ExternalApplication,
  ExternalCandidate,
  ExternalCompany,
  ExternalJob,
} from '@/lib/adapters/datasource/types';

/**
 * デモ用データ (§43)。
 * MockDataSource と seed スクリプトの両方がこの 1 か所を参照する。
 * 実在企業と混同しないよう、企業名は実在しない架空名にしている。
 */

const DAY = 24 * 60 * 60 * 1000;
/** 基準日からの相対日数で日付を作る。seed 実行日を基準にするため毎回「今日」に追従する。 */
export const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();
export const daysAhead = (n: number) => new Date(Date.now() + n * DAY).toISOString();

export const DEMO_USERS = [
  { email: 'admin@infralink.example.co.jp', name: '管理者 太郎', role: 'admin' },
  { email: 'exec@infralink.example.co.jp', name: '経営 一郎', role: 'executive' },
  { email: 'sato@infralink.example.co.jp', name: '佐藤 花子', role: 'CA' },
  { email: 'tanaka@infralink.example.co.jp', name: '田中 健', role: 'CA' },
  { email: 'suzuki@infralink.example.co.jp', name: '鈴木 誠', role: 'CA' },
  { email: 'yoshida@infralink.example.co.jp', name: '吉田 直樹', role: 'RA' },
  { email: 'okada@infralink.example.co.jp', name: '岡田 彩', role: 'RA' },
];

export const DEMO_COMPANIES: ExternalCompany[] = [
  // --- 既存取引企業 ---
  { externalId: 'C001', companyName: '西日本重工業株式会社', transactionStatus: 'existing', industry: '重工業', location: '大阪府', website: 'https://nishinihon-jukogyo.example.co.jp', relationshipStatus: 'contracted', employeeCount: 4200 },
  { externalId: 'C002', companyName: 'サンライズ化学工業株式会社', transactionStatus: 'existing', industry: '化学メーカー', location: '兵庫県', website: 'https://sunrise-kagaku.example.co.jp', relationshipStatus: 'contracted', employeeCount: 1800 },
  { externalId: 'C003', companyName: '東邦建設株式会社', transactionStatus: 'existing', industry: '建設', location: '東京都', website: 'https://toho-kensetsu.example.co.jp', relationshipStatus: 'contracted', employeeCount: 3100 },
  { externalId: 'C004', companyName: '大和ファシリティサービス株式会社', transactionStatus: 'existing', industry: 'ファシリティマネジメント', location: '東京都', website: 'https://yamato-facility.example.co.jp', relationshipStatus: 'contracted', employeeCount: 950 },
  { externalId: 'C005', companyName: 'ミナト電機工業株式会社', transactionStatus: 'existing', industry: '電機メーカー', location: '大阪府', website: 'https://minato-denki.example.co.jp', relationshipStatus: 'contracted', employeeCount: 2400 },
  { externalId: 'C006', companyName: '中部プラントエンジニアリング株式会社', transactionStatus: 'existing', industry: 'プラントエンジニアリング', location: '愛知県', website: 'https://chubu-plant.example.co.jp', relationshipStatus: 'contracted', employeeCount: 1200 },
  { externalId: 'C007', companyName: '新東京データセンター株式会社', transactionStatus: 'existing', industry: 'データセンター', location: '東京都', website: 'https://shin-tokyo-dc.example.co.jp', relationshipStatus: 'contracted', employeeCount: 680 },
  { externalId: 'C008', companyName: '北陸エネルギー株式会社', transactionStatus: 'existing', industry: 'エネルギー', location: '石川県', website: 'https://hokuriku-energy.example.co.jp', relationshipStatus: 'contracted', employeeCount: 2900 },
  // --- 未取引 / 開拓対象 ---
  { externalId: 'C101', companyName: '関西プロセス工業株式会社', transactionStatus: 'unknown', industry: '化学メーカー', location: '大阪府', website: 'https://kansai-process.example.co.jp', relationshipStatus: 'none', employeeCount: 1500 },
  { externalId: 'C102', companyName: '日本設備テクノ株式会社', transactionStatus: 'unknown', industry: 'プラントエンジニアリング', location: '兵庫県', website: 'https://nihon-setsubi-techno.example.co.jp', relationshipStatus: 'none', employeeCount: 800 },
  { externalId: 'C103', companyName: '西日本エナジーサービス株式会社', transactionStatus: 'unknown', industry: 'エネルギー', location: '大阪府', website: 'https://nishinihon-energy.example.co.jp', relationshipStatus: 'none', employeeCount: 1100 },
  { externalId: 'C104', companyName: 'ミナミ精密機械株式会社', transactionStatus: 'prospect', industry: '機械メーカー', location: '大阪府', website: 'https://minami-seimitsu.example.co.jp', relationshipStatus: 'approached', employeeCount: 620 },
  { externalId: 'C105', companyName: '阪神データセンター株式会社', transactionStatus: 'unknown', industry: 'データセンター', location: '兵庫県', website: 'https://hanshin-dc.example.co.jp', relationshipStatus: 'none', employeeCount: 340 },
  { externalId: 'C106', companyName: '中央ファシリティ管理株式会社', transactionStatus: 'unknown', industry: 'ファシリティマネジメント', location: '東京都', website: 'https://chuo-facility.example.co.jp', relationshipStatus: 'none', employeeCount: 1750 },
];

export const DEMO_JOBS: ExternalJob[] = [
  { externalId: 'J001', companyExternalId: 'C001', jobTitle: '設備保全エンジニア（大阪工場）', jobCategory: '設備保全', location: '大阪府', salaryMin: 5000000, salaryMax: 7500000, requiredSkills: ['設備保全', 'PLC', '予防保全'], preferredSkills: ['シーケンス制御', '故障対応'], requiredExperience: '設備保全5年以上', qualifications: ['電験三種'], description: '大阪工場の生産設備の予防保全・故障対応・改善を担当。', status: 'open' },
  { externalId: 'J002', companyExternalId: 'C001', jobTitle: '生産技術エンジニア', jobCategory: '生産技術', location: '大阪府', salaryMin: 5500000, salaryMax: 8000000, requiredSkills: ['生産技術', '設備改善', '生産設備'], preferredSkills: ['ロボット', 'PLC'], requiredExperience: '製造業での生産技術経験3年以上', qualifications: [], description: '生産ラインの立ち上げ・改善を推進。', status: 'open' },
  { externalId: 'J003', companyExternalId: 'C002', jobTitle: 'プラント設備保全（姫路事業所）', jobCategory: '設備保全', location: '兵庫県', salaryMin: 5200000, salaryMax: 7800000, requiredSkills: ['設備保全', 'プラント', '予防保全'], preferredSkills: ['電気設備', '機械設備'], requiredExperience: 'プラント設備の保全経験', qualifications: ['電験三種', '危険物取扱者'], description: '化学プラントの回転機・電気設備の保全。', status: 'open' },
  { externalId: 'J004', companyExternalId: 'C002', jobTitle: 'プラントエンジニア（設備投資計画）', jobCategory: 'プラントエンジニア', location: '兵庫県', salaryMin: 6000000, salaryMax: 9000000, requiredSkills: ['プラント', '設備改善'], preferredSkills: ['施工管理'], requiredExperience: 'プラント設計または工事管理5年以上', qualifications: ['エネルギー管理士'], description: '設備投資計画の立案から工事管理まで。', status: 'open' },
  { externalId: 'J005', companyExternalId: 'C003', jobTitle: '電気設備施工管理（首都圏）', jobCategory: '施工管理', location: '東京都', salaryMin: 5500000, salaryMax: 8500000, requiredSkills: ['施工管理', '電気設備'], preferredSkills: ['CAD'], requiredExperience: '電気工事の施工管理3年以上', qualifications: ['電気工事施工管理技士'], description: 'オフィスビル・工場の電気設備工事の施工管理。', status: 'open' },
  { externalId: 'J006', companyExternalId: 'C003', jobTitle: '建築施工管理（再開発案件）', jobCategory: '施工管理', location: '東京都', salaryMin: 6000000, salaryMax: 9500000, requiredSkills: ['施工管理'], preferredSkills: ['建築設計'], requiredExperience: '建築施工管理5年以上', qualifications: ['建築施工管理技士'], description: '大規模再開発案件の施工管理。', status: 'open' },
  { externalId: 'J007', companyExternalId: 'C004', jobTitle: 'ファシリティマネジャー（オフィスビル）', jobCategory: 'ファシリティマネジメント', location: '東京都', salaryMin: 5000000, salaryMax: 7000000, requiredSkills: ['ファシリティ', '設備保全'], preferredSkills: ['電気設備', '機械設備'], requiredExperience: 'ビル設備管理3年以上', qualifications: ['第二種電気工事士'], description: '大規模オフィスビルの設備運用管理。', status: 'open' },
  { externalId: 'J008', companyExternalId: 'C004', jobTitle: '設備管理スタッフ（商業施設）', jobCategory: 'ファシリティマネジメント', location: '神奈川県', salaryMin: 4200000, salaryMax: 5800000, requiredSkills: ['設備保全', 'ファシリティ'], preferredSkills: [], requiredExperience: '設備管理経験', qualifications: ['第二種電気工事士'], description: '商業施設の日常点検・法定点検の管理。', status: 'open' },
  { externalId: 'J009', companyExternalId: 'C005', jobTitle: 'サービスエンジニア（産業機器）', jobCategory: 'サービスエンジニア', location: '大阪府', salaryMin: 4500000, salaryMax: 6500000, requiredSkills: ['故障対応', '機械設備'], preferredSkills: ['PLC', 'シーケンス制御'], requiredExperience: '機器の保守・修理経験', qualifications: [], description: '産業機器の据付・保守・修理対応。', status: 'open' },
  { externalId: 'J010', companyExternalId: 'C005', jobTitle: '電気設計エンジニア', jobCategory: '電気設備', location: '大阪府', salaryMin: 5000000, salaryMax: 7200000, requiredSkills: ['電気設備', 'CAD'], preferredSkills: ['シーケンス制御', 'PLC'], requiredExperience: '電気設計経験3年以上', qualifications: ['第一種電気工事士'], description: '制御盤・電源設備の電気設計。', status: 'open' },
  { externalId: 'J011', companyExternalId: 'C006', jobTitle: 'プラントエンジニア（機械）', jobCategory: 'プラントエンジニア', location: '愛知県', salaryMin: 5800000, salaryMax: 8800000, requiredSkills: ['プラント', '機械設備'], preferredSkills: ['CAD', '施工管理'], requiredExperience: 'プラント機械設計または工事管理', qualifications: [], description: '化学・食品プラントの機械設計と工事管理。', status: 'open' },
  { externalId: 'J012', companyExternalId: 'C006', jobTitle: '計装エンジニア', jobCategory: 'プラントエンジニア', location: '愛知県', salaryMin: 5500000, salaryMax: 8000000, requiredSkills: ['PLC', 'シーケンス制御', 'プラント'], preferredSkills: ['DCS'], requiredExperience: '計装・制御設計経験', qualifications: [], description: 'プラント計装設計・DCS 更新案件。', status: 'open' },
  { externalId: 'J013', companyExternalId: 'C007', jobTitle: 'データセンター設備エンジニア', jobCategory: 'データセンター', location: '東京都', salaryMin: 6000000, salaryMax: 9000000, requiredSkills: ['電気設備', '設備保全', 'データセンター'], preferredSkills: ['ファシリティ'], requiredExperience: '受変電設備または非常用電源の運用経験', qualifications: ['電験三種'], description: '大規模データセンターの電気・空調設備運用。', status: 'open' },
  { externalId: 'J014', companyExternalId: 'C007', jobTitle: 'データセンター建設プロジェクトマネジャー', jobCategory: '施工管理', location: '千葉県', salaryMin: 7000000, salaryMax: 11000000, requiredSkills: ['施工管理', '電気設備'], preferredSkills: ['データセンター'], requiredExperience: '大規模施設の施工管理7年以上', qualifications: ['電気工事施工管理技士'], description: '新設データセンターの建設 PM。', status: 'open' },
  { externalId: 'J015', companyExternalId: 'C008', jobTitle: '発電設備保全エンジニア', jobCategory: '設備保全', location: '石川県', salaryMin: 5200000, salaryMax: 7600000, requiredSkills: ['設備保全', '電気設備', '予防保全'], preferredSkills: ['プラント'], requiredExperience: '発電設備または高圧受電設備の保全経験', qualifications: ['電験三種'], description: '発電所の電気設備保全。', status: 'open' },
  { externalId: 'J016', companyExternalId: 'C008', jobTitle: 'エネルギー管理エンジニア', jobCategory: '設備保全', location: '富山県', salaryMin: 4800000, salaryMax: 6800000, requiredSkills: ['設備保全', '設備改善'], preferredSkills: ['電気設備'], requiredExperience: '省エネ・エネルギー管理経験', qualifications: ['エネルギー管理士'], description: '工場のエネルギー管理と省エネ提案。', status: 'open' },
  { externalId: 'J017', companyExternalId: 'C003', jobTitle: '設備設計（意匠・構造連携）', jobCategory: '建築設計', location: '東京都', salaryMin: 5000000, salaryMax: 7500000, requiredSkills: ['建築設計', 'CAD'], preferredSkills: ['AutoCAD'], requiredExperience: '建築設計実務3年以上', qualifications: ['建築士'], description: 'オフィス・物流施設の設計。', status: 'open' },
  { externalId: 'J018', companyExternalId: 'C001', jobTitle: '設備保全リーダー（夜勤あり）', jobCategory: '設備保全', location: '滋賀県', salaryMin: 5500000, salaryMax: 7800000, requiredSkills: ['設備保全', '予防保全', 'PLC'], preferredSkills: [], requiredExperience: '保全リーダー経験', qualifications: [], description: '交替勤務ありの保全チームリーダー。', status: 'open' },
  { externalId: 'J019', companyExternalId: 'C002', jobTitle: '生産技術（自動化推進）', jobCategory: '生産技術', location: '兵庫県', salaryMin: 5600000, salaryMax: 8200000, requiredSkills: ['生産技術', 'ロボット', '生産設備'], preferredSkills: ['PLC'], requiredExperience: '自動化設備の導入経験', qualifications: [], description: 'ロボット導入によるライン自動化。', status: 'open' },
  { externalId: 'J020', companyExternalId: 'C005', jobTitle: 'フィールドサービスエンジニア（西日本）', jobCategory: 'サービスエンジニア', location: '兵庫県', salaryMin: 4300000, salaryMax: 6000000, requiredSkills: ['故障対応', '機械設備'], preferredSkills: ['電気設備'], requiredExperience: '顧客先での保守対応経験', qualifications: [], description: '西日本エリアの顧客先訪問による保守。', status: 'open' },
  { externalId: 'J021', companyExternalId: 'C004', jobTitle: 'データセンターファシリティ運用', jobCategory: 'データセンター', location: '東京都', salaryMin: 5500000, salaryMax: 8000000, requiredSkills: ['ファシリティ', 'データセンター', '設備保全'], preferredSkills: ['電気設備'], requiredExperience: 'DC またはビル設備の運用経験', qualifications: ['電験三種'], description: 'DC ファシリティの 24 時間運用体制の管理。', status: 'open' },
  { externalId: 'J022', companyExternalId: 'C006', jobTitle: '施工管理（プラント新設）', jobCategory: '施工管理', location: '三重県', salaryMin: 6000000, salaryMax: 9200000, requiredSkills: ['施工管理', 'プラント'], preferredSkills: ['機械設備'], requiredExperience: 'プラント工事の施工管理5年以上', qualifications: ['管工事施工管理技士'], description: 'プラント新設工事の施工管理。', status: 'open' },
];

type DemoCandidate = ExternalCandidate & { careers: NonNullable<ExternalCandidate['careers']> };

export const DEMO_CANDIDATES: DemoCandidate[] = [
  {
    externalId: 'CAND001', name: '山田 太郎', nameKana: 'ヤマダ タロウ', email: 'yamada.taro@example.com', phone: '090-0000-0001',
    age: 34, location: '大阪府', currentSalary: 6200000, desiredSalary: 7000000, jobChangeTiming: 'within_3m',
    ownerCaEmail: 'suzuki@infralink.example.co.jp', status: 'active', phase: 'offer', rank: 'S',
    lastContactDate: daysAgo(3), nextAction: '内定条件の最終確認', nextActionDate: daysAgo(1), disclosureConsent: true,
    careerText: '化学メーカーの工場で設備保全を8年担当。PLC によるシーケンス制御、予防保全計画の立案、故障対応を経験。',
    careers: [
      { companyName: 'サンライズ化学工業株式会社', industry: '化学メーカー', jobCategory: '設備保全', jobTitle: '保全課 主任', startDate: '2016-04-01', endDate: null, yearsExperience: 8, description: '生産設備の予防保全・故障対応・設備改善。保全チーム5名のリーダー。', managementCount: 5 },
    ],
    skills: ['設備保全', 'PLC', 'シーケンス制御', '予防保全', '故障対応', '設備改善'],
    qualifications: ['電験三種', '第一種電気工事士'],
    preference: { desiredLocations: ['大阪府', '兵庫県'], desiredJobs: ['設備保全', '生産技術'], acceptableJobs: ['プラントエンジニア'], ngJobs: ['営業'], minimumSalary: 6200000, desiredSalary: 7000000, transferAllowed: 'no', businessTripAllowed: 'yes', nightShiftAllowed: 'negotiable', priority1: '年収', priority2: '勤務地', priority3: '技術志向' },
  },
  {
    externalId: 'CAND002', name: '佐藤 健一', nameKana: 'サトウ ケンイチ', email: 'sato.kenichi@example.com', phone: '090-0000-0002',
    age: 29, location: '東京都', currentSalary: 5200000, desiredSalary: 6200000, jobChangeTiming: 'within_3m',
    ownerCaEmail: 'sato@infralink.example.co.jp', status: 'active', phase: 'apply_intent', rank: 'A',
    lastContactDate: daysAgo(3), nextAction: '東邦建設への推薦', nextActionDate: daysAgo(2), disclosureConsent: true,
    careerText: 'ゼネコンのサブコンで電気設備の施工管理を6年。オフィスビル・工場案件を担当。',
    careers: [
      { companyName: '首都圏電設工業株式会社', industry: '建設', jobCategory: '施工管理', jobTitle: '工事主任', startDate: '2018-04-01', endDate: null, yearsExperience: 6, description: '電気設備工事の施工管理。工程・原価・安全管理。', managementCount: 8 },
    ],
    skills: ['施工管理', '電気設備', 'CAD'],
    qualifications: ['電気工事施工管理技士', '第一種電気工事士'],
    preference: { desiredLocations: ['東京都', '神奈川県'], desiredJobs: ['施工管理'], acceptableJobs: ['電気設備', 'データセンター'], ngJobs: [], minimumSalary: 5500000, desiredSalary: 6200000, transferAllowed: 'negotiable', businessTripAllowed: 'yes', nightShiftAllowed: 'yes', priority1: '年収', priority2: 'キャリア', priority3: 'WLB' },
  },
  {
    externalId: 'CAND003', name: '鈴木 美咲', nameKana: 'スズキ ミサキ', email: 'suzuki.misaki@example.com', phone: '090-0000-0003',
    age: 31, location: '兵庫県', currentSalary: 4800000, desiredSalary: 5800000, jobChangeTiming: 'within_6m',
    ownerCaEmail: 'tanaka@infralink.example.co.jp', status: 'active', phase: 'jobs_proposed', rank: 'A',
    lastContactDate: daysAgo(4), nextAction: '提案求人の意向確認', nextActionDate: daysAgo(1), disclosureConsent: false,
    careerText: '産業機械メーカーでサービスエンジニアとして7年。顧客先での据付・保守・故障対応。',
    careers: [
      { companyName: '西日本機械サービス株式会社', industry: '機械メーカー', jobCategory: 'サービスエンジニア', jobTitle: 'サービス課', startDate: '2017-04-01', endDate: null, yearsExperience: 7, description: '産業機械の据付・定期保守・故障診断。', managementCount: null },
    ],
    skills: ['故障対応', '機械設備', '電気設備'],
    qualifications: ['第二種電気工事士'],
    preference: { desiredLocations: ['兵庫県', '大阪府'], desiredJobs: ['サービスエンジニア'], acceptableJobs: ['設備保全'], ngJobs: ['施工管理'], minimumSalary: 5000000, desiredSalary: 5800000, transferAllowed: 'no', businessTripAllowed: 'negotiable', nightShiftAllowed: 'no', priority1: 'WLB', priority2: '勤務地', priority3: '年収' },
  },
  {
    externalId: 'CAND004', name: '高橋 直人', nameKana: 'タカハシ ナオト', email: 'takahashi.naoto@example.com', phone: '090-0000-0004',
    age: 38, location: '愛知県', currentSalary: 7000000, desiredSalary: 8200000, jobChangeTiming: 'within_6m',
    ownerCaEmail: 'suzuki@infralink.example.co.jp', status: 'active', phase: 'document_screening', rank: 'S',
    lastContactDate: daysAgo(9), nextAction: '書類選考結果の確認', nextActionDate: daysAgo(2), disclosureConsent: true,
    careerText: 'プラントエンジニアリング会社で機械設計・工事管理を12年。化学プラントの新設案件を複数担当。',
    careers: [
      { companyName: '東海プラント工業株式会社', industry: 'プラントエンジニアリング', jobCategory: 'プラントエンジニア', jobTitle: 'PJ マネジャー', startDate: '2012-04-01', endDate: null, yearsExperience: 12, description: 'プラント機械設計・工事管理。10 億円規模の PJ を統括。', managementCount: 12, projectScale: '10億円規模' },
    ],
    skills: ['プラント', '機械設備', '施工管理', 'CAD', 'AutoCAD'],
    qualifications: ['管工事施工管理技士', 'エネルギー管理士'],
    preference: { desiredLocations: ['愛知県', '三重県'], desiredJobs: ['プラントエンジニア'], acceptableJobs: ['施工管理'], ngJobs: [], minimumSalary: 7000000, desiredSalary: 8200000, transferAllowed: 'negotiable', businessTripAllowed: 'yes', nightShiftAllowed: 'no', priority1: '技術志向', priority2: '年収', priority3: 'マネジメント' },
  },
  {
    externalId: 'CAND005', name: '伊藤 遼', nameKana: 'イトウ リョウ', email: 'ito.ryo@example.com', phone: '090-0000-0005',
    age: 27, location: '大阪府', currentSalary: 4300000, desiredSalary: 5200000, jobChangeTiming: 'immediate',
    ownerCaEmail: 'sato@infralink.example.co.jp', status: 'active', phase: 'interviewed', rank: 'B',
    lastContactDate: daysAgo(2), nextAction: '求人提案', nextActionDate: daysAgo(1), disclosureConsent: false,
    careerText: '食品工場で生産技術として4年。ライン改善と自動化検討を担当。',
    careers: [
      { companyName: '浪速フーズ株式会社', industry: '食品メーカー', jobCategory: '生産技術', jobTitle: '生産技術課', startDate: '2020-04-01', endDate: null, yearsExperience: 4, description: '生産ラインの改善・省人化検討。', managementCount: null },
    ],
    skills: ['生産技術', '設備改善', '生産設備'],
    qualifications: [],
    preference: { desiredLocations: ['大阪府'], desiredJobs: ['生産技術'], acceptableJobs: ['設備保全'], ngJobs: [], minimumSalary: 4500000, desiredSalary: 5200000, transferAllowed: 'no', businessTripAllowed: 'yes', nightShiftAllowed: 'negotiable', priority1: 'キャリア', priority2: '年収', priority3: 'WLB' },
  },
  {
    externalId: 'CAND006', name: '渡辺 恵', nameKana: 'ワタナベ メグミ', email: 'watanabe.megumi@example.com', phone: '090-0000-0006',
    age: 33, location: '東京都', currentSalary: 5600000, desiredSalary: 6500000, jobChangeTiming: 'within_3m',
    ownerCaEmail: 'tanaka@infralink.example.co.jp', status: 'active', phase: 'interview_scheduled', rank: 'A',
    lastContactDate: daysAgo(5), nextAction: '新東京データセンター 一次面接対策', nextActionDate: daysAhead(1), disclosureConsent: true,
    careerText: '大規模オフィスビルの設備管理を9年。受変電設備・空調の運用と法定点検管理。',
    careers: [
      { companyName: '首都ビルマネジメント株式会社', industry: 'ファシリティマネジメント', jobCategory: 'ファシリティマネジメント', jobTitle: '設備管理主任', startDate: '2015-04-01', endDate: null, yearsExperience: 9, description: 'オフィスビル設備の運用管理・法定点検・工事調整。', managementCount: 6 },
    ],
    skills: ['ファシリティ', '設備保全', '電気設備'],
    qualifications: ['電験三種', '第二種電気工事士'],
    preference: { desiredLocations: ['東京都'], desiredJobs: ['ファシリティマネジメント', 'データセンター'], acceptableJobs: ['設備保全'], ngJobs: ['施工管理'], minimumSalary: 6000000, desiredSalary: 6500000, transferAllowed: 'no', businessTripAllowed: 'no', nightShiftAllowed: 'negotiable', priority1: '勤務地', priority2: '年収', priority3: 'WLB' },
  },
  {
    externalId: 'CAND007', name: '中村 拓也', nameKana: 'ナカムラ タクヤ', email: 'nakamura.takuya@example.com', phone: '090-0000-0007',
    age: 41, location: '石川県', currentSalary: 6800000, desiredSalary: 7500000, jobChangeTiming: 'passive',
    ownerCaEmail: 'suzuki@infralink.example.co.jp', status: 'active', phase: 'on_hold', rank: 'B',
    lastContactDate: daysAgo(21), nextAction: '再接触', nextActionDate: daysAgo(4), disclosureConsent: false,
    careerText: '発電設備の保全を15年。高圧受変電設備の点検・更新工事の管理。',
    careers: [
      { companyName: '北陸電設サービス株式会社', industry: 'エネルギー', jobCategory: '設備保全', jobTitle: '保全課長', startDate: '2009-04-01', endDate: null, yearsExperience: 15, description: '発電設備・受変電設備の保全計画と工事管理。', managementCount: 10 },
    ],
    skills: ['設備保全', '電気設備', '予防保全'],
    qualifications: ['電験三種', 'エネルギー管理士'],
    preference: { desiredLocations: ['石川県', '富山県'], desiredJobs: ['設備保全'], acceptableJobs: ['ファシリティマネジメント'], ngJobs: [], minimumSalary: 6500000, desiredSalary: 7500000, transferAllowed: 'no', businessTripAllowed: 'negotiable', nightShiftAllowed: 'no', priority1: '勤務地', priority2: 'WLB', priority3: '年収' },
  },
  {
    externalId: 'CAND008', name: '小林 彩香', nameKana: 'コバヤシ アヤカ', email: 'kobayashi.ayaka@example.com', phone: '090-0000-0008',
    age: 30, location: '東京都', currentSalary: 5000000, desiredSalary: 6000000, jobChangeTiming: 'within_6m',
    ownerCaEmail: 'sato@infralink.example.co.jp', status: 'active', phase: 'post_interview', rank: 'A',
    lastContactDate: daysAgo(2), nextAction: '面接所感の回収', nextActionDate: daysAgo(1), disclosureConsent: true,
    careerText: '組織設計事務所で建築設計を7年。オフィス・物流施設の実施設計。',
    careers: [
      { companyName: '青山設計事務所', industry: '建築設計', jobCategory: '建築設計', jobTitle: '設計担当', startDate: '2017-04-01', endDate: null, yearsExperience: 7, description: 'オフィス・物流施設の基本・実施設計。', managementCount: null },
    ],
    skills: ['建築設計', 'CAD', 'AutoCAD'],
    qualifications: ['建築士'],
    preference: { desiredLocations: ['東京都'], desiredJobs: ['建築設計'], acceptableJobs: ['施工管理'], ngJobs: [], minimumSalary: 5500000, desiredSalary: 6000000, transferAllowed: 'no', businessTripAllowed: 'negotiable', nightShiftAllowed: 'no', priority1: 'WLB', priority2: 'キャリア', priority3: '年収' },
  },
  {
    externalId: 'CAND009', name: '加藤 誠也', nameKana: 'カトウ セイヤ', email: 'kato.seiya@example.com', phone: '090-0000-0009',
    age: 36, location: '大阪府', currentSalary: 5900000, desiredSalary: 6800000, jobChangeTiming: 'within_3m',
    ownerCaEmail: 'tanaka@infralink.example.co.jp', status: 'active', phase: 'jobs_proposed', rank: 'S',
    lastContactDate: daysAgo(3), nextAction: '提案求人の意向確認', nextActionDate: daysAgo(1), disclosureConsent: true,
    careerText: '半導体工場で設備保全を10年。真空装置・ユーティリティ設備の保全と PLC 制御。',
    careers: [
      { companyName: '関西セミコン株式会社', industry: '半導体', jobCategory: '設備保全', jobTitle: '保全係長', startDate: '2014-04-01', endDate: null, yearsExperience: 10, description: '半導体製造装置・ユーティリティ設備の保全。', managementCount: 7 },
    ],
    skills: ['設備保全', 'PLC', '予防保全', '故障対応', '生産設備'],
    qualifications: ['電験三種', '第二種電気工事士'],
    preference: { desiredLocations: ['大阪府', '滋賀県'], desiredJobs: ['設備保全', '生産技術'], acceptableJobs: ['サービスエンジニア'], ngJobs: [], minimumSalary: 6000000, desiredSalary: 6800000, transferAllowed: 'negotiable', businessTripAllowed: 'yes', nightShiftAllowed: 'yes', priority1: '年収', priority2: '技術志向', priority3: '勤務地' },
  },
  {
    externalId: 'CAND010', name: '吉田 亮太', nameKana: 'ヨシダ リョウタ', email: 'yoshida.ryota@example.com', phone: '090-0000-0010',
    age: 26, location: '兵庫県', currentSalary: 3900000, desiredSalary: 4800000, jobChangeTiming: 'immediate',
    ownerCaEmail: 'sato@infralink.example.co.jp', status: 'active', phase: 'pre_interview', rank: 'B',
    lastContactDate: daysAgo(2), nextAction: '初回面談の日時設定', nextActionDate: daysAgo(1), disclosureConsent: false,
    careerText: 'ビルメンテナンス会社で設備管理を3年。日常点検と軽微な修繕。',
    careers: [
      { companyName: '神戸ビルサービス株式会社', industry: 'ファシリティマネジメント', jobCategory: 'ファシリティマネジメント', jobTitle: '設備管理員', startDate: '2021-04-01', endDate: null, yearsExperience: 3, description: '商業施設の日常点検・修繕対応。', managementCount: null },
    ],
    skills: ['ファシリティ', '設備保全'],
    qualifications: ['第二種電気工事士'],
    preference: { desiredLocations: ['兵庫県', '大阪府'], desiredJobs: ['ファシリティマネジメント', '設備保全'], acceptableJobs: ['サービスエンジニア'], ngJobs: [], minimumSalary: 4200000, desiredSalary: 4800000, transferAllowed: 'no', businessTripAllowed: 'negotiable', nightShiftAllowed: 'yes', priority1: '年収', priority2: 'キャリア', priority3: '勤務地' },
  },
  {
    externalId: 'CAND011', name: '松本 大輔', nameKana: 'マツモト ダイスケ', email: 'matsumoto.daisuke@example.com', phone: '090-0000-0011',
    age: 44, location: '東京都', currentSalary: 8500000, desiredSalary: 9500000, jobChangeTiming: 'within_6m',
    ownerCaEmail: 'suzuki@infralink.example.co.jp', status: 'active', phase: 'interview_scheduled', rank: 'S',
    lastContactDate: daysAgo(6), nextAction: '最終面接対策', nextActionDate: daysAgo(1), disclosureConsent: true,
    careerText: 'ゼネコンで大規模施設の施工管理を18年。データセンター案件の PM 経験あり。',
    careers: [
      { companyName: '大成中央建設株式会社', industry: '建設', jobCategory: '施工管理', jobTitle: '工事長', startDate: '2006-04-01', endDate: null, yearsExperience: 18, description: '大規模施設の施工管理。DC 新設案件の PM。', managementCount: 25, projectScale: '100億円規模' },
    ],
    skills: ['施工管理', '電気設備', 'データセンター'],
    qualifications: ['建築施工管理技士', '電気工事施工管理技士'],
    preference: { desiredLocations: ['東京都', '千葉県'], desiredJobs: ['施工管理'], acceptableJobs: ['データセンター'], ngJobs: [], minimumSalary: 8500000, desiredSalary: 9500000, transferAllowed: 'negotiable', businessTripAllowed: 'yes', nightShiftAllowed: 'no', priority1: '年収', priority2: 'マネジメント', priority3: 'キャリア' },
  },
  {
    externalId: 'CAND012', name: '井上 沙織', nameKana: 'イノウエ サオリ', email: 'inoue.saori@example.com', phone: '090-0000-0012',
    age: 32, location: '大阪府', currentSalary: 5100000, desiredSalary: 6000000, jobChangeTiming: 'within_3m',
    ownerCaEmail: 'tanaka@infralink.example.co.jp', status: 'active', phase: 'interviewed', rank: 'A',
    lastContactDate: daysAgo(1), nextAction: '求人提案', nextActionDate: new Date().toISOString(), disclosureConsent: false,
    careerText: '自動車部品工場で生産技術を8年。ロボット導入と設備立ち上げを担当。',
    careers: [
      { companyName: '近畿オートパーツ株式会社', industry: '自動車部品', jobCategory: '生産技術', jobTitle: '生産技術主任', startDate: '2016-04-01', endDate: null, yearsExperience: 8, description: 'ロボット導入・ライン自動化・設備立ち上げ。', managementCount: 4 },
    ],
    skills: ['生産技術', 'ロボット', '生産設備', 'PLC', '設備改善'],
    qualifications: [],
    preference: { desiredLocations: ['大阪府', '兵庫県'], desiredJobs: ['生産技術'], acceptableJobs: ['設備保全'], ngJobs: ['営業'], minimumSalary: 5300000, desiredSalary: 6000000, transferAllowed: 'no', businessTripAllowed: 'yes', nightShiftAllowed: 'no', priority1: 'キャリア', priority2: '年収', priority3: 'WLB' },
  },
];

/** 過去実績 (§12/§33/§35 の分析対象になる完了済み選考を含む)。 */
export const DEMO_APPLICATIONS: ExternalApplication[] = [
  { externalId: 'A001', candidateExternalId: 'CAND001', companyExternalId: 'C001', jobExternalId: 'J001', applicationDate: daysAgo(38), currentStage: 'offer', documentResult: 'pass', interview1Result: 'pass', interview2Result: 'pass', finalResult: 'pass', offerStatus: 'offered', acceptanceStatus: 'pending', offerDeadline: daysAhead(5) },
  { externalId: 'A002', candidateExternalId: 'CAND001', companyExternalId: 'C005', jobExternalId: 'J010', applicationDate: daysAgo(35), currentStage: 'rejected', documentResult: 'fail', finalResult: 'fail', rejectionReasonOriginal: '電気設計の実務経験が要件に届かないため今回は見送りとさせていただきます。' },
  { externalId: 'A003', candidateExternalId: 'CAND004', companyExternalId: 'C006', jobExternalId: 'J011', applicationDate: daysAgo(12), currentStage: 'document_screening', documentResult: 'pending' },
  { externalId: 'A004', candidateExternalId: 'CAND006', companyExternalId: 'C007', jobExternalId: 'J013', applicationDate: daysAgo(11), currentStage: 'interview_1', documentResult: 'pass' },
  { externalId: 'A005', candidateExternalId: 'CAND008', companyExternalId: 'C003', jobExternalId: 'J017', applicationDate: daysAgo(16), currentStage: 'interview_1', documentResult: 'pass', interview1Result: 'pending' },
  { externalId: 'A006', candidateExternalId: 'CAND011', companyExternalId: 'C007', jobExternalId: 'J014', applicationDate: daysAgo(20), currentStage: 'final', documentResult: 'pass', interview1Result: 'pass', interview2Result: 'pass' },
  { externalId: 'A007', candidateExternalId: 'CAND009', companyExternalId: 'C001', jobExternalId: 'J018', applicationDate: daysAgo(50), currentStage: 'rejected', documentResult: 'pass', interview1Result: 'fail', rejectionReasonOriginal: '夜勤を含む交替勤務への適応について懸念が残るため見送りといたします。' },
  { externalId: 'A008', candidateExternalId: 'CAND003', companyExternalId: 'C005', jobExternalId: 'J009', applicationDate: daysAgo(60), currentStage: 'accepted', documentResult: 'pass', interview1Result: 'pass', interview2Result: 'pass', finalResult: 'pass', offerStatus: 'offered', acceptanceStatus: 'declined' },
  { externalId: 'A009', candidateExternalId: 'CAND002', companyExternalId: 'C003', jobExternalId: 'J005', applicationDate: daysAgo(70), currentStage: 'rejected', documentResult: 'fail', rejectionReasonOriginal: '同ポジションで他候補者と比較検討した結果、今回は見送らせていただきます。' },
  { externalId: 'A010', candidateExternalId: 'CAND007', companyExternalId: 'C008', jobExternalId: 'J015', applicationDate: daysAgo(80), currentStage: 'withdrawn', documentResult: 'pass' },
  { externalId: 'A011', candidateExternalId: 'CAND012', companyExternalId: 'C002', jobExternalId: 'J019', applicationDate: daysAgo(90), currentStage: 'accepted', documentResult: 'pass', interview1Result: 'pass', interview2Result: 'pass', finalResult: 'pass', offerStatus: 'offered', acceptanceStatus: 'accepted' },
  { externalId: 'A012', candidateExternalId: 'CAND005', companyExternalId: 'C001', jobExternalId: 'J002', applicationDate: daysAgo(100), currentStage: 'rejected', documentResult: 'fail', rejectionReasonOriginal: '生産技術としての経験年数がやや不足しているとの判断です。' },
];

export const DEMO_ACTIONS: ExternalAction[] = [
  { externalId: 'AC001', candidateExternalId: 'CAND001', caEmail: 'suzuki@infralink.example.co.jp', actionType: 'offer_follow', actionDate: daysAgo(3), memo: '内定条件を説明。他社選考の状況を確認予定。', nextAction: '内定条件の最終確認', nextActionDate: daysAgo(1) },
  { externalId: 'AC002', candidateExternalId: 'CAND002', caEmail: 'sato@infralink.example.co.jp', actionType: 'intent_check', actionDate: daysAgo(3), memo: '東邦建設の求人に応募意思あり。', nextAction: '東邦建設への推薦', nextActionDate: daysAgo(2) },
  { externalId: 'AC003', candidateExternalId: 'CAND003', caEmail: 'tanaka@infralink.example.co.jp', actionType: 'job_proposal', actionDate: daysAgo(4), memo: 'サービスエンジニア求人3件を提案。', nextAction: '提案求人の意向確認', nextActionDate: daysAgo(1) },
  { externalId: 'AC004', candidateExternalId: 'CAND004', caEmail: 'suzuki@infralink.example.co.jp', actionType: 'recommend', actionDate: daysAgo(12), memo: '中部プラントへ推薦。書類選考中。', nextAction: '書類選考結果の確認', nextActionDate: daysAgo(2) },
  { externalId: 'AC005', candidateExternalId: 'CAND005', caEmail: 'sato@infralink.example.co.jp', actionType: 'meeting', actionDate: daysAgo(2), memo: '初回面談実施。生産技術で大阪希望。', nextAction: '求人提案', nextActionDate: daysAgo(1) },
  { externalId: 'AC006', candidateExternalId: 'CAND006', caEmail: 'tanaka@infralink.example.co.jp', actionType: 'recommend', actionDate: daysAgo(5), memo: '新東京DCの一次面接が確定。', nextAction: '新東京データセンター 一次面接対策', nextActionDate: daysAhead(1) },
  { externalId: 'AC007', candidateExternalId: 'CAND008', caEmail: 'sato@infralink.example.co.jp', actionType: 'interview_prep', actionDate: daysAgo(2), memo: '東邦建設の一次面接を実施済み。', nextAction: '面接所感の回収', nextActionDate: daysAgo(1) },
  { externalId: 'AC008', candidateExternalId: 'CAND009', caEmail: 'tanaka@infralink.example.co.jp', actionType: 'job_proposal', actionDate: daysAgo(3), memo: '設備保全求人4件を提案。', nextAction: '提案求人の意向確認', nextActionDate: daysAgo(1) },
  { externalId: 'AC009', candidateExternalId: 'CAND010', caEmail: 'sato@infralink.example.co.jp', actionType: 'call', actionDate: daysAgo(2), memo: '面談希望の連絡あり。日程調整中。', nextAction: '初回面談の日時設定', nextActionDate: daysAgo(1) },
  { externalId: 'AC010', candidateExternalId: 'CAND011', caEmail: 'suzuki@infralink.example.co.jp', actionType: 'recommend', actionDate: daysAgo(6), memo: '新東京DCの最終面接が確定。', nextAction: '最終面接対策', nextActionDate: daysAgo(1) },
  { externalId: 'AC011', candidateExternalId: 'CAND012', caEmail: 'tanaka@infralink.example.co.jp', actionType: 'meeting', actionDate: daysAgo(1), memo: '初回面談実施。ロボット導入経験が強み。', nextAction: '求人提案', nextActionDate: new Date().toISOString() },
  { externalId: 'AC012', candidateExternalId: 'CAND007', caEmail: 'suzuki@infralink.example.co.jp', actionType: 'follow_up', actionDate: daysAgo(21), memo: '一旦保留。4週間後に再接触予定。', nextAction: '再接触', nextActionDate: daysAgo(4) },
];
