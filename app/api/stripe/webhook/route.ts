import { clerkClient } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: Request) {
  const buf = await req.arrayBuffer();
  const rawBody = Buffer.from(buf);
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const error = err as Error;
    console.error("Webhook signature verification failed:", error.message);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  const relevantEvents = [
    "checkout.session.completed",
    "customer.subscription.created",
    "invoice.paid",
  ];

  if (relevantEvents.includes(event.type)) {
    const object = event.data.object as any;

    const customerEmail =
      object?.customer_email ||
      object?.customer_details?.email ||
      object?.email;

    if (!customerEmail) {
      console.error("No email found in webhook payload:", object);
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    try {
      const client = await clerkClient();
      const users = await client.users.getUserList({
        emailAddress: [customerEmail],
      });

      const user = users.data[0];

      if (!user) {
        console.error(`No Clerk user found with email: ${customerEmail}`);
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      await client.users.updateUser(user.id, {
        publicMetadata: {
          pro: true,
        },
      });

      console.log(`Pro access granted to: ${customerEmail}`);
      return NextResponse.json({ success: true });
    } catch (err) {
      const error = err as Error;
      console.error("Clerk update error:", error.message);
      return NextResponse.json({ error: "Clerk update failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
