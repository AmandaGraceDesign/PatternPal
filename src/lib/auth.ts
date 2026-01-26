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
 * Checks for Pro status in multiple formats:
 * 1. publicMetadata.isPro (legacy/simple format)
 * 2. publicMetadata.plan === 'patternpal_pro' with proUntil date
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
  const metadata = user.publicMetadata as any;

  // Check Pro status in multiple formats
  let isPro = false;

  // Format 1: Simple isPro boolean
  if (metadata?.isPro === true) {
    isPro = true;
  }

  // Format 2: plan === 'patternpal_pro' with proUntil date
  if (metadata?.plan === 'patternpal_pro' && metadata?.proUntil) {
    const proUntilDate = new Date(metadata.proUntil);
    const now = new Date();
    isPro = proUntilDate > now; // Pro if subscription hasn't expired
  }

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
 * Checks for Pro status in multiple formats:
 * 1. publicMetadata.isPro (legacy/simple format)
 * 2. publicMetadata.plan === 'patternpal_pro' with proUntil date
 */
export async function checkProStatus(userId: string): Promise<boolean> {
  const user = await clerkClient.users.getUser(userId);
  const metadata = user.publicMetadata as any;

  // Format 1: Simple isPro boolean
  if (metadata?.isPro === true) {
    return true;
  }

  // Format 2: plan === 'patternpal_pro' with proUntil date
  if (metadata?.plan === 'patternpal_pro' && metadata?.proUntil) {
    const proUntilDate = new Date(metadata.proUntil);
    const now = new Date();
    return proUntilDate > now; // Pro if subscription hasn't expired
  }

  return false;
}
