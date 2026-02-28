'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

// Client-side promo code validation for instant UX feedback
// Server-side validation in /api/checkout is the security gate
const VALID_PROMO_CODES: Record<string, string> = {
  affiliate20: '4-month free trial applied!',
};

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
  const [referral, setReferral] = useState<string | null>(null);
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Capture Rewardful referral ID for affiliate attribution
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.rewardful === 'function') {
      window.rewardful('ready', () => {
        if (window.Rewardful?.referral) {
          setReferral(window.Rewardful.referral);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !initialPlan) return;
    setInterval(initialPlan === 'yearly' ? 'year' : 'month');
  }, [isOpen, initialPlan]);

  const handleApplyPromo = () => {
    const normalized = promoCode.trim().toLowerCase();
    if (!normalized) {
      setPromoError('Please enter a promo code.');
      setPromoApplied(false);
      return;
    }
    const successMessage = VALID_PROMO_CODES[normalized];
    if (successMessage) {
      setPromoApplied(true);
      setPromoError(null);
    } else {
      setPromoApplied(false);
      setPromoError('Invalid promo code.');
    }
  };

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
        body: JSON.stringify({
          plan: interval === 'month' ? 'monthly' : 'yearly',
          referral: referral || undefined,
          promoCode: promoApplied ? promoCode.trim() : undefined,
        }),
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

          {/* Promo code section */}
          <div>
            <button
              type="button"
              onClick={() => {
                setShowPromoInput(!showPromoInput);
                if (showPromoInput) {
                  setPromoCode('');
                  setPromoApplied(false);
                  setPromoError(null);
                }
              }}
              className="text-xs text-[#6b7280] hover:text-[#294051] underline transition-colors"
            >
              {showPromoInput ? 'Hide promo code' : 'Have a promo code?'}
            </button>
            {showPromoInput && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value);
                    if (promoApplied) setPromoApplied(false);
                    if (promoError) setPromoError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !promoApplied) handleApplyPromo();
                  }}
                  placeholder="Enter promo code"
                  disabled={promoApplied}
                  className="flex-1 border border-[#e5e7eb] rounded-md px-3 py-1.5 text-sm text-[#294051] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#e0c26e] disabled:bg-gray-50 disabled:text-[#6b7280]"
                />
                {!promoApplied ? (
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    className="px-3 py-1.5 text-sm font-medium rounded-md border border-[#e0c26e] text-[#294051] hover:bg-[#fff4f5] transition-colors"
                  >
                    Apply
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPromoCode('');
                      setPromoApplied(false);
                      setPromoError(null);
                    }}
                    className="px-3 py-1.5 text-sm font-medium rounded-md border border-[#e5e7eb] text-[#6b7280] hover:text-[#294051] hover:border-[#294051] transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
            {promoApplied && (
              <p className="mt-1 text-xs text-green-600 font-medium">
                {VALID_PROMO_CODES[promoCode.trim().toLowerCase()]}
              </p>
            )}
            {promoError && (
              <p className="mt-1 text-xs text-red-600">{promoError}</p>
            )}
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
