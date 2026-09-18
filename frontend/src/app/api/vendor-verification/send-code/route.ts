import { NextResponse } from "next/server";
import { sendVerificationEmail } from "@/lib/server/mailer";
import { issueToken, randomDigits, verifyToken } from "@/lib/server/verificationToken";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const captchaToken = typeof body?.captchaToken === "string" ? body.captchaToken : "";
  const captchaAnswer = typeof body?.captchaAnswer === "string" ? body.captchaAnswer.trim() : "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!captchaToken || !captchaAnswer) {
    return NextResponse.json({ error: "Complete the CAPTCHA challenge." }, { status: 400 });
  }

  const captcha = verifyToken<{ answer: string }>(captchaToken);
  if (!captcha) {
    return NextResponse.json(
      { error: "CAPTCHA challenge expired. Please try again." },
      { status: 400 },
    );
  }
  if (captcha.answer !== captchaAnswer) {
    return NextResponse.json({ error: "Incorrect CAPTCHA answer." }, { status: 400 });
  }

  const code = randomDigits(6);
  const verificationToken = issueToken({ email, code }, 10 * 60 * 1000);

  try {
    const result = await sendVerificationEmail(email, code);
    return NextResponse.json({ verificationToken, devCode: result.devCode });
  } catch (err) {
    console.error("Failed to send verification email:", err);
    return NextResponse.json({ error: "Failed to send verification email." }, { status: 502 });
  }
}
