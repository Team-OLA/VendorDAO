import { NextResponse } from "next/server";

/**
 * Creates a Stripe Identity verification session (document + selfie check) for a resident
 * completing KYC before requesting ward-scoped voting rights. Not a hard requirement to use
 * VendorDAO: if Stripe isn't configured, the frontend falls back to a self-attested KYC request
 * that still requires city admin review via `vendorDao.setKycStatus`.
 */
export async function POST() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ configured: false });
  }

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(secretKey);

    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      options: { document: { require_matching_selfie: true } },
    });

    return NextResponse.json({
      configured: true,
      clientSecret: session.client_secret,
      sessionId: session.id,
    });
  } catch (err) {
    console.error("Stripe Identity verification session error:", err);
    const message = err instanceof Error ? err.message : "Failed to start identity verification.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
