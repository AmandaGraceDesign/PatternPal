import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth, clerkClient } from "@clerk/nextjs/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-01-28.clover",
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const customerId = user.privateMetadata?.stripeCustomerId as string | undefined;

    if (!customerId) {
      console.error("[create-portal-link] Missing stripeCustomerId", { userId });
      return NextResponse.json({ error: "No Stripe customer ID" }, { status: 400 });
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://pattern-tester.amandagracedesign.com";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[create-portal-link] Failed to create portal link", error);
    return NextResponse.json({ error: "Failed to create portal link" }, { status: 500 });
  }
}
