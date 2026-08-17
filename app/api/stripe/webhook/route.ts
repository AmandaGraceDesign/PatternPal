import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { clerkClient } from "@clerk/nextjs/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

// Statuses that entitle a user to Pro. `trialing` counts - the app grants Pro
// during the 3-day trial.
const ENTITLED_STATUSES: Stripe.Subscription.Status[] = ["active", "trialing"];

/**
 * One email can own several Stripe customer records (the app creates a new
 * customer when someone re-subscribes), each with its own subscriptions - one
 * dead, one live. Events on the dead one must never revoke Pro from a customer
 * whose live subscription is paid.
 *
 * Returns true if ANY subscription on ANY customer record for this email is
 * `active` or `trialing`, ignoring the subscription the current event is
 * revoking (compared by id) so a genuine final cancellation still revokes.
 *
 * Fails SAFE: if Stripe errors, this returns true so the caller skips the
 * revoke. Leaving a paying customer entitled is the acceptable failure; locking
 * one out is not.
 */
async function hasAnyActiveSubscription(
  email: string,
  excludeSubscriptionId: string | null
): Promise<boolean> {
  try {
    const customers = await stripe.customers.list({ email, limit: 100 });

    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 100,
      });

      const entitling = subscriptions.data.find(
        (sub) =>
          sub.id !== excludeSubscriptionId &&
          ENTITLED_STATUSES.includes(sub.status)
      );

      if (entitling) {
        console.log(
          `[entitlement] active subscription found for ${email}: ${entitling.id} (${entitling.status}) on customer ${customer.id}`
        );
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error(
      `[entitlement] hasAnyActiveSubscription failed for ${email} - treating as entitled and skipping revoke`,
      err
    );
    return true;
  }
}

/**
 * Resolve the subscription id an invoice was generated from. On API versions
 * from 2025-04-30 onwards this lives under `parent.subscription_details`.
 */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription;

  if (!subscription) {
    return null;
  }

  return typeof subscription === "string" ? subscription : subscription.id;
}

function logSkippedRevoke(
  email: string,
  eventType: string,
  subscriptionId: string | null
): void {
  console.log(
    `[entitlement] SKIPPED revoke for ${email} on ${eventType} - another subscription is still active (event subscription: ${subscriptionId ?? "unknown"})`
  );
}

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

      // Only revoke when this email has no other entitling subscription.
      if (shouldRevokePro && (await hasAnyActiveSubscription(email, subscription.id))) {
        logSkippedRevoke(email, event.type, subscription.id);
        return NextResponse.json({ received: true, revokeSkipped: true });
      }

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

      // Only revoke when this email has no other entitling subscription.
      if (await hasAnyActiveSubscription(email, subscription.id)) {
        logSkippedRevoke(email, event.type, subscription.id);
        return NextResponse.json({ received: true, revokeSkipped: true });
      }

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

  // Handle trial ending soon - opportunity to notify user
  if (event.type === "customer.subscription.trial_will_end") {
    const subscription = event.data.object as Stripe.Subscription;

    try {
      const customer = await stripe.customers.retrieve(subscription.customer as string);
      const email = (customer as Stripe.Customer).email;

      if (email) {
        console.log(`Trial ending soon for ${email}, subscription ${subscription.id}`);
        // Future: send email notification to user about trial ending
      }

      return NextResponse.json({ received: true });
    } catch (err) {
      console.error("Failed to process trial_will_end event", err);
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
      const failedSubscriptionId = subscriptionIdFromInvoice(invoice);

      // A failing invoice on a stale subscription must not revoke Pro from a
      // customer whose live subscription is paid (or trialing).
      if (await hasAnyActiveSubscription(email, failedSubscriptionId)) {
        logSkippedRevoke(email, event.type, failedSubscriptionId);
        return NextResponse.json({ received: true, revokeSkipped: true });
      }

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
