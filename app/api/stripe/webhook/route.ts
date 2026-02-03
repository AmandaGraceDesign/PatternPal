import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2025-12-15.clover",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

async function applyProSubscription({
  client,
  subscriptionId,
  clerkUserId,
}: {
  client: Awaited<ReturnType<typeof clerkClient>>;
  subscriptionId: string;
  clerkUserId: string;
}) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
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

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const sessionWithMeta = session as Stripe.Checkout.Session & {
        client_reference_id?: string | null;
        metadata?: { clerkUserId?: string | null };
      };
      const clerkUserId =
        sessionWithMeta.client_reference_id ??
        sessionWithMeta.metadata?.clerkUserId ??
        null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

      if (!clerkUserId || !subscriptionId) {
        console.warn("[stripe-webhook] session missing clerkUserId or subscription", {
          sessionId: session.id,
          clerkUserId,
          subscriptionId,
        });
        return NextResponse.json({ received: true });
      }

      await applyProSubscription({ client, subscriptionId, clerkUserId });
    }

    if (event.type === "customer.subscription.created") {
      const subscription = event.data.object as Stripe.Subscription;
      const clerkUserId = subscription.metadata?.clerkUserId;
      if (!clerkUserId) {
        console.error("[stripe-webhook] subscription missing clerkUserId", subscription.id);
        return NextResponse.json({ received: true });
      }

      await applyProSubscription({
        client,
        subscriptionId: subscription.id,
        clerkUserId,
      });
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceWithSubscription =
        invoice as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
          subscription_details?: { subscription?: string | null };
        };
      const subscriptionId =
        typeof invoiceWithSubscription.subscription === "string"
          ? invoiceWithSubscription.subscription
          : invoiceWithSubscription.subscription?.id ??
            invoiceWithSubscription.subscription_details?.subscription;
      if (!subscriptionId) {
        console.warn("[stripe-webhook] no subscriptionId on invoice", invoice.id);
        return NextResponse.json({ received: true });
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const clerkUserId = subscription.metadata?.clerkUserId;
      if (!clerkUserId) {
        console.error("[stripe-webhook] subscription missing clerkUserId", subscriptionId);
        return NextResponse.json({ received: true });
      }

      await applyProSubscription({ client, subscriptionId, clerkUserId });
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
      const invoiceWithSubscription =
        invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
      const subscriptionId =
        typeof invoiceWithSubscription.subscription === "string"
          ? invoiceWithSubscription.subscription
          : invoiceWithSubscription.subscription?.id ?? null;
      console.error("[stripe-webhook] payment failed", {
        invoiceId: invoice.id,
        subscriptionId,
        customerId: invoice.customer,
      });
    }
  } catch (error) {
    console.error("[stripe-webhook] handler error", error);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
