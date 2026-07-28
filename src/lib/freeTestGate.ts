// src/lib/freeTestGate.ts
/**
 * The anonymous "3 free tests then sign up" gate.
 *
 * Extracted from app/page.tsx so the decision is testable, because it has one
 * sharp edge: Clerk's useUser() returns `isSignedIn: undefined` (NOT `false`)
 * until ClerkJS has finished loading. Branching on `isSignedIn` alone therefore
 * treats every page load's loading window as "signed out", which pops the
 * sign-in modal at users who are already signed in.
 */

export const FREE_TESTS_KEY = 'pp_free_tests_used';
export const MAX_FREE_TESTS = 3;

export interface AuthState {
  /** Clerk has resolved the session. While false, `isSignedIn` is `undefined`. */
  isAuthLoaded: boolean;
  /** `undefined` while Clerk is still loading. */
  isSignedIn: boolean | undefined;
}

export type FreeTestDecision = 'allow' | 'prompt-sign-in';

/**
 * Whether a pattern test may run, or the sign-in modal should be opened instead.
 *
 * While auth is unresolved we always allow: a paste/upload cannot be deferred
 * (clipboard data is only readable synchronously inside the event), and wrongly
 * blocking a signed-in user is far worse than letting an anonymous visitor slip
 * one extra test past the counter.
 */
export function freeTestDecision(auth: AuthState, testsUsed: number): FreeTestDecision {
  if (!auth.isAuthLoaded) return 'allow';
  if (auth.isSignedIn) return 'allow';
  return testsUsed >= MAX_FREE_TESTS ? 'prompt-sign-in' : 'allow';
}

/**
 * Whether this test should increment the anonymous counter.
 *
 * Unresolved auth must not count, or signed-in users silently accumulate
 * "free tests used" on every load and drift into the locked-out state above.
 */
export function shouldCountFreeTest(auth: AuthState): boolean {
  if (!auth.isAuthLoaded) return false;
  return !auth.isSignedIn;
}
