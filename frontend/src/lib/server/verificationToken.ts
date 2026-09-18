import { createHmac, randomInt } from "crypto";

// Stateless HMAC-signed tokens for the vendor email-verification flow (captcha challenge,
// pending verification, and verified-proof), so no database/session store is required.
// Set VENDOR_VERIFICATION_SECRET in production; the fallback is fine for local/demo use only.
const SECRET = process.env.VENDOR_VERIFICATION_SECRET ?? "dev-only-insecure-secret-change-me";

function sign(encodedPayload: string): string {
  return createHmac("sha256", SECRET).update(encodedPayload).digest("base64url");
}

export function issueToken(data: Record<string, string | number>, ttlMs: number): string {
  const payload = JSON.stringify({ ...data, exp: Date.now() + ttlMs });
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string): T | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || sign(encoded) !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
    return payload as T;
  } catch {
    return null;
  }
}

/** Cryptographically-random numeric string (e.g. a 6-digit verification code). */
export function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += randomInt(0, 10).toString();
  return out;
}
