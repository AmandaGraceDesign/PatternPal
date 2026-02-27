import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth, clerkClient } from "@clerk/nextjs/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2025-12-15.clover",
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
      // Don't log userId in production (GDPR compliance)
      if (process.env.NODE_ENV === "development") {
        console.error("[create-portal-link] Missing stripeCustomerId", { userId });
      } else {
        console.error("[create-portal-link] Missing stripeCustomerId");
      }
      return NextResponse.json({ error: "No Stripe customer ID" }, { status: 400 });
    }

    // Validate origin to prevent unauthorized portal link requests
    const ALLOWED_ORIGINS = [
      "https://pattern-tester.amandagracedesign.com",
      "https://www.pattern-tester.amandagracedesign.com",
      process.env.NEXT_PUBLIC_APP_URL,
      ...(process.env.NODE_ENV === "development"
        ? ["http://localhost:3000", "http://localhost:3001"]
        : [])
    ].filter(Boolean);

    const requestOrigin = req.headers.get("origin");
    if (requestOrigin && !ALLOWED_ORIGINS.includes(requestOrigin)) {
      console.error("[create-portal-link] Invalid origin:", requestOrigin);
      return NextResponse.json(
        { error: "Invalid origin", code: "invalid_origin" },
        { status: 403 }
      );
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
