import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkProStatus } from "@/lib/auth";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isPro = await checkProStatus(userId);
    if (!isPro) {
      return NextResponse.json({ error: "Pro required" }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("pro verify error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
