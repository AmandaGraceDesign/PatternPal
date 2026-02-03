import { auth as clerkAuth, clerkClient, currentUser } from "@clerk/nextjs/server";

export interface User {
  id: string;
  email?: string;
  isPro: boolean;
}

export interface Session {
  user: User | null;
}

/**
 * Get the current session
 * Checks for Pro status in publicMetadata.pro.
 */
export async function auth(): Promise<Session> {
  const { userId } = await clerkAuth();
  if (!userId) {
    return { user: null };
  }

  const user = await currentUser();
  if (!user) {
    return { user: null };
  }

  const email = user.emailAddresses?.[0]?.emailAddress;
  const metadata = user.publicMetadata as any;

  const isPro = metadata?.pro === true;

  return {
    user: {
      id: user.id,
      email,
      isPro,
    },
  };
}

/**
 * Check if a user has Pro subscription
 * Uses publicMetadata.pro.
 */
export async function checkProStatus(userId: string): Promise<boolean> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const metadata = user.publicMetadata as any;

  return metadata?.pro === true;
}

/**
 * Require an authenticated Pro user (server-side).
 */
export async function requireProUser(): Promise<{ userId: string; isPro: true }> {
  const { userId } = await clerkAuth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const isPro = await checkProStatus(userId);
  if (!isPro) {
    throw new Error("Pro required");
  }

  return { userId, isPro: true };
}
