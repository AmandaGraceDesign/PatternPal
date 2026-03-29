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
      window.pintrk?.('track', 'checkout', { value: 79.92, currency: 'USD' });
    } else {
      fireConversion('proTrialMonthly');
      window.pintrk?.('track', 'checkout', { value: 7.99, currency: 'USD' });
    }
  }, [searchParams]);

  return null;
}
