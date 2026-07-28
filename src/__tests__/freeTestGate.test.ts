// src/__tests__/freeTestGate.test.ts
import { describe, it, expect } from 'vitest';
import {
  MAX_FREE_TESTS,
  freeTestDecision,
  shouldCountFreeTest,
  type AuthState,
} from '../lib/freeTestGate';

/** Clerk's three real states. `isSignedIn` is `undefined` while loading, never `false`. */
const LOADING: AuthState = { isAuthLoaded: false, isSignedIn: undefined };
const SIGNED_OUT: AuthState = { isAuthLoaded: true, isSignedIn: false };
const SIGNED_IN: AuthState = { isAuthLoaded: true, isSignedIn: true };

describe('freeTestDecision', () => {
  it('allows an anonymous visitor under the limit', () => {
    expect(freeTestDecision(SIGNED_OUT, 0)).toBe('allow');
    expect(freeTestDecision(SIGNED_OUT, MAX_FREE_TESTS - 1)).toBe('allow');
  });

  it('prompts an anonymous visitor at the limit', () => {
    expect(freeTestDecision(SIGNED_OUT, MAX_FREE_TESTS)).toBe('prompt-sign-in');
    expect(freeTestDecision(SIGNED_OUT, MAX_FREE_TESTS + 5)).toBe('prompt-sign-in');
  });

  it('never prompts a signed-in user, whatever the stale counter says', () => {
    expect(freeTestDecision(SIGNED_IN, MAX_FREE_TESTS)).toBe('allow');
    expect(freeTestDecision(SIGNED_IN, 99)).toBe('allow');
  });

  // The reported bug: signed-in users were shown the sign-in modal on nearly
  // every paste, because during Clerk's load window `isSignedIn` is `undefined`
  // and a maxed-out localStorage counter from their anonymous visit survives.
  it('does not prompt while Clerk is still loading, even at the limit', () => {
    expect(freeTestDecision(LOADING, MAX_FREE_TESTS)).toBe('allow');
    expect(freeTestDecision(LOADING, 99)).toBe('allow');
  });
});

describe('shouldCountFreeTest', () => {
  it('counts tests for an anonymous visitor', () => {
    expect(shouldCountFreeTest(SIGNED_OUT)).toBe(true);
  });

  it('does not count tests for a signed-in user', () => {
    expect(shouldCountFreeTest(SIGNED_IN)).toBe(false);
  });

  // Counting during the load window is how a signed-in user's counter reached
  // the cap in the first place — every fast paste after a reload incremented it.
  it('does not count tests while Clerk is still loading', () => {
    expect(shouldCountFreeTest(LOADING)).toBe(false);
  });
});
