/** Keys of rows in `app_settings`. Business rules live in the DB, not in code. */
export const SETTING_KEYS = {
  diagnosis: 'diagnosis_config',
  incentive: 'incentive_config',
  analytics: 'analytics_config',
  agentRouting: 'agent_routing_config',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];
