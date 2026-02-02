import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2025-12-15.clover",
});

const allowedPriceIds = new Set(
  [process.env.STRIPE_PRICE_MONTHLY, process.env.STRIPE_PRICE_YEARLY].filter(
    (priceId): priceId is string => Boolean(priceId)
  )
);

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { priceId } = await req.json();
    if (!priceId || !allowedPriceIds.has(priceId)) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    const user = await clerkClient.users.getUser(userId);
    const existingPrivate = user.privateMetadata ?? {};
    let stripeCustomerId = existingPrivate.stripeCustomerId as string | undefined;

    if (!stripeCustomerId) {
      const email = user.emailAddresses?.[0]?.emailAddress;
      const customer = await stripe.customers.create({
        email: email ?? undefined,
        metadata: {
          clerkUserId: userId,
        },
      });
      stripeCustomerId = customer.id;

      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: {
          ...existingPrivate,
          stripeCustomerId,
        },
      });
    }

    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        clerkUserId: userId,
      },
    });

    const invoice = subscription.latest_invoice as Stripe.Invoice | null;
    const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent | null;

    await clerkClient.users.updateUserMetadata(userId, {
      privateMetadata: {
        ...existingPrivate,
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        stripeStatus: subscription.status,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent?.client_secret ?? null,
      subscriptionId: subscription.id,
    });
  } catch (error) {
    console.error("create-subscription error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
