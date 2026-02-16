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

    const { plan } = (await req.json()) as { plan?: Plan };
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

    const origin = req.headers.get("origin") || "https://pattern-tester.amandagracedesign.com";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancel`,
      customer_email: email ?? undefined,
      client_reference_id: userId,
      subscription_data: {
        metadata: {
          clerkUserId: userId,
          plan,
        },
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
