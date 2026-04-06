'use client';

import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { fireConversion } from '@/lib/gtag';

const SIGNUP_FIRED_KEY = 'pp_signup_conversion_fired';

/**
 * Fires a Google Ads free-signup conversion once when a newly
 * created user is first detected (Clerk account created within
 * the last 60 seconds and conversion not already recorded).
 */
export default function SignupConversion() {
  const { user, isSignedIn } = useUser();
  const firedRef = useRef(false);

  useEffect(() => {
    if (!isSignedIn || !user || firedRef.current) return;

    // Only fire for accounts created in the last 60 seconds
    const createdAt = user.createdAt ? new Date(user.createdAt).getTime() : 0;
    const isNewAccount = Date.now() - createdAt < 60_000;

    if (!isNewAccount) return;

    // Prevent duplicate fires across re-renders / tabs
    if (sessionStorage.getItem(SIGNUP_FIRED_KEY)) return;

    firedRef.current = true;
    sessionStorage.setItem(SIGNUP_FIRED_KEY, '1');
    fireConversion('freeSignup');
    window.pintrk?.('track', 'signup', { value: 0, currency: 'USD' });
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'sign_up' });
  }, [isSignedIn, user]);

  return null;
}
