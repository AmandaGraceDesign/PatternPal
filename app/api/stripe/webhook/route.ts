import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { clerkClient } from "@clerk/nextjs/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
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
        },
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("Failed to update user metadata", err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
