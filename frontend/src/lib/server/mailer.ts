import nodemailer from "nodemailer";

export interface SendResult {
  sent: boolean;
  /** Only populated when SMTP isn't configured, so the UI can show the code for local testing. */
  devCode?: string;
}

/**
 * Sends a verification code by email via SMTP (configure SMTP_HOST/PORT/USER/PASS/FROM).
 * Falls back to returning the code directly (never actually emailed) when SMTP isn't
 * configured, so the vendor-registration flow stays testable without real credentials.
 */
export async function sendVerificationEmail(to: string, code: string): Promise<SendResult> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    return { sent: false, devCode: code };
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "VendorDAO <no-reply@vendordao.example>",
    to,
    subject: "Your VendorDAO verification code",
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your VendorDAO verification code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
  });

  return { sent: true };
}
