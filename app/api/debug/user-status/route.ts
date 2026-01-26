import { NextResponse } from "next/server";
import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server";

/**
 * Debug endpoint to check current user's Pro status
 * Access at: /api/debug/user-status
 */
export async function GET() {
  try {
    const { userId } = clerkAuth();

    if (!userId) {
      return NextResponse.json({
        error: "Not authenticated",
        isSignedIn: false,
      });
    }

    const user = await currentUser();

    if (!user) {
      return NextResponse.json({
        error: "User not found",
        isSignedIn: false,
      });
    }

    const metadata = user.publicMetadata as any;

    // Check Pro status in multiple formats
    let isPro = false;
    let proSource = "none";

    // Format 1: Simple isPro boolean
    if (metadata?.isPro === true) {
      isPro = true;
      proSource = "isPro flag";
    }

    // Format 2: plan === 'patternpal_pro' with proUntil date
    if (metadata?.plan === 'patternpal_pro' && metadata?.proUntil) {
      const proUntilDate = new Date(metadata.proUntil);
      const now = new Date();
      if (proUntilDate > now) {
        isPro = true;
        proSource = `plan with expiry (${metadata.proUntil})`;
      } else {
        proSource = `plan expired (${metadata.proUntil})`;
      }
    }

    return NextResponse.json({
      isSignedIn: true,
      userId: user.id,
      email: user.emailAddresses?.[0]?.emailAddress,
      isPro,
      proSource,
      publicMetadata: user.publicMetadata,
      privateMetadata: user.privateMetadata,
      message: isPro
        ? `✅ User has Pro access (via ${proSource})`
        : `❌ User does NOT have Pro access`,
    });
  } catch (error) {
    console.error("Error checking user status:", error);
    return NextResponse.json({
      error: "Failed to check user status",
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
