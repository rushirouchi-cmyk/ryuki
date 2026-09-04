import type {
  ExternalAction,
  ExternalApplication,
  ExternalCandidate,
  ExternalCompany,
  ExternalJob,
  TalentDataSource,
} from './types';

/**
 * PORTERS Adapter (§4, Phase 2)。
 *
 * PORTERS を Source of Truth とし、本システムはその上に AI 判断層を載せる。
 * 実 API の項目名はテナントのカスタム項目設定に依存するため、
 * 「HTTP 取得」と「DTO への正規化」を分離し、正規化部分 (mapXxx) だけを
 * 顧客テナントごとに差し替えられる形にしている。
 *
 * 認証情報が未設定の場合は例外を投げず healthCheck() が ok:false を返すため、
 * 呼び出し側 (resolveDataSource) は Mock へフォールバックできる。
 */
export class PortersDataSource implements TalentDataSource {
  readonly name = 'porters';

  constructor(
    private baseUrl = process.env.PORTERS_API_BASE_URL ?? '',
    private apiKey = process.env.PORTERS_API_KEY ?? '',
    private tenantId = process.env.PORTERS_TENANT_ID ?? '',
  ) {}

  private configured() {
    return Boolean(this.baseUrl && this.apiKey);
  }

  async healthCheck() {
    if (!this.configured()) {
      return { ok: false, detail: 'PORTERS_API_BASE_URL / PORTERS_API_KEY が未設定です' };
    }
    try {
      const res = await this.request<{ status?: string }>('/health');
      return { ok: true, detail: `PORTERS 接続 OK (${res.status ?? 'ok'})` };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : String(error) };
    }
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    if (!this.configured()) throw new Error('PORTERS の接続情報が未設定です');
    const url = new URL(path.replace(/^\//, ''), this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`);
    for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
    const res = await fetch(url, {
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'x-tenant-id': this.tenantId,
        accept: 'application/json',
      },
      // PORTERS 側の更新を早く反映したいのでキャッシュしない
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`PORTERS API ${path} が ${res.status} を返しました`);
    return (await res.json()) as T;
  }

  /** ページングを吸収して全件取得する。 */
  private async fetchAll<T>(path: string): Promise<T[]> {
    const out: T[] = [];
    let page = 1;
    for (;;) {
      const data = await this.request<{ items?: T[]; hasNext?: boolean }>(path, {
        page: String(page),
        per_page: '200',
      });
      out.push(...(data.items ?? []));
      if (!data.hasNext) break;
      page += 1;
      if (page > 100) break; // 暴走防止
    }
    return out;
  }

  async fetchCompanies(): Promise<ExternalCompany[]> {
    const raw = await this.fetchAll<Record<string, unknown>>('/companies');
    return raw.map(mapCompany);
  }

  async fetchJobs(): Promise<ExternalJob[]> {
    const raw = await this.fetchAll<Record<string, unknown>>('/jobs');
    return raw.map(mapJob);
  }

  async fetchCandidates(): Promise<ExternalCandidate[]> {
    const raw = await this.fetchAll<Record<string, unknown>>('/candidates');
    return raw.map(mapCandidate);
  }

  async fetchApplications(): Promise<ExternalApplication[]> {
    const raw = await this.fetchAll<Record<string, unknown>>('/selections');
    return raw.map(mapApplication);
  }

  async fetchActions(): Promise<ExternalAction[]> {
    const raw = await this.fetchAll<Record<string, unknown>>('/activities');
    return raw.map(mapAction);
  }
}

// --------------------------------------------------------------- 正規化関数
// テナント固有のカスタム項目名はここだけを直せばよい。

const str = (v: unknown) => (v == null ? null : String(v));
const int = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v.split(/[,、;]/).map((s) => s.trim()).filter(Boolean) : [];

function mapCompany(r: Record<string, unknown>): ExternalCompany {
  return {
    externalId: String(r.id ?? r.company_id),
    companyName: String(r.name ?? r.company_name ?? ''),
    transactionStatus: str(r.transaction_status) ?? 'existing',
    industry: str(r.industry),
    location: str(r.address ?? r.location),
    website: str(r.url ?? r.website),
    relationshipStatus: str(r.relationship_status),
    employeeCount: int(r.employee_count),
  };
}

function mapJob(r: Record<string, unknown>): ExternalJob {
  return {
    externalId: String(r.id ?? r.job_id),
    companyExternalId: String(r.company_id ?? ''),
    jobTitle: String(r.title ?? r.job_title ?? ''),
    jobCategory: str(r.job_category),
    location: str(r.work_location ?? r.location),
    salaryMin: int(r.salary_min),
    salaryMax: int(r.salary_max),
    requiredSkills: list(r.required_skills),
    preferredSkills: list(r.preferred_skills),
    requiredExperience: str(r.required_experience),
    qualifications: list(r.qualifications),
    description: str(r.description),
    status: str(r.status) ?? 'open',
  };
}

function mapCandidate(r: Record<string, unknown>): ExternalCandidate {
  return {
    externalId: String(r.id ?? r.candidate_id),
    name: String(r.name ?? ''),
    nameKana: str(r.name_kana),
    email: str(r.email),
    phone: str(r.phone),
    age: int(r.age),
    location: str(r.address ?? r.location),
    currentSalary: int(r.current_salary),
    desiredSalary: int(r.desired_salary),
    jobChangeTiming: str(r.job_change_timing),
    ownerCaEmail: str(r.owner_email ?? r.owner_ca_email),
    status: str(r.status) ?? 'active',
    phase: str(r.phase),
    rank: str(r.rank),
    lastContactDate: str(r.last_contact_date),
    nextAction: str(r.next_action),
    nextActionDate: str(r.next_action_date),
    disclosureConsent: Boolean(r.disclosure_consent),
    careerText: str(r.career_summary ?? r.resume_text),
    skills: list(r.skills),
    qualifications: list(r.qualifications),
    preference: {
      desiredLocations: list(r.desired_locations),
      desiredJobs: list(r.desired_jobs),
      acceptableJobs: list(r.acceptable_jobs),
      ngJobs: list(r.ng_jobs),
      minimumSalary: int(r.minimum_salary),
      desiredSalary: int(r.desired_salary),
      transferAllowed: str(r.transfer_allowed),
      businessTripAllowed: str(r.business_trip_allowed),
      nightShiftAllowed: str(r.night_shift_allowed),
      priority1: str(r.priority_1),
      priority2: str(r.priority_2),
      priority3: str(r.priority_3),
    },
  };
}

function mapApplication(r: Record<string, unknown>): ExternalApplication {
  return {
    externalId: String(r.id ?? r.selection_id),
    candidateExternalId: String(r.candidate_id ?? ''),
    companyExternalId: String(r.company_id ?? ''),
    jobExternalId: str(r.job_id),
    applicationDate: String(r.applied_at ?? r.application_date ?? new Date().toISOString()),
    currentStage: String(r.stage ?? r.current_stage ?? 'applied'),
    documentResult: str(r.document_result),
    interview1Result: str(r.interview_1_result),
    interview2Result: str(r.interview_2_result),
    finalResult: str(r.final_result),
    offerStatus: str(r.offer_status),
    acceptanceStatus: str(r.acceptance_status),
    offerDeadline: str(r.offer_deadline),
    rejectionReasonOriginal: str(r.rejection_reason),
  };
}

function mapAction(r: Record<string, unknown>): ExternalAction {
  return {
    externalId: String(r.id ?? r.activity_id),
    candidateExternalId: String(r.candidate_id ?? ''),
    caEmail: str(r.user_email ?? r.ca_email),
    actionType: String(r.activity_type ?? r.action_type ?? 'follow_up'),
    actionDate: String(r.activity_at ?? r.action_date ?? new Date().toISOString()),
    memo: str(r.memo ?? r.note),
    nextAction: str(r.next_action),
    nextActionDate: str(r.next_action_date),
  };
}
