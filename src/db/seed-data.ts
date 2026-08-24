/** Master data for the MVP seed. Kept declarative so it can be reviewed by non-engineers. */

export const REGIONS = [
  { code: 'osaka', name: '大阪', prefecture: '大阪府', isNationalFallback: false },
  { code: 'hyogo', name: '兵庫', prefecture: '兵庫県', isNationalFallback: false },
  { code: 'kyoto', name: '京都', prefecture: '京都府', isNationalFallback: false },
  { code: 'national', name: '全国', prefecture: '全国', isNationalFallback: true },
] as const;

export const OCCUPATIONS = [
  { code: 'auto_mechanic', name: '自動車整備士', category: '整備・メンテナンス', base: 4_000_000 },
  { code: 'equipment_maintenance', name: '設備保全', category: '整備・メンテナンス', base: 4_800_000 },
  { code: 'field_service_engineer', name: 'フィールドサービスエンジニア', category: '技術サービス', base: 5_400_000 },
  { code: 'industrial_machine_service', name: '産業機械サービスエンジニア', category: '技術サービス', base: 5_600_000 },
  { code: 'electrical_construction', name: '電気工事', category: '建設・設備', base: 4_600_000 },
  { code: 'construction_management', name: '施工管理', category: '建設・設備', base: 5_800_000 },
  { code: 'sales', name: '営業', category: '営業', base: 4_800_000 },
  { code: 'production_technician', name: '生産技術', category: '製造技術', base: 5_200_000 },
  { code: 'building_maintenance', name: 'ビルメンテナンス', category: '整備・メンテナンス', base: 4_000_000 },
] as const;

export type OccupationCode = (typeof OCCUPATIONS)[number]['code'];

export const SKILLS = [
  { code: 'fault_diagnosis', name: '故障診断', category: '技術' },
  { code: 'machine_maintenance', name: '機械メンテナンス', category: '技術' },
  { code: 'electrical_wiring', name: '電気配線', category: '技術' },
  { code: 'hydraulics', name: '油圧・空圧', category: '技術' },
  { code: 'plc', name: 'PLC制御', category: '技術' },
  { code: 'blueprint_reading', name: '図面読解', category: '技術' },
  { code: 'welding', name: '溶接', category: '技術' },
  { code: 'cad', name: 'CAD', category: '技術' },
  { code: 'inspection_record', name: '点検・保守記録', category: '技術' },
  { code: 'customer_service', name: '顧客対応', category: 'ヒューマン' },
  { code: 'quotation', name: '見積作成', category: 'ビジネス' },
  { code: 'inventory', name: '在庫管理', category: 'ビジネス' },
  { code: 'schedule_management', name: '工程管理', category: 'マネジメント' },
  { code: 'safety_management', name: '安全管理', category: 'マネジメント' },
  { code: 'mentoring', name: '部下育成', category: 'マネジメント' },
] as const;

export type SkillCode = (typeof SKILLS)[number]['code'];

export const CERTIFICATIONS = [
  { code: 'auto_mechanic_2', name: '自動車整備士2級', category: '整備' },
  { code: 'auto_mechanic_1', name: '自動車整備士1級', category: '整備' },
  { code: 'electrician_2', name: '第二種電気工事士', category: '電気' },
  { code: 'electrician_1', name: '第一種電気工事士', category: '電気' },
  { code: 'chief_electrical_3', name: '第三種電気主任技術者', category: '電気' },
  { code: 'hazmat_b4', name: '危険物取扱者 乙4', category: '設備' },
  { code: 'boiler_2', name: '2級ボイラー技士', category: '設備' },
  { code: 'fire_equipment', name: '消防設備士', category: '設備' },
  { code: 'machine_maintenance_2', name: '機械保全技能士2級', category: '機械' },
  { code: 'forklift', name: 'フォークリフト運転技能', category: '作業' },
  { code: 'slinging', name: '玉掛け', category: '作業' },
  { code: 'construction_mgmt_2', name: '2級施工管理技士', category: '建設' },
  { code: 'construction_mgmt_1', name: '1級施工管理技士', category: '建設' },
  { code: 'drivers_license', name: '普通自動車免許', category: '共通' },
] as const;

export type CertificationCode = (typeof CERTIFICATIONS)[number]['code'];

export const OCCUPATION_SKILLS: Record<OccupationCode, [SkillCode, number][]> = {
  auto_mechanic: [
    ['fault_diagnosis', 1.0],
    ['machine_maintenance', 0.9],
    ['customer_service', 0.6],
    ['inspection_record', 0.7],
    ['hydraulics', 0.5],
    ['inventory', 0.3],
  ],
  equipment_maintenance: [
    ['machine_maintenance', 1.0],
    ['fault_diagnosis', 0.9],
    ['plc', 0.6],
    ['hydraulics', 0.7],
    ['inspection_record', 0.8],
    ['safety_management', 0.5],
  ],
  field_service_engineer: [
    ['fault_diagnosis', 1.0],
    ['machine_maintenance', 0.9],
    ['customer_service', 0.8],
    ['electrical_wiring', 0.6],
    ['blueprint_reading', 0.5],
    ['quotation', 0.4],
  ],
  industrial_machine_service: [
    ['fault_diagnosis', 1.0],
    ['machine_maintenance', 0.9],
    ['hydraulics', 0.8],
    ['plc', 0.7],
    ['blueprint_reading', 0.6],
    ['customer_service', 0.6],
  ],
  electrical_construction: [
    ['electrical_wiring', 1.0],
    ['blueprint_reading', 0.8],
    ['safety_management', 0.6],
    ['inspection_record', 0.5],
    ['fault_diagnosis', 0.5],
  ],
  construction_management: [
    ['schedule_management', 1.0],
    ['safety_management', 0.9],
    ['blueprint_reading', 0.8],
    ['quotation', 0.7],
    ['customer_service', 0.6],
    ['mentoring', 0.5],
  ],
  sales: [
    ['customer_service', 1.0],
    ['quotation', 0.8],
    ['schedule_management', 0.5],
    ['mentoring', 0.4],
  ],
  production_technician: [
    ['plc', 0.9],
    ['machine_maintenance', 0.8],
    ['cad', 0.7],
    ['blueprint_reading', 0.8],
    ['schedule_management', 0.6],
    ['welding', 0.4],
  ],
  building_maintenance: [
    ['inspection_record', 1.0],
    ['electrical_wiring', 0.7],
    ['machine_maintenance', 0.7],
    ['safety_management', 0.6],
    ['customer_service', 0.5],
  ],
};

export const OCCUPATION_CERTIFICATIONS: Record<OccupationCode, [CertificationCode, number][]> = {
  auto_mechanic: [
    ['auto_mechanic_2', 1.0],
    ['auto_mechanic_1', 0.8],
    ['drivers_license', 0.6],
    ['hazmat_b4', 0.3],
  ],
  equipment_maintenance: [
    ['machine_maintenance_2', 1.0],
    ['electrician_2', 0.7],
    ['hazmat_b4', 0.6],
    ['boiler_2', 0.5],
    ['forklift', 0.4],
  ],
  field_service_engineer: [
    ['drivers_license', 0.9],
    ['machine_maintenance_2', 0.8],
    ['electrician_2', 0.6],
    ['auto_mechanic_2', 0.4],
  ],
  industrial_machine_service: [
    ['machine_maintenance_2', 1.0],
    ['electrician_2', 0.7],
    ['slinging', 0.5],
    ['drivers_license', 0.6],
  ],
  electrical_construction: [
    ['electrician_2', 1.0],
    ['electrician_1', 0.9],
    ['chief_electrical_3', 0.6],
    ['fire_equipment', 0.4],
  ],
  construction_management: [
    ['construction_mgmt_2', 1.0],
    ['construction_mgmt_1', 0.9],
    ['electrician_1', 0.4],
    ['fire_equipment', 0.3],
  ],
  sales: [['drivers_license', 1.0]],
  production_technician: [
    ['machine_maintenance_2', 0.9],
    ['slinging', 0.5],
    ['forklift', 0.5],
    ['electrician_2', 0.4],
  ],
  building_maintenance: [
    ['electrician_2', 0.9],
    ['boiler_2', 0.8],
    ['fire_equipment', 0.7],
    ['hazmat_b4', 0.6],
  ],
};

export interface TransitionSeed {
  source: OccupationCode;
  target: OccupationCode;
  base: number;
  requiredSkills?: SkillCode[];
  preferredSkills?: SkillCode[];
  requiredCertifications?: CertificationCode[];
  preferredCertifications?: CertificationCode[];
  minimumExperienceYears?: number;
  requiresBusinessTrip?: boolean;
  requiresNightShift?: boolean;
  requiresRelocation?: boolean;
  notes?: string;
}

export const TRANSITIONS: TransitionSeed[] = [
  {
    source: 'auto_mechanic',
    target: 'field_service_engineer',
    base: 78,
    requiredSkills: ['fault_diagnosis'],
    preferredSkills: ['customer_service', 'machine_maintenance'],
    preferredCertifications: ['auto_mechanic_2', 'drivers_license'],
    minimumExperienceYears: 2,
    requiresBusinessTrip: true,
    notes: '故障診断・顧客対応の経験がそのまま評価されやすい代表的な転用先です。',
  },
  {
    source: 'auto_mechanic',
    target: 'equipment_maintenance',
    base: 72,
    requiredSkills: ['machine_maintenance'],
    preferredSkills: ['fault_diagnosis', 'inspection_record'],
    preferredCertifications: ['machine_maintenance_2', 'hazmat_b4'],
    minimumExperienceYears: 2,
    requiresNightShift: true,
    notes: '交替勤務を受け入れられる場合、年収が上がりやすい傾向があります。',
  },
  {
    source: 'auto_mechanic',
    target: 'industrial_machine_service',
    base: 70,
    requiredSkills: ['fault_diagnosis', 'machine_maintenance'],
    preferredSkills: ['hydraulics', 'blueprint_reading'],
    minimumExperienceYears: 3,
    requiresBusinessTrip: true,
  },
  {
    source: 'auto_mechanic',
    target: 'sales',
    base: 52,
    preferredSkills: ['customer_service', 'quotation'],
    minimumExperienceYears: 1,
    notes: '技術知識を活かした技術営業への転換ルートです。',
  },
  {
    source: 'equipment_maintenance',
    target: 'field_service_engineer',
    base: 80,
    requiredSkills: ['fault_diagnosis'],
    preferredSkills: ['customer_service', 'plc'],
    minimumExperienceYears: 2,
    requiresBusinessTrip: true,
  },
  {
    source: 'equipment_maintenance',
    target: 'production_technician',
    base: 68,
    requiredSkills: ['machine_maintenance'],
    preferredSkills: ['plc', 'blueprint_reading', 'cad'],
    minimumExperienceYears: 3,
  },
  {
    source: 'equipment_maintenance',
    target: 'industrial_machine_service',
    base: 76,
    requiredSkills: ['machine_maintenance'],
    preferredSkills: ['hydraulics', 'fault_diagnosis'],
    minimumExperienceYears: 3,
    requiresBusinessTrip: true,
  },
  {
    source: 'electrical_construction',
    target: 'equipment_maintenance',
    base: 74,
    requiredSkills: ['electrical_wiring'],
    preferredSkills: ['inspection_record', 'fault_diagnosis'],
    preferredCertifications: ['electrician_2', 'electrician_1'],
    minimumExperienceYears: 2,
  },
  {
    source: 'electrical_construction',
    target: 'construction_management',
    base: 66,
    preferredSkills: ['blueprint_reading', 'schedule_management', 'safety_management'],
    preferredCertifications: ['construction_mgmt_2', 'construction_mgmt_1'],
    minimumExperienceYears: 5,
    notes: '施工管理へのステップアップは年収レンジが大きく上がります。',
  },
  {
    source: 'electrical_construction',
    target: 'building_maintenance',
    base: 70,
    preferredSkills: ['inspection_record', 'electrical_wiring'],
    minimumExperienceYears: 1,
    requiresNightShift: true,
  },
  {
    source: 'building_maintenance',
    target: 'equipment_maintenance',
    base: 72,
    requiredSkills: ['inspection_record'],
    preferredSkills: ['machine_maintenance', 'electrical_wiring'],
    minimumExperienceYears: 2,
  },
  {
    source: 'building_maintenance',
    target: 'field_service_engineer',
    base: 62,
    preferredSkills: ['fault_diagnosis', 'customer_service'],
    minimumExperienceYears: 3,
    requiresBusinessTrip: true,
  },
  {
    source: 'sales',
    target: 'field_service_engineer',
    base: 48,
    requiredSkills: ['customer_service'],
    preferredSkills: ['fault_diagnosis'],
    minimumExperienceYears: 3,
    requiresBusinessTrip: true,
  },
  {
    source: 'sales',
    target: 'construction_management',
    base: 55,
    preferredSkills: ['schedule_management', 'quotation', 'customer_service'],
    minimumExperienceYears: 3,
  },
  {
    source: 'production_technician',
    target: 'industrial_machine_service',
    base: 74,
    requiredSkills: ['machine_maintenance'],
    preferredSkills: ['plc', 'blueprint_reading'],
    minimumExperienceYears: 3,
    requiresBusinessTrip: true,
  },
  {
    source: 'production_technician',
    target: 'construction_management',
    base: 58,
    preferredSkills: ['schedule_management', 'safety_management'],
    minimumExperienceYears: 5,
  },
  {
    source: 'field_service_engineer',
    target: 'industrial_machine_service',
    base: 82,
    requiredSkills: ['fault_diagnosis'],
    preferredSkills: ['hydraulics', 'plc'],
    minimumExperienceYears: 2,
    requiresBusinessTrip: true,
  },
  {
    source: 'construction_management',
    target: 'production_technician',
    base: 54,
    preferredSkills: ['blueprint_reading', 'schedule_management'],
    minimumExperienceYears: 5,
  },
  {
    source: 'industrial_machine_service',
    target: 'production_technician',
    base: 66,
    preferredSkills: ['plc', 'cad'],
    minimumExperienceYears: 4,
  },
];

/** Multipliers applied to each occupation's base salary. */
export const EXPERIENCE_MULTIPLIER: Record<string, number> = {
  '0-2': 0.84,
  '3-5': 0.95,
  '6-9': 1.04,
  '10-14': 1.13,
  '15+': 1.2,
};

export const REGION_MULTIPLIER: Record<string, number> = {
  osaka: 1.03,
  hyogo: 1.0,
  kyoto: 0.99,
  national: 0.97,
};

export const LOCATIONS = [
  {
    prefecture: '兵庫県',
    city: '西宮市',
    district: '北口町',
    venueName: '西宮北口駅前',
    venueType: 'station' as const,
    stationName: '西宮北口',
    regionCode: 'hyogo',
    strength: 1.25,
  },
  {
    prefecture: '大阪府',
    city: '豊中市',
    district: '新千里東町',
    venueName: '千里中央 大型商業施設',
    venueType: 'shopping_mall' as const,
    stationName: '千里中央',
    regionCode: 'osaka',
    strength: 1.15,
  },
  {
    prefecture: '大阪府',
    city: '大阪市北区',
    district: '角田町',
    venueName: '梅田 地下街',
    venueType: 'station' as const,
    stationName: '梅田',
    regionCode: 'osaka',
    strength: 0.72,
  },
  {
    prefecture: '大阪府',
    city: '高槻市',
    district: '白梅町',
    venueName: '高槻 商店街',
    venueType: 'shopping_street' as const,
    stationName: '高槻',
    regionCode: 'osaka',
    strength: 0.95,
  },
] as const;

export const AGENT_COMPANIES = [
  {
    name: 'テクニカルキャリア株式会社',
    contactEmail: 'contact@technical-career.example.com',
    specialties: ['field_service_engineer', 'industrial_machine_service', 'equipment_maintenance'] as OccupationCode[],
    regions: ['osaka', 'hyogo'],
    minSalaryFocus: 4_000_000,
    maxSalaryFocus: 9_000_000,
    userEmail: 'agent1@example.com',
    userName: '技術太郎',
    strength: 1.2,
  },
  {
    name: '関西ジョブナビ',
    contactEmail: 'contact@kansai-jobnavi.example.com',
    specialties: ['sales', 'construction_management', 'electrical_construction'] as OccupationCode[],
    regions: ['osaka', 'hyogo', 'kyoto'],
    minSalaryFocus: 3_000_000,
    maxSalaryFocus: 8_000_000,
    userEmail: 'agent2@example.com',
    userName: '関西花子',
    strength: 0.9,
  },
  {
    name: 'モノづくり転職ラボ',
    contactEmail: 'contact@monozukuri-lab.example.com',
    specialties: ['production_technician', 'equipment_maintenance', 'auto_mechanic'] as OccupationCode[],
    regions: ['osaka'],
    minSalaryFocus: 3_500_000,
    maxSalaryFocus: 7_500_000,
    userEmail: 'agent3@example.com',
    userName: '製造次郎',
    strength: 1.0,
  },
] as const;

export const SALES_USERS = [
  { email: 'sales1@example.com', name: '田中 健太', strength: 1.2 },
  { email: 'sales2@example.com', name: '佐藤 美咲', strength: 1.0 },
  { email: 'sales3@example.com', name: '鈴木 亮', strength: 0.8 },
] as const;

export const INCENTIVE_RULES = [
  { eventType: 'diagnosis_completed' as const, amount: 200, description: '匿名診断の完了' },
  { eventType: 'lead_registered' as const, amount: 500, description: '連絡先登録（有効リード）' },
  { eventType: 'interview_booked' as const, amount: 1_000, description: 'キャリア面談の予約' },
  { eventType: 'interview_completed' as const, amount: 2_000, description: 'キャリア面談の実施' },
  {
    eventType: 'candidate_qualified' as const,
    amount: 800,
    description: '市場価値スコア55以上の有望候補者',
    conditions: { minMarketValueScore: 55 },
  },
  { eventType: 'agent_referred' as const, amount: 1_500, description: 'エージェントへの送客' },
  { eventType: 'joined' as const, amount: 20_000, description: '入社決定' },
];
