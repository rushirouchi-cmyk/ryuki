import { prisma } from '@/lib/db';
import { toJson } from '@/lib/json';
import { writeAudit } from '@/lib/audit';
import { resolveDataSource, type TalentDataSource } from '@/lib/adapters/datasource';
import { normalizeJobCategory, normalizeQualification, normalizeSkill, skillCategory } from '@/lib/domain/taxonomy';
import { parseDate } from '@/lib/domain/dates';
import { CANDIDATE_PHASES } from '@/lib/domain/enums';

/**
 * データソース → 本システム DB への同期 (§3/§4)。
 *
 * PORTERS / Google Sheets を Source of Truth とし、本システムは
 * 「AI 用構造化データ・判断結果」を上に載せる。したがって同期は
 * 原則として取り込み方向 (read) のみで、こちらから基幹側を書き換えない。
 */

export type SyncSummary = {
  source: string;
  fellBack: boolean;
  companies: number;
  jobs: number;
  candidates: number;
  applications: number;
  actions: number;
  warnings: string[];
};

export async function syncFromDataSource(source?: TalentDataSource): Promise<SyncSummary> {
  const resolved = source ? { source, health: { ok: true, detail: '' }, fellBack: false } : await resolveDataSource();
  const ds = resolved.source;
  const warnings: string[] = [];
  if (resolved.fellBack) {
    warnings.push(`設定されたデータソースに接続できないため Mock を使用しました: ${resolved.health.detail}`);
  }

  const [companies, jobs, candidates, applications, actions] = await Promise.all([
    ds.fetchCompanies(),
    ds.fetchJobs(),
    ds.fetchCandidates(),
    ds.fetchApplications(),
    ds.fetchActions(),
  ]);

  // ------------------------------------------------------------ companies
  const companyIdByExternal = new Map<string, string>();
  for (const c of companies) {
    const row = await prisma.company.upsert({
      where: { externalId: c.externalId },
      create: {
        externalId: c.externalId,
        companyName: c.companyName,
        transactionStatus: c.transactionStatus ?? 'unknown',
        industry: c.industry,
        location: c.location,
        website: c.website,
        relationshipStatus: c.relationshipStatus,
        employeeCount: c.employeeCount,
      },
      update: {
        companyName: c.companyName,
        transactionStatus: c.transactionStatus ?? 'unknown',
        industry: c.industry,
        location: c.location,
        website: c.website,
        relationshipStatus: c.relationshipStatus,
        employeeCount: c.employeeCount,
      },
    });
    companyIdByExternal.set(c.externalId, row.id);
  }

  // ----------------------------------------------------------------- jobs
  const jobIdByExternal = new Map<string, string>();
  for (const j of jobs) {
    const companyId = companyIdByExternal.get(j.companyExternalId);
    if (!companyId) {
      warnings.push(`求人 ${j.externalId}: 企業 ${j.companyExternalId} が見つからずスキップしました`);
      continue;
    }
    const row = await prisma.job.upsert({
      where: { portersJobId: j.externalId },
      create: {
        portersJobId: j.externalId,
        companyId,
        jobTitle: j.jobTitle,
        jobCategory: normalizeJobCategory(j.jobCategory),
        location: j.location,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        requiredSkills: toJson([...new Set((j.requiredSkills ?? []).map(normalizeSkill))]),
        preferredSkills: toJson([...new Set((j.preferredSkills ?? []).map(normalizeSkill))]),
        requiredExperience: j.requiredExperience,
        qualifications: toJson([...new Set((j.qualifications ?? []).map(normalizeQualification))]),
        description: j.description,
        status: j.status ?? 'open',
        source: ds.name,
      },
      update: {
        companyId,
        jobTitle: j.jobTitle,
        jobCategory: normalizeJobCategory(j.jobCategory),
        location: j.location,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        requiredSkills: toJson([...new Set((j.requiredSkills ?? []).map(normalizeSkill))]),
        preferredSkills: toJson([...new Set((j.preferredSkills ?? []).map(normalizeSkill))]),
        requiredExperience: j.requiredExperience,
        qualifications: toJson([...new Set((j.qualifications ?? []).map(normalizeQualification))]),
        description: j.description,
        status: j.status ?? 'open',
      },
    });
    jobIdByExternal.set(j.externalId, row.id);
  }

  // ----------------------------------------------------------- candidates
  const users = await prisma.user.findMany();
  const userIdByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
  const candidateIdByExternal = new Map<string, string>();

  for (const c of candidates) {
    const ownerCaId = c.ownerCaEmail ? userIdByEmail.get(c.ownerCaEmail.toLowerCase()) ?? null : null;
    if (c.ownerCaEmail && !ownerCaId) {
      warnings.push(`候補者 ${c.externalId}: 担当CA ${c.ownerCaEmail} が users に存在しません`);
    }
    const phase = CANDIDATE_PHASES.includes((c.phase ?? '') as never) ? c.phase! : 'pre_interview';

    const base = {
      name: c.name,
      nameKana: c.nameKana ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
      age: c.age ?? null,
      location: c.location ?? null,
      currentSalary: c.currentSalary ?? null,
      desiredSalary: c.desiredSalary ?? null,
      jobChangeTiming: c.jobChangeTiming ?? null,
      ownerCaId,
      source: ds.name,
      status: c.status ?? 'active',
      phase,
      rank: c.rank ?? null,
      lastContactDate: parseDate(c.lastContactDate ?? null),
      nextAction: c.nextAction ?? null,
      nextActionDate: parseDate(c.nextActionDate ?? null),
      disclosureConsent: c.disclosureConsent ?? false,
      aiSummary: c.careerText ?? null,
    };

    const row = await prisma.candidate.upsert({
      where: { portersId: c.externalId },
      create: { portersId: c.externalId, ...base },
      update: base,
    });
    candidateIdByExternal.set(c.externalId, row.id);

    // 経歴は毎回作り直す (基幹側が正)。
    if (c.careers?.length) {
      await prisma.candidateCareer.deleteMany({ where: { candidateId: row.id } });
      for (const career of c.careers) {
        await prisma.candidateCareer.create({
          data: {
            candidateId: row.id,
            companyName: career.companyName,
            industry: career.industry ?? null,
            jobCategory: normalizeJobCategory(career.jobCategory),
            jobTitle: career.jobTitle ?? null,
            startDate: parseDate(career.startDate ?? null),
            endDate: parseDate(career.endDate ?? null),
            isCurrent: !career.endDate,
            yearsExperience: career.yearsExperience ?? null,
            description: career.description ?? null,
            managementCount: career.managementCount ?? null,
            projectScale: career.projectScale ?? null,
          },
        });
      }
    }

    // スキル・資格は基幹側の値を human ソースとして登録する (AI 抽出より優先)。
    for (const skill of c.skills ?? []) {
      const name = normalizeSkill(skill);
      await prisma.candidateSkill.upsert({
        where: { candidateId_skillName: { candidateId: row.id, skillName: name } },
        create: { candidateId: row.id, skillName: name, skillCategory: skillCategory(name), source: 'human' },
        update: { source: 'human' },
      });
    }
    for (const qualification of c.qualifications ?? []) {
      const name = normalizeQualification(qualification);
      await prisma.candidateQualification.upsert({
        where: { candidateId_qualificationName: { candidateId: row.id, qualificationName: name } },
        create: { candidateId: row.id, qualificationName: name, source: 'human' },
        update: { source: 'human' },
      });
    }

    if (c.preference) {
      const p = c.preference;
      const preferenceData = {
        desiredLocations: toJson(p.desiredLocations ?? []),
        desiredJobs: toJson(p.desiredJobs ?? []),
        acceptableJobs: toJson(p.acceptableJobs ?? []),
        ngJobs: toJson(p.ngJobs ?? []),
        minimumSalary: p.minimumSalary ?? null,
        desiredSalary: p.desiredSalary ?? null,
        transferAllowed: p.transferAllowed ?? null,
        businessTripAllowed: p.businessTripAllowed ?? null,
        nightShiftAllowed: p.nightShiftAllowed ?? null,
        priority1: p.priority1 ?? null,
        priority2: p.priority2 ?? null,
        priority3: p.priority3 ?? null,
      };
      await prisma.candidatePreference.upsert({
        where: { candidateId: row.id },
        create: { candidateId: row.id, ...preferenceData },
        update: preferenceData,
      });
    }
  }

  // --------------------------------------------------------- applications
  let applicationCount = 0;
  for (const a of applications) {
    const candidateId = candidateIdByExternal.get(a.candidateExternalId);
    const companyId = companyIdByExternal.get(a.companyExternalId);
    if (!candidateId || !companyId) {
      warnings.push(`選考 ${a.externalId}: 候補者または企業が見つからずスキップしました`);
      continue;
    }
    const data = {
      candidateId,
      companyId,
      jobId: a.jobExternalId ? jobIdByExternal.get(a.jobExternalId) ?? null : null,
      applicationDate: parseDate(a.applicationDate) ?? new Date(),
      currentStage: a.currentStage,
      documentResult: a.documentResult ?? null,
      interview1Result: a.interview1Result ?? null,
      interview2Result: a.interview2Result ?? null,
      finalResult: a.finalResult ?? null,
      offerStatus: a.offerStatus ?? null,
      acceptanceStatus: a.acceptanceStatus ?? null,
      offerDeadline: parseDate(a.offerDeadline ?? null),
      // 原文は絶対に消さない (§34)。タグは AI 提案 → 人が確定するため同期では触らない。
      rejectionReasonOriginal: a.rejectionReasonOriginal ?? null,
    };
    await prisma.application.upsert({
      where: { externalId: a.externalId },
      create: { externalId: a.externalId, ...data },
      update: data,
    });
    applicationCount += 1;
  }

  // -------------------------------------------------------------- actions
  let actionCount = 0;
  for (const a of actions) {
    const candidateId = candidateIdByExternal.get(a.candidateExternalId);
    if (!candidateId) continue;
    const data = {
      candidateId,
      caId: a.caEmail ? userIdByEmail.get(a.caEmail.toLowerCase()) ?? null : null,
      actionType: a.actionType,
      actionDate: parseDate(a.actionDate) ?? new Date(),
      memo: a.memo ?? null,
      nextAction: a.nextAction ?? null,
      nextActionDate: parseDate(a.nextActionDate ?? null),
      actor: 'human',
    };
    await prisma.candidateAction.upsert({
      where: { externalId: a.externalId },
      create: { externalId: a.externalId, ...data },
      update: data,
    });
    actionCount += 1;
  }

  await writeAudit({
    actor: { type: 'system', label: `sync:${ds.name}` },
    entityType: 'sync',
    entityId: ds.name,
    action: 'update',
    after: {
      companies: companyIdByExternal.size,
      jobs: jobIdByExternal.size,
      candidates: candidateIdByExternal.size,
      applications: applicationCount,
      actions: actionCount,
    },
  });

  return {
    source: ds.name,
    fellBack: resolved.fellBack,
    companies: companyIdByExternal.size,
    jobs: jobIdByExternal.size,
    candidates: candidateIdByExternal.size,
    applications: applicationCount,
    actions: actionCount,
    warnings,
  };
}
