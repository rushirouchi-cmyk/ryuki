/**
 * Google Sheets 連携用テンプレートの生成 (§23)。
 *
 *   npx tsx scripts/export-sheets-template.ts
 *
 * sheets-template/ に、シート (タブ) ごとの CSV を出力する。
 * これをそのまま Google スプレッドシートの各タブへ読み込めば、
 * DATA_SOURCE=sheets で本システムに取り込める形になる。
 *
 * 設計方針:
 *  - 1 枚の巨大シートにしない。用途ごとにタブを分ける。
 *  - JOIN キーは candidate_id / company_id / job_id などの一意 ID。氏名は使わない。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SHEET_NAMES } from '../src/lib/adapters/datasource';
import {
  DEMO_ACTIONS,
  DEMO_APPLICATIONS,
  DEMO_CANDIDATES,
  DEMO_COMPANIES,
  DEMO_JOBS,
} from '../src/lib/demo/fixtures';

const OUT_DIR = 'sheets-template';

/** CSV の 1 セルをエスケープする。 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value) ? value.join(',') : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(sheet: string, header: string[], rows: unknown[][]) {
  const csv = [header.join(','), ...rows.map((row) => row.map(cell).join(','))].join('\n');
  writeFileSync(join(OUT_DIR, `${sheet}.csv`), `${csv}\n`, 'utf8');
  console.log(`  ${sheet}.csv (${rows.length} 行)`);
}

mkdirSync(OUT_DIR, { recursive: true });
console.log(`${OUT_DIR}/ にテンプレートを出力します:`);

writeCsv(
  SHEET_NAMES.candidates,
  [
    'candidate_id', 'name', 'name_kana', 'email', 'phone', 'age', 'location',
    'current_salary', 'desired_salary', 'job_change_timing', 'owner_ca_email',
    'status', 'phase', 'rank', 'last_contact_date', 'next_action', 'next_action_date',
    'disclosure_consent', 'career_text', 'desired_locations', 'desired_jobs',
    'acceptable_jobs', 'ng_jobs', 'minimum_salary', 'transfer_allowed',
    'business_trip_allowed', 'night_shift_allowed', 'priority_1', 'priority_2', 'priority_3',
  ],
  DEMO_CANDIDATES.map((c) => [
    c.externalId, c.name, c.nameKana, c.email, c.phone, c.age, c.location,
    c.currentSalary, c.desiredSalary, c.jobChangeTiming, c.ownerCaEmail,
    c.status, c.phase, c.rank, c.lastContactDate, c.nextAction, c.nextActionDate,
    c.disclosureConsent, c.careerText,
    c.preference?.desiredLocations, c.preference?.desiredJobs,
    c.preference?.acceptableJobs, c.preference?.ngJobs, c.preference?.minimumSalary,
    c.preference?.transferAllowed, c.preference?.businessTripAllowed,
    c.preference?.nightShiftAllowed, c.preference?.priority1,
    c.preference?.priority2, c.preference?.priority3,
  ]),
);

writeCsv(
  SHEET_NAMES.skills,
  ['candidate_id', 'skill_name', 'skill_category', 'skill_level', 'years_experience', 'evidence'],
  DEMO_CANDIDATES.flatMap((c) => [
    ...(c.skills ?? []).map((s) => [c.externalId, s, 'technical', '', '', '']),
    // 資格は skill_category='qualification' の行として同じシートに入れる。
    ...(c.qualifications ?? []).map((q) => [c.externalId, q, 'qualification', '', '', '']),
  ]),
);

writeCsv(
  SHEET_NAMES.companies,
  ['company_id', 'company_name', 'transaction_status', 'industry', 'location', 'website', 'relationship_status', 'employee_count'],
  DEMO_COMPANIES.map((c) => [
    c.externalId, c.companyName, c.transactionStatus, c.industry, c.location,
    c.website, c.relationshipStatus, c.employeeCount,
  ]),
);

writeCsv(
  SHEET_NAMES.jobs,
  ['job_id', 'company_id', 'job_title', 'job_category', 'location', 'salary_min', 'salary_max',
   'required_skills', 'preferred_skills', 'required_experience', 'qualifications', 'description', 'status'],
  DEMO_JOBS.map((j) => [
    j.externalId, j.companyExternalId, j.jobTitle, j.jobCategory, j.location,
    j.salaryMin, j.salaryMax, j.requiredSkills, j.preferredSkills,
    j.requiredExperience, j.qualifications, j.description, j.status,
  ]),
);

writeCsv(
  SHEET_NAMES.applications,
  ['application_id', 'candidate_id', 'company_id', 'job_id', 'application_date', 'current_stage',
   'document_result', 'interview_1_result', 'interview_2_result', 'final_result',
   'offer_status', 'acceptance_status', 'offer_deadline', 'rejection_reason_original'],
  DEMO_APPLICATIONS.map((a) => [
    a.externalId, a.candidateExternalId, a.companyExternalId, a.jobExternalId,
    a.applicationDate, a.currentStage, a.documentResult, a.interview1Result,
    a.interview2Result, a.finalResult, a.offerStatus, a.acceptanceStatus,
    a.offerDeadline, a.rejectionReasonOriginal,
  ]),
);

writeCsv(
  SHEET_NAMES.actions,
  ['action_id', 'candidate_id', 'ca_email', 'action_type', 'action_date', 'memo', 'next_action', 'next_action_date'],
  DEMO_ACTIONS.map((a) => [
    a.externalId, a.candidateExternalId, a.caEmail, a.actionType,
    a.actionDate, a.memo, a.nextAction, a.nextActionDate,
  ]),
);

// 以下 2 シートは本システムが書き出す側 (人が編集する前提ではない)。
// 列だけ定義し、運用開始後にエクスポートで埋める想定。
writeCsv(
  SHEET_NAMES.businessDevelopment,
  ['opportunity_id', 'company_id', 'score', 'matching_candidate_count', 's_rank_count',
   'a_rank_count', 'hiring_demand_score', 'reason', 'recommended_action', 'status', 'owner_ra_email'],
  [],
);

writeCsv(
  SHEET_NAMES.alerts,
  ['alert_id', 'candidate_id', 'ca_email', 'alert_level', 'alert_type', 'reason',
   'detected_at', 'first_notification_at', 'second_notification_at', 'escalated_at', 'status'],
  [],
);

console.log('\n各 CSV を Google スプレッドシートの同名タブへ読み込んでください。');
