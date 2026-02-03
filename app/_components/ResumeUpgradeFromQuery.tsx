'use client';

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function ResumeUpgradeFromQuery() {
  const { isSignedIn } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isSignedIn) return;
    if (searchParams.get('upgrade') !== '1') return;

    const planParam = searchParams.get('plan');
    const plan = planParam === 'yearly' ? 'yearly' : 'monthly';
    window.dispatchEvent(new CustomEvent('pp:resume-upgrade', { detail: { plan } }));

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('upgrade');
    nextParams.delete('plan');
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [isSignedIn, pathname, router, searchParams]);

  return null;
}
