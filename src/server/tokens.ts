import { createHash, randomBytes } from 'node:crypto';

/** URL-safe token used for QR codes, candidate result links and sessions. */
export function generateToken(bytes = 16): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * One-way fingerprint of a visitor. Used to spot repeat scans without ever
 * storing an IP address or user agent.
 */
export function visitorHash(parts: (string | null | undefined)[]): string {
  const secret = process.env.APP_SECRET ?? 'dev-secret';
  return createHash('sha256').update([secret, ...parts.map((p) => p ?? '')].join('|')).digest('hex');
}
