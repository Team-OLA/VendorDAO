import { NextResponse } from "next/server";
import { issueToken, randomDigits } from "@/lib/server/verificationToken";

/** Issues a simple math CAPTCHA challenge (no third-party service/API key required). */
export async function POST() {
  const a = Number(randomDigits(1)) + 1;
  const b = Number(randomDigits(1)) + 1;
  const token = issueToken({ answer: String(a + b) }, 5 * 60 * 1000);
  return NextResponse.json({ token, question: `${a} + ${b}` });
}
