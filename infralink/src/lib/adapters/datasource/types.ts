/**
 * データソース抽象 (§4)。
 *
 * PORTERS を Source of Truth としつつ、MVP 期間は Google Sheets、
 * 未接続時は Mock で動かせるよう、取得層とアプリロジックを分離する。
 * アプリ側は本ファイルの DTO しか知らない。
 */

export type ExternalCandidate = {
  externalId: string;
  name: string;
  nameKana?: string | null;
  email?: string | null;
  phone?: string | null;
  age?: number | null;
  location?: string | null;
  currentSalary?: number | null;
  desiredSalary?: number | null;
  jobChangeTiming?: string | null;
  ownerCaEmail?: string | null;
  status?: string | null;
  phase?: string | null;
  rank?: string | null;
  lastContactDate?: string | null;
  nextAction?: string | null;
  nextActionDate?: string | null;
  disclosureConsent?: boolean;
  /** 職務経歴の自由記述。AI 構造化 (Agent 02) の入力になる。 */
  careerText?: string | null;
  /** 既に構造化済みの職歴があれば渡す。 */
  careers?: ExternalCareer[];
  skills?: string[];
  qualifications?: string[];
  preference?: ExternalPreference | null;
};

export type ExternalCareer = {
  companyName: string;
  industry?: string | null;
  jobCategory?: string | null;
  jobTitle?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  yearsExperience?: number | null;
  description?: string | null;
  managementCount?: number | null;
  projectScale?: string | null;
};

export type ExternalPreference = {
  desiredLocations?: string[];
  desiredJobs?: string[];
  acceptableJobs?: string[];
  ngJobs?: string[];
  minimumSalary?: number | null;
  desiredSalary?: number | null;
  transferAllowed?: string | null;
  businessTripAllowed?: string | null;
  nightShiftAllowed?: string | null;
  priority1?: string | null;
  priority2?: string | null;
  priority3?: string | null;
};

export type ExternalCompany = {
  externalId: string;
  companyName: string;
  transactionStatus?: string | null;
  industry?: string | null;
  location?: string | null;
  website?: string | null;
  relationshipStatus?: string | null;
  employeeCount?: number | null;
};

export type ExternalJob = {
  externalId: string;
  companyExternalId: string;
  jobTitle: string;
  jobCategory?: string | null;
  location?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  requiredSkills?: string[];
  preferredSkills?: string[];
  requiredExperience?: string | null;
  qualifications?: string[];
  description?: string | null;
  status?: string | null;
};

export type ExternalApplication = {
  externalId: string;
  candidateExternalId: string;
  companyExternalId: string;
  jobExternalId?: string | null;
  applicationDate: string;
  currentStage: string;
  documentResult?: string | null;
  interview1Result?: string | null;
  interview2Result?: string | null;
  finalResult?: string | null;
  offerStatus?: string | null;
  acceptanceStatus?: string | null;
  offerDeadline?: string | null;
  rejectionReasonOriginal?: string | null;
};

export type ExternalAction = {
  externalId: string;
  candidateExternalId: string;
  caEmail?: string | null;
  actionType: string;
  actionDate: string;
  memo?: string | null;
  nextAction?: string | null;
  nextActionDate?: string | null;
};

export interface TalentDataSource {
  readonly name: string;
  /** 接続確認。UI の「データソース状態」表示に使う。 */
  healthCheck(): Promise<{ ok: boolean; detail: string }>;
  fetchCompanies(): Promise<ExternalCompany[]>;
  fetchJobs(): Promise<ExternalJob[]>;
  fetchCandidates(): Promise<ExternalCandidate[]>;
  fetchApplications(): Promise<ExternalApplication[]>;
  fetchActions(): Promise<ExternalAction[]>;
}
