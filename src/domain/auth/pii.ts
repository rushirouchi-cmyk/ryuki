/** Helpers that keep PII out of logs and out of pre-consent agent views. */

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '—';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '—';
  const head = local.slice(0, 1);
  return `${head}${'*'.repeat(Math.max(2, local.length - 1))}@${domain}`;
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export function maskName(name: string | null | undefined): string {
  if (!name) return '—';
  const head = name.slice(0, 1);
  return `${head}${'*'.repeat(Math.max(1, name.length - 1))}`;
}

/** Redacts known PII fields before anything is written to the audit log. */
const PII_KEYS = new Set(['email', 'phone', 'fullName', 'full_name', 'password', 'passwordHash']);

export function redactForAudit(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = PII_KEYS.has(key) ? '[redacted]' : value;
  }
  return output;
}
