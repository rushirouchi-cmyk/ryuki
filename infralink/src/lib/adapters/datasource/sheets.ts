import { SignJWT, importPKCS8 } from 'jose';
import type {
  ExternalAction,
  ExternalApplication,
  ExternalCandidate,
  ExternalCompany,
  ExternalJob,
  TalentDataSource,
} from './types';

/**
 * Google Sheets Adapter (§23)。
 *
 * 1 枚の巨大シートにせず、以下のシート (タブ) に分割する。
 * すべて candidate_id / company_id / job_id など一意 ID で JOIN する。氏名はキーにしない。
 *
 *   Candidates / CandidateActions / Applications / Jobs / Companies / Skills /
 *   BusinessDevelopment / Alerts
 *
 * 認証はサービスアカウント (JWT Bearer) を使い、鍵は環境変数から読む (§41)。
 */

export const SHEET_NAMES = {
  candidates: 'Candidates',
  actions: 'CandidateActions',
  applications: 'Applications',
  jobs: 'Jobs',
  companies: 'Companies',
  skills: 'Skills',
  businessDevelopment: 'BusinessDevelopment',
  alerts: 'Alerts',
} as const;

type Row = Record<string, string>;

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,、;\/|]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function num(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function bool(value: string | undefined): boolean {
  return /^(true|yes|1|はい|同意)$/i.test((value ?? '').trim());
}

export class GoogleSheetsDataSource implements TalentDataSource {
  readonly name = 'sheets';
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? '',
    private clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '',
    private privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  ) {}

  async healthCheck() {
    if (!this.spreadsheetId || !this.clientEmail || !this.privateKey) {
      return { ok: false, detail: 'GOOGLE_SHEETS_* の環境変数が未設定です' };
    }
    try {
      await this.readSheet(SHEET_NAMES.candidates);
      return { ok: true, detail: `spreadsheet ${this.spreadsheetId} に接続しました` };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : String(error) };
    }
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;

    const key = await importPKCS8(this.privateKey, 'RS256');
    const now = Math.floor(Date.now() / 1000);
    const assertion = await new SignJWT({
      scope: 'https://www.googleapis.com/auth/spreadsheets',
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(this.clientEmail)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!res.ok) throw new Error(`Google 認証に失敗しました: ${res.status}`);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return this.token.value;
  }

  /** 1 行目をヘッダーとして Row[] を返す。存在しないシートは空配列。 */
  private async readSheet(sheet: string): Promise<Row[]> {
    const token = await this.accessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${encodeURIComponent(sheet)}`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (res.status === 400 || res.status === 404) return [];
    if (!res.ok) throw new Error(`シート ${sheet} の取得に失敗しました: ${res.status}`);
    const data = (await res.json()) as { values?: string[][] };
    const [header, ...rows] = data.values ?? [];
    if (!header) return [];
    return rows.map((cells) => {
      const row: Row = {};
      header.forEach((key, i) => {
        row[key.trim()] = (cells[i] ?? '').trim();
      });
      return row;
    });
  }

  async fetchCompanies(): Promise<ExternalCompany[]> {
    const rows = await this.readSheet(SHEET_NAMES.companies);
    return rows
      .filter((r) => r.company_id && r.company_name)
      .map((r) => ({
        externalId: r.company_id,
        companyName: r.company_name,
        transactionStatus: r.transaction_status || 'unknown',
        industry: r.industry || null,
        location: r.location || null,
        website: r.website || null,
        relationshipStatus: r.relationship_status || null,
        employeeCount: num(r.employee_count),
      }));
  }

  async fetchJobs(): Promise<ExternalJob[]> {
    const rows = await this.readSheet(SHEET_NAMES.jobs);
    return rows
      .filter((r) => r.job_id && r.company_id)
      .map((r) => ({
        externalId: r.job_id,
        companyExternalId: r.company_id,
        jobTitle: r.job_title,
        jobCategory: r.job_category || null,
        location: r.location || null,
        salaryMin: num(r.salary_min),
        salaryMax: num(r.salary_max),
        requiredSkills: splitList(r.required_skills),
        preferredSkills: splitList(r.preferred_skills),
        requiredExperience: r.required_experience || null,
        qualifications: splitList(r.qualifications),
        description: r.description || null,
        status: r.status || 'open',
      }));
  }

  async fetchCandidates(): Promise<ExternalCandidate[]> {
    const [rows, skillRows] = await Promise.all([
      this.readSheet(SHEET_NAMES.candidates),
      this.readSheet(SHEET_NAMES.skills),
    ]);

    const skillsByCandidate = new Map<string, string[]>();
    const qualsByCandidate = new Map<string, string[]>();
    for (const row of skillRows) {
      if (!row.candidate_id || !row.skill_name) continue;
      const bucket = row.skill_category === 'qualification' ? qualsByCandidate : skillsByCandidate;
      bucket.set(row.candidate_id, [...(bucket.get(row.candidate_id) ?? []), row.skill_name]);
    }

    return rows
      .filter((r) => r.candidate_id && r.name)
      .map((r) => ({
        externalId: r.candidate_id,
        name: r.name,
        nameKana: r.name_kana || null,
        email: r.email || null,
        phone: r.phone || null,
        age: num(r.age),
        location: r.location || null,
        currentSalary: num(r.current_salary),
        desiredSalary: num(r.desired_salary),
        jobChangeTiming: r.job_change_timing || null,
        ownerCaEmail: r.owner_ca_email || null,
        status: r.status || 'active',
        phase: r.phase || null,
        rank: r.rank || null,
        lastContactDate: r.last_contact_date || null,
        nextAction: r.next_action || null,
        nextActionDate: r.next_action_date || null,
        disclosureConsent: bool(r.disclosure_consent),
        careerText: r.career_text || null,
        skills: skillsByCandidate.get(r.candidate_id) ?? splitList(r.skills),
        qualifications: qualsByCandidate.get(r.candidate_id) ?? splitList(r.qualifications),
        preference: {
          desiredLocations: splitList(r.desired_locations),
          desiredJobs: splitList(r.desired_jobs),
          acceptableJobs: splitList(r.acceptable_jobs),
          ngJobs: splitList(r.ng_jobs),
          minimumSalary: num(r.minimum_salary),
          desiredSalary: num(r.desired_salary),
          transferAllowed: r.transfer_allowed || null,
          businessTripAllowed: r.business_trip_allowed || null,
          nightShiftAllowed: r.night_shift_allowed || null,
          priority1: r.priority_1 || null,
          priority2: r.priority_2 || null,
          priority3: r.priority_3 || null,
        },
      }));
  }

  async fetchApplications(): Promise<ExternalApplication[]> {
    const rows = await this.readSheet(SHEET_NAMES.applications);
    return rows
      .filter((r) => r.application_id && r.candidate_id && r.company_id)
      .map((r) => ({
        externalId: r.application_id,
        candidateExternalId: r.candidate_id,
        companyExternalId: r.company_id,
        jobExternalId: r.job_id || null,
        applicationDate: r.application_date,
        currentStage: r.current_stage,
        documentResult: r.document_result || null,
        interview1Result: r.interview_1_result || null,
        interview2Result: r.interview_2_result || null,
        finalResult: r.final_result || null,
        offerStatus: r.offer_status || null,
        acceptanceStatus: r.acceptance_status || null,
        offerDeadline: r.offer_deadline || null,
        rejectionReasonOriginal: r.rejection_reason_original || null,
      }));
  }

  async fetchActions(): Promise<ExternalAction[]> {
    const rows = await this.readSheet(SHEET_NAMES.actions);
    return rows
      .filter((r) => r.action_id && r.candidate_id)
      .map((r) => ({
        externalId: r.action_id,
        candidateExternalId: r.candidate_id,
        caEmail: r.ca_email || null,
        actionType: r.action_type || 'follow_up',
        actionDate: r.action_date,
        memo: r.memo || null,
        nextAction: r.next_action || null,
        nextActionDate: r.next_action_date || null,
      }));
  }
}
