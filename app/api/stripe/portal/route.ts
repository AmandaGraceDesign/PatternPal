import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-01-28.clover",
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

    // Validate origin to prevent session hijacking
    const ALLOWED_ORIGINS = [
      "https://pattern-tester.amandagracedesign.com",
      "https://www.pattern-tester.amandagracedesign.com",
      process.env.NEXT_PUBLIC_APP_URL, // Production URL from env
      process.env.APP_URL, // Legacy env var support
      ...(process.env.NODE_ENV === "development"
        ? ["http://localhost:3000", "http://localhost:3001"]
        : [])
    ].filter(Boolean);

    const requestOrigin = req.headers.get("origin");
    const isValidOrigin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin);

    if (!isValidOrigin) {
      console.error("Invalid origin attempted portal access:", requestOrigin);
      return NextResponse.json(
        { error: "Invalid origin", code: "invalid_origin" },
        { status: 403 }
      );
    }

    const returnUrl = requestOrigin;

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
