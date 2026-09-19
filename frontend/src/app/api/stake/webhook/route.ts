import { NextResponse } from "next/server";
import { mintStakedTokens } from "@/lib/server/chainSigner";

/**
 * Stripe webhook: on a completed checkout, mints the corresponding VDAO for the address that
 * initiated the stake (see src/app/api/stake/create-checkout-session/route.ts). Configure this
 * URL (https://your-domain/api/stake/webhook) in the Stripe dashboard and set STRIPE_WEBHOOK_SECRET
 * to the signing secret Stripe gives you for it.
 */
export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe is not configured on the server." }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const payload = await request.text();
  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(secretKey);

  let event: import("stripe").Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as import("stripe").Stripe.Checkout.Session;
    const address = session.metadata?.address;
    const vdaoAmount = Number(session.metadata?.vdaoAmount);
    if (address && Number.isFinite(vdaoAmount) && vdaoAmount > 0) {
      try {
        await mintStakedTokens(address, vdaoAmount);
      } catch (err) {
        console.error("Failed to mint staked tokens after Stripe payment:", err);
        // Stripe retries webhooks on non-2xx responses, so surface this as a failure.
        return NextResponse.json({ error: "Failed to mint staked tokens." }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
