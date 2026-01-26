import { NextResponse } from "next/server";
import { auth as clerkAuth, clerkClient } from "@clerk/nextjs/server";

/**
 * Debug endpoint to grant Pro status to current user
 * Access at: /api/debug/grant-pro
 *
 * WARNING: This is for development/testing only!
 * Remove or protect this endpoint in production.
 */
export async function POST() {
  try {
    const { userId } = clerkAuth();

    if (!userId) {
      return NextResponse.json({
        error: "Not authenticated",
        message: "You must be signed in to use this endpoint",
      }, { status: 401 });
    }

    // Get current user metadata
    const user = await clerkClient.users.getUser(userId);
    const existingPublic = user.publicMetadata ?? {};

    // Update user metadata to grant Pro status
    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...existingPublic,
        isPro: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "✅ Pro access granted!",
      userId,
      email: user.emailAddresses?.[0]?.emailAddress,
      note: "Refresh the page to see changes take effect",
    });
  } catch (error) {
    console.error("Error granting Pro status:", error);
    return NextResponse.json({
      error: "Failed to grant Pro status",
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
