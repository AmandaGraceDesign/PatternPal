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
 * TODO: Implement with Supabase auth
 */
export async function auth(): Promise<Session> {
  const { userId } = clerkAuth();
  if (!userId) {
    return { user: null };
  }

  const user = await currentUser();
  if (!user) {
    return { user: null };
  }

  const email = user.emailAddresses?.[0]?.emailAddress;
  const isPro = Boolean(user.publicMetadata?.isPro);

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
 * TODO: Implement with database query
 */
export async function checkProStatus(userId: string): Promise<boolean> {
  const user = await clerkClient.users.getUser(userId);
  return Boolean(user.publicMetadata?.isPro);
}
