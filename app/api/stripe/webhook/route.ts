import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { clerkClient } from "@clerk/nextjs/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
});

export async function POST(req: Request) {
  const rawBody = await req.text();
  const sig = (await headers()).get("stripe-signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const error = err as Error;
    console.error("Webhook signature verification failed.", error.message);
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }

  // Handle subscription created - grant Pro access
  if (event.type === "customer.subscription.created") {
    const subscription = event.data.object as Stripe.Subscription;

    try {
      const customer = await stripe.customers.retrieve(subscription.customer as string);
      const email = (customer as Stripe.Customer).email;

      if (!email) {
        return NextResponse.json({ error: "Missing email" }, { status: 400 });
      }

      const client = await clerkClient();
      const users = await client.users.getUserList({ emailAddress: [email] });

      if (!users.data.length) {
        return NextResponse.json({ error: "No Clerk user found" }, { status: 404 });
      }

      const user = users.data[0];
      const existingPublic = user.publicMetadata ?? {};
      const existingPrivate = user.privateMetadata ?? {};
      const stripeCustomerId = (customer as Stripe.Customer).id;

      await client.users.updateUser(user.id, {
        publicMetadata: {
          ...existingPublic,
          pro: true,
        },
        privateMetadata: {
          ...existingPrivate,
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
        },
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("Failed to update user metadata", err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }

  // Handle subscription updated - check status changes
  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;

    try {
      const customer = await stripe.customers.retrieve(subscription.customer as string);
      const email = (customer as Stripe.Customer).email;

      if (!email) {
        return NextResponse.json({ error: "Missing email" }, { status: 400 });
      }

      const client = await clerkClient();
      const users = await client.users.getUserList({ emailAddress: [email] });

      if (!users.data.length) {
        return NextResponse.json({ error: "No Clerk user found" }, { status: 404 });
      }

      const user = users.data[0];
      const existingPublic = user.publicMetadata ?? {};

      // Revoke Pro access if subscription is canceled, incomplete, past_due, or unpaid
      const inactiveStatuses = ['canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid'];
      const shouldRevokePro = inactiveStatuses.includes(subscription.status);

      await client.users.updateUser(user.id, {
        publicMetadata: {
          ...existingPublic,
          pro: !shouldRevokePro,
        },
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("Failed to update user metadata on subscription update", err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }

  // Handle subscription deleted - revoke Pro access
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;

    try {
      const customer = await stripe.customers.retrieve(subscription.customer as string);
      const email = (customer as Stripe.Customer).email;

      if (!email) {
        return NextResponse.json({ error: "Missing email" }, { status: 400 });
      }

      const client = await clerkClient();
      const users = await client.users.getUserList({ emailAddress: [email] });

      if (!users.data.length) {
        return NextResponse.json({ error: "No Clerk user found" }, { status: 404 });
      }

      const user = users.data[0];
      const existingPublic = user.publicMetadata ?? {};

      await client.users.updateUser(user.id, {
        publicMetadata: {
          ...existingPublic,
          pro: false,
        },
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("Failed to revoke Pro access on subscription deletion", err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }

  // Handle invoice payment failed - revoke Pro access
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;

    try {
      const customer = await stripe.customers.retrieve(invoice.customer as string);
      const email = (customer as Stripe.Customer).email;

      if (!email) {
        return NextResponse.json({ error: "Missing email" }, { status: 400 });
      }

      const client = await clerkClient();
      const users = await client.users.getUserList({ emailAddress: [email] });

      if (!users.data.length) {
        return NextResponse.json({ error: "No Clerk user found" }, { status: 404 });
      }

      const user = users.data[0];
      const existingPublic = user.publicMetadata ?? {};

      // Revoke Pro access when payment fails
      await client.users.updateUser(user.id, {
        publicMetadata: {
          ...existingPublic,
          pro: false,
        },
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("Failed to revoke Pro access on payment failure", err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
