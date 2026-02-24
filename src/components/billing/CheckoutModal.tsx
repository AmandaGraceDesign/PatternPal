'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

type BillingInterval = 'month' | 'year';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlan?: 'monthly' | 'yearly';
}

export default function CheckoutModal({ isOpen, onClose, initialPlan }: CheckoutModalProps) {
  const { userId } = useAuth();
  const router = useRouter();
  const [interval, setInterval] = useState<BillingInterval>('month');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !initialPlan) return;
    setInterval(initialPlan === 'yearly' ? 'year' : 'month');
  }, [isOpen, initialPlan]);

  const handleStartCheckout = async () => {
    if (!userId) {
      const params = new URLSearchParams(window.location.search);
      params.set('upgrade', '1');
      params.set('plan', interval === 'month' ? 'monthly' : 'yearly');
      const returnUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
      router.push(`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: interval === 'month' ? 'monthly' : 'yearly' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        setError(data?.error || 'Unable to start checkout.');
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      setError('Unable to start checkout.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1100]">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#294051]">Upgrade to Pro</h3>
          <button
            onClick={onClose}
            className="text-[#6b7280] hover:text-[#374151] text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setInterval('month')}
              className={`border rounded-lg p-3 text-left transition-colors ${
                interval === 'month'
                  ? 'border-[#e0c26e] bg-[#fff4f5]'
                  : 'border-[#e5e7eb] hover:border-[#e0c26e]'
              }`}
            >
              <div className="text-sm font-semibold text-[#294051]">
                Monthly
              </div>
              <div className="text-xs text-[#6b7280]">$7.99 / month</div>
            </button>
            <button
              onClick={() => setInterval('year')}
              className={`border rounded-lg p-3 text-left transition-colors ${
                interval === 'year'
                  ? 'border-[#e0c26e] bg-[#fff4f5]'
                  : 'border-[#e5e7eb] hover:border-[#e0c26e]'
              }`}
            >
              <div className="text-sm font-semibold text-[#294051]">
                Yearly
              </div>
              <div className="text-xs text-[#6b7280]">$79 / year</div>
              <div className="text-[11px] text-[#e0c26e] font-medium">
                2 months free
              </div>
            </button>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            onClick={handleStartCheckout}
            disabled={isLoading}
            className="w-full px-4 py-2 rounded-md text-white font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#e0c26e' }}
          >
            {isLoading ? 'Starting checkout…' : 'Continue to payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
