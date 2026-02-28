import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2025-12-15.clover",
});

type Plan = "monthly" | "yearly";

function getPriceId(plan: Plan) {
  if (plan === "monthly") return process.env.STRIPE_PRICE_MONTHLY;
  return process.env.STRIPE_PRICE_YEARLY;
}

// Hardcoded promo code configuration
// Key: lowercase code, Value: trial config
const PROMO_CODES: Record<string, { trialDays: number; description: string }> = {
  affiliate20: { trialDays: 120, description: "Affiliate 4-month free trial" },
};

export async function POST(req: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Missing env var: STRIPE_SECRET_KEY");
    }
    if (!process.env.STRIPE_PRICE_MONTHLY) {
      throw new Error("Missing env var: STRIPE_PRICE_MONTHLY");
    }
    if (!process.env.STRIPE_PRICE_YEARLY) {
      throw new Error("Missing env var: STRIPE_PRICE_YEARLY");
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized", code: "unauthorized" },
        { status: 401 }
      );
    }

    const { plan, referral, promoCode } = (await req.json()) as {
      plan?: Plan;
      referral?: string;
      promoCode?: string;
    };
    if (plan !== "monthly" && plan !== "yearly") {
      return NextResponse.json(
        { error: "Invalid plan", code: "invalid_plan" },
        { status: 400 }
      );
    }

    const priceId = getPriceId(plan);
    if (!priceId) {
      return NextResponse.json(
        {
          error: "Stripe price configuration is missing",
          code: "missing_price_id",
        },
        { status: 500 }
      );
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress;

    // Validate origin to prevent session hijacking and CSRF attacks
    const ALLOWED_ORIGINS = [
      "https://pattern-tester.amandagracedesign.com",
      "https://www.pattern-tester.amandagracedesign.com",
      process.env.NEXT_PUBLIC_APP_URL, // Production URL from env
      ...(process.env.NODE_ENV === "development"
        ? ["http://localhost:3000", "http://localhost:3001"]
        : [])
    ].filter(Boolean); // Remove any undefined values

    const requestOrigin = req.headers.get("origin");
    const isValidOrigin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin);

    if (!isValidOrigin) {
      console.error("Invalid origin attempted checkout:", requestOrigin);
      return NextResponse.json(
        { error: "Invalid origin", code: "invalid_origin" },
        { status: 403 }
      );
    }

    const origin = requestOrigin;

    // Validate promo code if provided
    let trialPeriodDays: number | undefined;
    let promoDescription: string | undefined;

    if (promoCode) {
      const normalizedCode = promoCode.trim().toLowerCase();
      const promoConfig = PROMO_CODES[normalizedCode];
      if (!promoConfig) {
        return NextResponse.json(
          { error: "Invalid promo code", code: "invalid_promo_code" },
          { status: 400 }
        );
      }
      trialPeriodDays = promoConfig.trialDays;
      promoDescription = promoConfig.description;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      allow_promotion_codes: !trialPeriodDays,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancel`,
      customer_email: email ?? undefined,
      client_reference_id: referral || userId,
      subscription_data: {
        metadata: {
          clerkUserId: userId,
          plan,
          ...(promoCode ? { promoCode: promoCode.trim().toLowerCase() } : {}),
        },
        description: promoDescription
          ? `PatternPal Pro Subscription (${promoDescription})`
          : "PatternPal Pro Subscription",
        ...(trialPeriodDays ? { trial_period_days: trialPeriodDays } : {}),
      },
      metadata: {
        clerkUserId: userId,
        plan,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const err = error as Error;
    console.error("[checkout]", err?.message, err?.stack);
    return NextResponse.json(
      { error: err?.message || "Server error", code: "server_error" },
      { status: 500 }
    );
  }
}
