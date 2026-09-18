import { NextResponse } from "next/server";
import { issueToken, verifyToken } from "@/lib/server/verificationToken";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const verificationToken = typeof body?.verificationToken === "string" ? body.verificationToken : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!verificationToken || !code) {
    return NextResponse.json({ error: "Missing verification token or code." }, { status: 400 });
  }

  const payload = verifyToken<{ email: string; code: string }>(verificationToken);
  if (!payload) {
    return NextResponse.json(
      { error: "Verification code expired. Request a new one." },
      { status: 400 },
    );
  }
  if (payload.code !== code) {
    return NextResponse.json({ error: "Incorrect verification code." }, { status: 400 });
  }

  // Short-lived proof that this email was verified; used only to unlock the registration
  // form client-side. It is not (and cannot be) enforced on-chain — the chain has no
  // knowledge of email addresses at all.
  const proof = issueToken({ email: payload.email }, 30 * 60 * 1000);
  return NextResponse.json({ verified: true, email: payload.email, proof });
}
