import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2025-12-15.clover",
});

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const stripeCustomerId = user.privateMetadata?.stripeCustomerId as
      | string
      | undefined;

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer on file" },
        { status: 400 }
      );
    }

    const origin = req.headers.get("origin");
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const allowedOrigins = [appUrl].filter(Boolean);
    const returnUrl = origin && allowedOrigins.includes(origin) ? origin : appUrl;

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("portal error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
