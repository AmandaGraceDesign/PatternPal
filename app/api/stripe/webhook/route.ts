import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2024-06-20",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

function isProStatus(status: Stripe.Subscription.Status) {
  return status === "active" || status === "trialing";
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const payload = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error("Webhook signature error", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const clerkUserId = subscription.metadata?.clerkUserId;
    if (clerkUserId) {
      const stripeCustomerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      const user = await clerkClient.users.getUser(clerkUserId);
      const existingPrivate = user.privateMetadata ?? {};
      const existingPublic = user.publicMetadata ?? {};

      await clerkClient.users.updateUserMetadata(clerkUserId, {
        publicMetadata: {
          ...existingPublic,
          isPro: isProStatus(subscription.status),
        },
        privateMetadata: {
          ...existingPrivate,
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: subscription.items.data[0]?.price?.id,
          stripeStatus: subscription.status,
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
