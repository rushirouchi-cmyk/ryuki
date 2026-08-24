import type { Database } from "@/lib/db";
import {
  agentCompanies,
  agentFeeRules,
  agentRegions,
  agentSalaryBands,
  agentSpecialties,
  careerTransitionRules,
  certifications,
  incentiveRules,
  locations,
  occupationCertifications,
  occupations,
  occupationSkills,
  qrCodes,
  regions,
  salaryMarketBenchmarks,
  shifts,
  skills,
  users,
} from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { generateToken } from "@/lib/utils/token";
import { EXPERIENCE_BANDS } from "@/lib/domain/diagnosis/types";

export interface Fixtures {
  regionId: number;
  otherRegionId: number;
  mechanicId: number;
  fieldServiceId: number;
  maintenanceId: number;
  skills: Record<string, number>;
  certifications: Record<string, number>;
  transitionRuleId: number;
  locationId: number;
  salesUserId: string;
  otherSalesUserId: string;
  adminUserId: string;
  agentCompanyId: number;
  otherAgentCompanyId: number;
  shiftId: number;
  otherShiftId: number;
  qrToken: string;
  otherQrToken: string;
}

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`fixture ${name} was not created`);
  return value;
}

/** A minimal but complete world: two reps, two shifts, two agencies. */
export async function seedFixtures(db: Database): Promise<Fixtures> {
  const regionRows = await db
    .insert(regions)
    .values([
      { code: "test_region", prefecture: "大阪府", name: "大阪市" },
      { code: "other_region", prefecture: "兵庫県", name: "神戸市" },
    ])
    .returning();
  const region = required(regionRows[0], "region");
  const otherRegion = required(regionRows[1], "otherRegion");

  const occupationRows = await db
    .insert(occupations)
    .values([
      { code: "mechanic", name: "自動車整備士", category: "整備" },
      {
        code: "field_service",
        name: "フィールドサービスエンジニア",
        category: "サービス",
        requiresTravel: true,
      },
      {
        code: "maintenance",
        name: "設備保全",
        category: "整備",
        requiresNightShift: true,
      },
    ])
    .returning();
  const mechanic = required(occupationRows[0], "mechanic");
  const fieldService = required(occupationRows[1], "fieldService");
  const maintenance = required(occupationRows[2], "maintenance");

  const skillRows = await db
    .insert(skills)
    .values([
      { code: "fault_diagnosis", name: "故障診断", category: "技術" },
      { code: "machine_maintenance", name: "機械メンテナンス", category: "技術" },
      { code: "customer_support", name: "顧客対応", category: "対人" },
      { code: "plc", name: "PLC制御", category: "技術" },
    ])
    .returning();
  const skillMap: Record<string, number> = Object.fromEntries(
    skillRows.map((row) => [row.code, row.id]),
  );

  const certificationRows = await db
    .insert(certifications)
    .values([
      { code: "mechanic_2", name: "自動車整備士2級", category: "整備" },
      { code: "driver_license", name: "普通自動車免許", category: "共通" },
    ])
    .returning();
  const certificationMap: Record<string, number> = Object.fromEntries(
    certificationRows.map((row) => [row.code, row.id]),
  );

  const faultDiagnosis = required(skillMap.fault_diagnosis, "fault_diagnosis");
  const machineMaintenance = required(skillMap.machine_maintenance, "machine_maintenance");
  const customerSupport = required(skillMap.customer_support, "customer_support");
  const plc = required(skillMap.plc, "plc");
  const driverLicense = required(certificationMap.driver_license, "driver_license");
  const mechanicCert = required(certificationMap.mechanic_2, "mechanic_2");

  await db.insert(occupationSkills).values([
    { occupationId: mechanic.id, skillId: faultDiagnosis, importanceWeight: "1.000" },
    { occupationId: mechanic.id, skillId: machineMaintenance, importanceWeight: "0.900" },
    { occupationId: fieldService.id, skillId: faultDiagnosis, importanceWeight: "1.000" },
    { occupationId: fieldService.id, skillId: customerSupport, importanceWeight: "0.900" },
    {
      occupationId: fieldService.id,
      skillId: machineMaintenance,
      importanceWeight: "0.800",
    },
    {
      occupationId: maintenance.id,
      skillId: machineMaintenance,
      importanceWeight: "1.000",
    },
    { occupationId: maintenance.id, skillId: plc, importanceWeight: "0.800" },
  ]);

  await db.insert(occupationCertifications).values([
    {
      occupationId: fieldService.id,
      certificationId: driverLicense,
      importanceWeight: "0.900",
    },
    {
      occupationId: mechanic.id,
      certificationId: mechanicCert,
      importanceWeight: "1.000",
    },
  ]);

  const ruleRows = await db
    .insert(careerTransitionRules)
    .values([
      {
        sourceOccupationId: mechanic.id,
        targetOccupationId: fieldService.id,
        baseTransitionScore: 85,
        requiredSkillIds: [faultDiagnosis],
        preferredSkillIds: [customerSupport],
        requiredCertificationIds: [],
        preferredCertificationIds: [driverLicense],
        minimumExperienceYears: 2,
      },
      {
        sourceOccupationId: mechanic.id,
        targetOccupationId: maintenance.id,
        baseTransitionScore: 70,
        requiredSkillIds: [machineMaintenance],
        preferredSkillIds: [],
        requiredCertificationIds: [],
        preferredCertificationIds: [],
        minimumExperienceYears: 2,
      },
    ])
    .returning();

  const benchmarkValues = [];
  for (const occupation of [
    { id: mechanic.id, base: 4_000_000 },
    { id: fieldService.id, base: 5_400_000 },
    { id: maintenance.id, base: 4_700_000 },
  ]) {
    for (const band of EXPERIENCE_BANDS) {
      const multiplier =
        band === "0-2" ? 0.85 : band === "3-5" ? 1 : band === "6-9" ? 1.1 : 1.2;
      const median = Math.round(occupation.base * multiplier);
      for (const regionId of [region.id, otherRegion.id, null]) {
        benchmarkValues.push({
          occupationId: occupation.id,
          regionId,
          experienceBand: band,
          salaryLow: Math.round(median * 0.85),
          salaryMedian: median,
          salaryHigh: Math.round(median * 1.2),
          source: "test",
          sourceDate: "2026-01-01",
          confidenceLevel: "medium" as const,
        });
      }
    }
  }
  await db.insert(salaryMarketBenchmarks).values(benchmarkValues);

  const locationRows = await db
    .insert(locations)
    .values({
      regionId: region.id,
      prefecture: "大阪府",
      city: "大阪市北区",
      venueName: "テスト会場",
      venueType: "shopping_mall",
    })
    .returning();
  const location = required(locationRows[0], "location");

  const passwordHash = await hashPassword("password123");
  const userRows = await db
    .insert(users)
    .values([
      { email: "sales1@test.local", passwordHash, name: "営業A", role: "sales" as const },
      { email: "sales2@test.local", passwordHash, name: "営業B", role: "sales" as const },
      { email: "admin@test.local", passwordHash, name: "管理者", role: "admin" as const },
    ])
    .returning();
  const sales = required(userRows[0], "sales");
  const otherSales = required(userRows[1], "otherSales");
  const admin = required(userRows[2], "admin");

  const companyRows = await db
    .insert(agentCompanies)
    .values([{ name: "テストエージェントA" }, { name: "テストエージェントB" }])
    .returning();
  const agentCompany = required(companyRows[0], "agentCompany");
  const otherAgentCompany = required(companyRows[1], "otherAgentCompany");

  await db.insert(agentSpecialties).values([
    { agentCompanyId: agentCompany.id, occupationId: fieldService.id, strength: 5 },
    { agentCompanyId: otherAgentCompany.id, occupationId: maintenance.id, strength: 2 },
  ]);
  await db.insert(agentRegions).values([
    { agentCompanyId: agentCompany.id, regionId: region.id },
    { agentCompanyId: otherAgentCompany.id, regionId: otherRegion.id },
  ]);
  await db.insert(agentSalaryBands).values([
    { agentCompanyId: agentCompany.id, minSalaryYen: 3_000_000, maxSalaryYen: 9_000_000 },
    {
      agentCompanyId: otherAgentCompany.id,
      minSalaryYen: 3_000_000,
      maxSalaryYen: 7_000_000,
    },
  ]);
  await db.insert(agentFeeRules).values([
    {
      agentCompanyId: agentCompany.id,
      eventType: "agent_interview_completed",
      amountYen: 30_000,
      validFrom: "2020-01-01",
    },
    {
      agentCompanyId: agentCompany.id,
      eventType: "joined",
      amountYen: 400_000,
      validFrom: "2020-01-01",
    },
  ]);

  const now = new Date();
  const shiftRows = await db
    .insert(shifts)
    .values([
      {
        salesUserId: sales.id,
        locationId: location.id,
        startTime: now,
        plannedEndTime: new Date(now.getTime() + 4 * 3_600_000),
        venueType: "shopping_mall" as const,
      },
      {
        salesUserId: otherSales.id,
        locationId: location.id,
        startTime: now,
        plannedEndTime: new Date(now.getTime() + 4 * 3_600_000),
        venueType: "shopping_mall" as const,
      },
    ])
    .returning();
  const shift = required(shiftRows[0], "shift");
  const otherShift = required(shiftRows[1], "otherShift");

  const qrToken = generateToken(8);
  const otherQrToken = generateToken(8);
  await db.insert(qrCodes).values([
    { token: qrToken, shiftId: shift.id, salesUserId: sales.id, locationId: location.id },
    {
      token: otherQrToken,
      shiftId: otherShift.id,
      salesUserId: otherSales.id,
      locationId: location.id,
    },
  ]);

  await db.insert(incentiveRules).values([
    {
      name: "診断完了",
      eventType: "diagnosis_completed" as const,
      amountYen: 200,
      validFrom: "2020-01-01",
    },
    {
      name: "リード登録",
      eventType: "lead_registered" as const,
      amountYen: 800,
      validFrom: "2020-01-01",
    },
    {
      name: "送客",
      eventType: "agent_referred" as const,
      amountYen: 5_000,
      validFrom: "2020-01-01",
    },
  ]);

  return {
    regionId: region.id,
    otherRegionId: otherRegion.id,
    mechanicId: mechanic.id,
    fieldServiceId: fieldService.id,
    maintenanceId: maintenance.id,
    skills: skillMap,
    certifications: certificationMap,
    transitionRuleId: required(ruleRows[0], "transitionRule").id,
    locationId: location.id,
    salesUserId: sales.id,
    otherSalesUserId: otherSales.id,
    adminUserId: admin.id,
    agentCompanyId: agentCompany.id,
    otherAgentCompanyId: otherAgentCompany.id,
    shiftId: shift.id,
    otherShiftId: otherShift.id,
    qrToken,
    otherQrToken,
  };
}
