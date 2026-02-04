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
  const body = await req.text();
  const buf = Buffer.from(body);
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      signature!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const error = err as Error;
    console.error("Webhook signature verification failed:", error.message);
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 });
  }

  console.log("[stripe-webhook] received event", event.type);

  const handleProUnlock = async (customerEmail: string, context: string) => {
    try {
      const client = await clerkClient();
      const users = await client.users.getUserList({
        emailAddress: [customerEmail],
      });

      const user = users.data[0];

      if (!user) {
        console.error("[stripe-webhook] Clerk user not found", {
          context,
          customerEmail,
        });
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      console.log("[stripe-webhook] Clerk user found", {
        context,
        customerEmail,
        userId: user.id,
      });

      await client.users.updateUser(user.id, {
        publicMetadata: {
          pro: true,
        },
      });

      console.log("[stripe-webhook] Pro access granted", {
        context,
        customerEmail,
        userId: user.id,
      });
      return NextResponse.json({ success: true });
    } catch (err) {
      const error = err as Error;
      console.error("[stripe-webhook] Clerk update error", {
        context,
        customerEmail,
        message: error.message,
      });
      return NextResponse.json({ error: "Clerk update failed" }, { status: 500 });
    }
  };

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerEmail =
      session.customer_email || session.customer_details?.email || null;

    if (!customerEmail) {
      console.error("[stripe-webhook] Missing customer email for session", {
        sessionId: session.id,
      });
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    return handleProUnlock(customerEmail, "checkout.session.completed");
  }

  if (event.type === "customer.subscription.created" || event.type === "invoice.paid") {
    const object = event.data.object as any;
    const customerEmail =
      object?.customer_email ||
      object?.customer_details?.email ||
      object?.email ||
      null;

    if (!customerEmail) {
      console.error("[stripe-webhook] Missing customer email for event", {
        eventType: event.type,
      });
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    return handleProUnlock(customerEmail, event.type);
  }

  return NextResponse.json({ received: true });
}
