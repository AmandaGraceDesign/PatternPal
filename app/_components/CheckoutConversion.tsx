'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { fireConversion } from '@/lib/gtag';

/**
 * Fires a Google Ads purchase conversion when the user returns
 * from Stripe checkout with ?checkout=success&plan=monthly|yearly.
 */
export default function CheckoutConversion() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams?.get('checkout') !== 'success') return;

    const plan = searchParams.get('plan');
    if (plan === 'yearly') {
      fireConversion('proTrialAnnual');
    } else {
      fireConversion('proTrialMonthly');
    }
  }, [searchParams]);

  return null;
}
