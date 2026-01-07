// Placeholder auth system
// TODO: Replace with actual Supabase auth implementation

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
  // Placeholder: Always returns no user (not Pro)
  // Replace this with actual Supabase auth check:
  // const { data: { session } } = await supabase.auth.getSession();
  // return { user: session?.user ? { ...session.user, isPro: checkProStatus(session.user.id) } : null };
  
  return {
    user: null,
  };
}

/**
 * Check if a user has Pro subscription
 * TODO: Implement with database query
 */
export async function checkProStatus(userId: string): Promise<boolean> {
  // Placeholder: Always returns false
  // Replace with actual database check:
  // const { data } = await supabase.from('subscriptions').select('*').eq('user_id', userId).eq('plan', 'pro').single();
  // return !!data && data.status === 'active';
  
  return false;
}
