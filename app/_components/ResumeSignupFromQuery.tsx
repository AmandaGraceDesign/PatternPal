'use client';

import { useEffect } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function ResumeSignupFromQuery() {
  const { isSignedIn, isLoaded } = useUser();
  const { openSignUp } = useClerk();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoaded || !searchParams) return;
    if (searchParams.get('signup') !== '1') return;

    if (!isSignedIn) {
      openSignUp?.();
    }

    // Clean up the URL param whether signed in or not
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('signup');
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname ?? '/'}?${nextQuery}` : (pathname ?? '/'), { scroll: false });
  }, [isLoaded, isSignedIn, openSignUp, pathname, router, searchParams]);

  return null;
}
