import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2025-12-15.clover",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

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
    console.error("[stripe-webhook] signature error", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const client = await clerkClient();

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;
      if (!subscriptionId) {
        console.error("[stripe-webhook] invoice missing subscription", invoice.id);
        return NextResponse.json({ received: true });
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const clerkUserId = subscription.metadata?.clerkUserId;
      if (!clerkUserId) {
        console.error("[stripe-webhook] subscription missing clerkUserId", subscriptionId);
        return NextResponse.json({ received: true });
      }

      const stripeCustomerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;
      const stripePriceId = subscription.items.data[0]?.price?.id;

      const user = await client.users.getUser(clerkUserId);
      const existingPrivate = user.privateMetadata ?? {};
      const existingPublic = user.publicMetadata ?? {};

      await client.users.updateUserMetadata(clerkUserId, {
        publicMetadata: {
          ...existingPublic,
          pro: true,
          proSince: new Date().toISOString(),
          proPlan: stripePriceId ?? null,
        },
        privateMetadata: {
          ...existingPrivate,
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          stripeStatus: subscription.status,
          stripePriceId,
        },
      });

      console.log("[stripe-webhook] pro unlocked", {
        clerkUserId,
        subscriptionId,
        stripePriceId,
      });
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const clerkUserId = subscription.metadata?.clerkUserId;
      if (!clerkUserId) {
        console.error("[stripe-webhook] subscription missing clerkUserId", subscription.id);
        return NextResponse.json({ received: true });
      }

      const user = await client.users.getUser(clerkUserId);
      const existingPrivate = user.privateMetadata ?? {};
      const existingPublic = user.publicMetadata ?? {};

      await client.users.updateUserMetadata(clerkUserId, {
        publicMetadata: {
          ...existingPublic,
          pro: false,
        },
        privateMetadata: {
          ...existingPrivate,
          stripeStatus: subscription.status,
          stripeCanceledAt: new Date().toISOString(),
        },
      });

      console.log("[stripe-webhook] pro revoked", { clerkUserId, subscriptionId: subscription.id });
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      console.error("[stripe-webhook] payment failed", {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription,
        customerId: invoice.customer,
      });
    }
  } catch (error) {
    console.error("[stripe-webhook] handler error", error);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
