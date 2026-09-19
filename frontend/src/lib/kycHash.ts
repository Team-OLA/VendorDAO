/**
 * Computes a client-side SHA-256 hash of an applicant's identity fields for KYC submission.
 * The raw full name, date of birth, and document number are never sent anywhere - only this
 * one-way hash is submitted on-chain, so VendorDAO never receives or stores personal data.
 */
export async function hashKycDocument(
  fullName: string,
  dateOfBirth: string,
  documentNumber: string,
): Promise<Uint8Array> {
  const normalized = `${fullName.trim().toLowerCase()}|${dateOfBirth}|${documentNumber.trim().toUpperCase()}`;
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest);
}

export function bytesToHex(bytes: Uint8Array): string {
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
