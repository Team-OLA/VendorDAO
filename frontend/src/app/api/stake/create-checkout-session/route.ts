import { NextResponse } from "next/server";

const MIN_USD = 1;
const MAX_USD = 10_000;

export async function POST(request: Request) {
  let body: { amountUsd?: number; address?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { amountUsd, address } = body;
  if (!address || typeof amountUsd !== "number" || !Number.isFinite(amountUsd)) {
    return NextResponse.json({ error: '"address" and numeric "amountUsd" are required.' }, { status: 400 });
  }
  if (amountUsd < MIN_USD || amountUsd > MAX_USD) {
    return NextResponse.json(
      { error: `Amount must be between $${MIN_USD} and $${MAX_USD}.` },
      { status: 400 },
    );
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    // Not a hard error: the frontend falls back to a simulated checkout flow for local/demo use.
    return NextResponse.json({ configured: false });
  }

  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(secretKey);
    const origin = request.headers.get("origin") ?? new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `VendorDAO stake — ${amountUsd} VDAO` },
            unit_amount: Math.round(amountUsd * 100),
          },
          quantity: 1,
        },
      ],
      metadata: { address, vdaoAmount: String(amountUsd) },
      success_url: `${origin}/stake?success=1`,
      cancel_url: `${origin}/stake?canceled=1`,
    });

    return NextResponse.json({ configured: true, url: session.url });
  } catch (err) {
    console.error("Stripe checkout session error:", err);
    const message = err instanceof Error ? err.message : "Failed to create checkout session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
