import { randomBytes } from "node:crypto";

/** URL-safe opaque token. Never encodes any candidate or rep information. */
export function generateToken(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}
