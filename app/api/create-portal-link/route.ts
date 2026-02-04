import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth, clerkClient } from "@clerk/nextjs/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2025-12-15.clover",
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const customerId =
    (user.privateMetadata?.stripeCustomerId as string | undefined) ??
    (user.publicMetadata?.stripeCustomerId as string | undefined);

  if (!customerId) {
    return new NextResponse("No Stripe customer ID", { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
  });

  return NextResponse.json({ url: session.url });
}
