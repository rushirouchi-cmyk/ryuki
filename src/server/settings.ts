import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db/client';
import { SETTING_KEYS } from '@/domain/config/keys';
import {
  DEFAULT_DIAGNOSIS_CONFIG,
  diagnosisConfigSchema,
  type DiagnosisConfig,
} from '@/domain/config/diagnosis-config';
import {
  DEFAULT_ANALYTICS_CONFIG,
  analyticsConfigSchema,
  type AnalyticsConfig,
} from '@/domain/config/analytics-config';
import {
  DEFAULT_AGENT_ROUTING_CONFIG,
  agentRoutingConfigSchema,
  type AgentRoutingConfig,
} from '@/domain/config/agent-routing-config';
import {
  DEFAULT_INCENTIVE_CONFIG,
  incentiveConfigSchema,
  type IncentiveConfig,
} from '@/domain/config/incentive-config';
import type { z } from 'zod';

async function readSetting<T>(key: string, parser: z.ZodType<T>, fallback: T): Promise<T> {
  const row = await getDb().query.appSettings.findFirst({ where: eq(schema.appSettings.key, key) });
  if (!row) return fallback;
  const parsed = parser.safeParse(row.value);
  return parsed.success ? parsed.data : fallback;
}

async function writeSetting(key: string, value: unknown, userId: string, description?: string) {
  await getDb()
    .insert(schema.appSettings)
    .values({
      key,
      value: value as Record<string, unknown>,
      description,
      updatedByUserId: userId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: value as Record<string, unknown>, updatedByUserId: userId, updatedAt: new Date() },
    });
}

export function getDiagnosisConfig(): Promise<DiagnosisConfig> {
  return readSetting(SETTING_KEYS.diagnosis, diagnosisConfigSchema, DEFAULT_DIAGNOSIS_CONFIG);
}

export function saveDiagnosisConfig(config: DiagnosisConfig, userId: string) {
  return writeSetting(SETTING_KEYS.diagnosis, config, userId, '年収診断エンジンの重み・閾値');
}

export function getAnalyticsConfig(): Promise<AnalyticsConfig> {
  return readSetting(SETTING_KEYS.analytics, analyticsConfigSchema, DEFAULT_ANALYTICS_CONFIG);
}

export function saveAnalyticsConfig(config: AnalyticsConfig, userId: string) {
  return writeSetting(SETTING_KEYS.analytics, config, userId, 'Area Score・原価前提');
}

export function getAgentRoutingConfig(): Promise<AgentRoutingConfig> {
  return readSetting(SETTING_KEYS.agentRouting, agentRoutingConfigSchema, DEFAULT_AGENT_ROUTING_CONFIG);
}

export function saveAgentRoutingConfig(config: AgentRoutingConfig, userId: string) {
  return writeSetting(SETTING_KEYS.agentRouting, config, userId, 'エージェント推薦スコアの重み');
}

export function getIncentiveConfig(): Promise<IncentiveConfig> {
  return readSetting(SETTING_KEYS.incentive, incentiveConfigSchema, DEFAULT_INCENTIVE_CONFIG);
}

export function saveIncentiveConfig(config: IncentiveConfig, userId: string) {
  return writeSetting(SETTING_KEYS.incentive, config, userId, 'インセンティブ運用設定');
}
