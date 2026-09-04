import {
  DEMO_ACTIONS,
  DEMO_APPLICATIONS,
  DEMO_CANDIDATES,
  DEMO_COMPANIES,
  DEMO_JOBS,
} from '@/lib/demo/fixtures';
import type {
  ExternalAction,
  ExternalApplication,
  ExternalCandidate,
  ExternalCompany,
  ExternalJob,
  TalentDataSource,
} from './types';

/** PORTERS / Sheets 未接続でも通しで動かすための Mock (§42/§43)。 */
export class MockDataSource implements TalentDataSource {
  readonly name = 'mock';

  async healthCheck() {
    return { ok: true, detail: 'Mock データソース (デモデータ) を使用しています' };
  }
  async fetchCompanies(): Promise<ExternalCompany[]> {
    return DEMO_COMPANIES;
  }
  async fetchJobs(): Promise<ExternalJob[]> {
    return DEMO_JOBS;
  }
  async fetchCandidates(): Promise<ExternalCandidate[]> {
    return DEMO_CANDIDATES;
  }
  async fetchApplications(): Promise<ExternalApplication[]> {
    return DEMO_APPLICATIONS;
  }
  async fetchActions(): Promise<ExternalAction[]> {
    return DEMO_ACTIONS;
  }
}
