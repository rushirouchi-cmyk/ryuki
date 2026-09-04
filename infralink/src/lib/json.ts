/** DB に JSON 文字列として格納した値の安全な読み書き (ADR-002)。 */

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function parseList(raw: string | null | undefined): string[] {
  const value = parseJson<unknown>(raw, []);
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}
