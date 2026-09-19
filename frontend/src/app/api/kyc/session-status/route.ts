import { NextResponse } from "next/server";

/** Polled by the /kyc page after the Stripe Identity modal closes, to read back the result. */
export async function GET(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ configured: false });
  }

  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: '"sessionId" query parameter is required.' }, { status: 400 });
  }

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(secretKey);
    const session = await stripe.identity.verificationSessions.retrieve(sessionId);
    return NextResponse.json({ configured: true, status: session.status });
  } catch (err) {
    console.error("Stripe Identity session status error:", err);
    const message = err instanceof Error ? err.message : "Failed to check verification status.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
