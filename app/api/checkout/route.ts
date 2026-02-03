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
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan } = (await req.json()) as { plan?: Plan };
    if (plan !== "monthly" && plan !== "yearly") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const priceId = getPriceId(plan);
    if (!priceId) {
      return NextResponse.json(
        { error: "Stripe price configuration is missing" },
        { status: 500 }
      );
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress;

    const origin = req.headers.get("origin");
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const allowedOrigins = [appUrl, "http://localhost:3000"].filter(Boolean);
    const returnUrl = origin && allowedOrigins.includes(origin) ? origin : appUrl;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${returnUrl}/?checkout=success`,
      cancel_url: `${returnUrl}/?checkout=cancel`,
      customer_email: email ?? undefined,
      client_reference_id: userId,
      metadata: {
        clerkUserId: userId,
        plan,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("checkout error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
