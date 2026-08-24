import { eq } from "drizzle-orm";
import { getDb, type Database } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import {
  agentMatchingConfigSchema,
  areaScoreConfigSchema,
  consentConfigSchema,
  diagnosisConfigSchema,
  qualificationConfigSchema,
  SETTING_KEYS,
  DEFAULT_AGENT_MATCHING_CONFIG,
  DEFAULT_AREA_SCORE_CONFIG,
  DEFAULT_CONSENT_CONFIG,
  DEFAULT_DIAGNOSIS_CONFIG,
  DEFAULT_QUALIFICATION_CONFIG,
  type AgentMatchingConfig,
  type AreaScoreConfig,
  type ConsentConfig,
  type DiagnosisConfig,
  type QualificationConfig,
  type SettingKey,
} from "./settings";

async function readSetting<T>(
  key: SettingKey,
  schema: { parse: (value: unknown) => T },
  fallback: T,
  db?: Database,
): Promise<T> {
  const database = db ?? (await getDb());
  const rows = await database
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);

  const raw = rows[0]?.value;
  if (raw === undefined) return fallback;

  const parsed = schema.parse(raw);
  return parsed;
}

export function getDiagnosisConfig(db?: Database): Promise<DiagnosisConfig> {
  return readSetting(
    SETTING_KEYS.diagnosis,
    diagnosisConfigSchema,
    DEFAULT_DIAGNOSIS_CONFIG,
    db,
  );
}

export function getAreaScoreConfig(db?: Database): Promise<AreaScoreConfig> {
  return readSetting(
    SETTING_KEYS.areaScore,
    areaScoreConfigSchema,
    DEFAULT_AREA_SCORE_CONFIG,
    db,
  );
}

export function getAgentMatchingConfig(db?: Database): Promise<AgentMatchingConfig> {
  return readSetting(
    SETTING_KEYS.agentMatching,
    agentMatchingConfigSchema,
    DEFAULT_AGENT_MATCHING_CONFIG,
    db,
  );
}

export function getQualificationConfig(db?: Database): Promise<QualificationConfig> {
  return readSetting(
    SETTING_KEYS.qualification,
    qualificationConfigSchema,
    DEFAULT_QUALIFICATION_CONFIG,
    db,
  );
}

export function getConsentConfig(db?: Database): Promise<ConsentConfig> {
  return readSetting(
    SETTING_KEYS.consent,
    consentConfigSchema,
    DEFAULT_CONSENT_CONFIG,
    db,
  );
}

export async function writeSetting(
  key: SettingKey,
  value: unknown,
  updatedBy: string | null,
  db?: Database,
): Promise<void> {
  const database = db ?? (await getDb());
  await database
    .insert(appSettings)
    .values({ key, value, updatedBy, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedBy, updatedAt: new Date() },
    });
}
