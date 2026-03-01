'use client';

import { useEffect, useState } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import { checkClientProStatus } from '@/lib/utils/checkProStatus';

// Client-side promo code validation for instant UX feedback
// Server-side validation in /api/checkout is the security gate
const VALID_PROMO_CODES: Record<string, string> = {
  affiliate20: '4-month free trial applied!',
};

type BillingInterval = 'month' | 'year';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlan?: 'monthly' | 'yearly';
}

type FeatureValue = boolean | string;

interface Feature {
  label: string;
  free: FeatureValue;
  pro: FeatureValue;
}

const FEATURES: Feature[] = [
  { label: 'Pattern repeat testing', free: true, pro: true },
  { label: 'All repeat types', free: true, pro: true },
  { label: 'Zoom & tile outline', free: true, pro: true },
  { label: 'Scale preview', free: true, pro: true },
  { label: 'Export sizes', free: '2 sizes', pro: '8+ sizes' },
  { label: 'Export formats', free: 'JPG', pro: 'PNG, JPG, TIFF' },
  { label: 'DPI options', free: '150', pro: '150 or 300' },
  { label: 'Pattern analysis', free: false, pro: true },
  { label: 'Seam analyzer (400%)', free: false, pro: true },
  { label: 'Product mockups', free: false, pro: true },
  { label: 'Mockup download', free: false, pro: true },
  { label: 'Pro tools panel', free: false, pro: true },
];

function FeatureCell({ value, isPro }: { value: FeatureValue; isPro: boolean }) {
  if (value === true) {
    return (
      <svg className="w-4 h-4 text-green-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (value === false) {
    return <span className="block text-center text-slate-600">&mdash;</span>;
  }
  return (
    <span className={`block text-center text-xs font-medium ${isPro ? 'text-[#e0c26e]' : 'text-slate-400'}`}>
      {value}
    </span>
  );
}

export default function UpgradeModal({ isOpen, onClose, initialPlan }: UpgradeModalProps) {
  const { user, isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const isPro = isSignedIn && user ? checkClientProStatus(user.publicMetadata) : false;

  // Checkout state (absorbed from CheckoutModal)
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

  // Sync interval with initialPlan prop
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
    if (!isSignedIn) {
      // Open Clerk sign-in modal; after sign-in, land back with upgrade params
      const params = new URLSearchParams(window.location.search);
      params.set('upgrade', '1');
      params.set('plan', interval === 'month' ? 'monthly' : 'yearly');
      const returnUrl = `${window.location.pathname}?${params.toString()}`;
      openSignIn({ forceRedirectUrl: returnUrl });
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

  const handleManageSubscription = async () => {
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to open customer portal', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-xl w-full max-w-md border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-0">
          <h2 className="text-lg font-semibold text-slate-200">Upgrade to Pro</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Feature Comparison Table */}
          <div className="border border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2.5 px-3 text-slate-400 font-medium text-xs uppercase tracking-wider">
                    Feature
                  </th>
                  <th className="py-2.5 px-3 text-slate-400 font-medium text-xs uppercase tracking-wider w-24 text-center">
                    Free
                  </th>
                  <th
                    className="py-2.5 px-3 font-medium text-xs uppercase tracking-wider w-28 text-center"
                    style={{ backgroundColor: 'rgba(224,194,110,0.1)', color: '#e0c26e' }}
                  >
                    {isPro && (
                      <span className="block text-[10px] font-normal tracking-normal normal-case text-[#e0c26e]/70 mb-0.5">
                        Current Plan
                      </span>
                    )}
                    <span className="flex items-center justify-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Pro
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((feature, i) => (
                  <tr
                    key={feature.label}
                    className={`border-b border-slate-700/50 last:border-b-0 ${
                      i % 2 === 0 ? 'bg-slate-800' : 'bg-slate-800/50'
                    }`}
                  >
                    <td className="py-2 px-3 text-slate-300 text-xs sm:text-sm">{feature.label}</td>
                    <td className="py-2 px-3">
                      <FeatureCell value={feature.free} isPro={false} />
                    </td>
                    <td className="py-2 px-3" style={{ backgroundColor: 'rgba(224,194,110,0.04)' }}>
                      <FeatureCell value={feature.pro} isPro={true} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Plan Toggle + Promo — hidden for Pro users */}
          {!isPro && (
            <>
              {/* Plan Toggle */}
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setInterval('month')}
                  className={`border rounded-lg p-3 text-left transition-colors ${
                    interval === 'month'
                      ? 'border-[#e0c26e] bg-[#e0c26e]/10'
                      : 'border-slate-600 hover:border-[#e0c26e]/50'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-200">Monthly</div>
                  <div className="text-xs text-slate-400">$7.99 / month</div>
                </button>
                <button
                  onClick={() => setInterval('year')}
                  className={`border rounded-lg p-3 text-left transition-colors ${
                    interval === 'year'
                      ? 'border-[#e0c26e] bg-[#e0c26e]/10'
                      : 'border-slate-600 hover:border-[#e0c26e]/50'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-200">Yearly</div>
                  <div className="text-xs text-slate-400">$79 / year</div>
                  <div className="text-[11px] text-[#e0c26e] font-medium">Save 2 months</div>
                </button>
              </div>

              {/* Promo Code */}
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
                  className="text-xs text-slate-500 hover:text-slate-300 underline transition-colors"
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
                      className="flex-1 border border-slate-600 rounded-md px-3 py-1.5 text-sm text-slate-200 bg-slate-700 placeholder:text-slate-500 focus:outline-none focus:border-[#e0c26e] disabled:bg-slate-700/50 disabled:text-slate-400"
                    />
                    {!promoApplied ? (
                      <button
                        type="button"
                        onClick={handleApplyPromo}
                        className="px-3 py-1.5 text-sm font-medium rounded-md border border-[#e0c26e] text-[#e0c26e] hover:bg-[#e0c26e]/10 transition-colors"
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
                        className="px-3 py-1.5 text-sm font-medium rounded-md border border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
                {promoApplied && (
                  <p className="mt-1 text-xs text-green-400 font-medium">
                    {VALID_PROMO_CODES[promoCode.trim().toLowerCase()]}
                  </p>
                )}
                {promoError && <p className="mt-1 text-xs text-red-400">{promoError}</p>}
              </div>
            </>
          )}

          {/* Error */}
          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* CTA Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            {isPro ? (
              <button
                onClick={handleManageSubscription}
                className="w-full px-4 py-2.5 text-white font-semibold rounded-md transition-colors"
                style={{ backgroundColor: '#e0c26e' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#c9a94e';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#e0c26e';
                }}
              >
                Manage Subscription
              </button>
            ) : (
              <button
                onClick={handleStartCheckout}
                disabled={isLoading}
                className="w-full px-4 py-2.5 text-white font-semibold rounded-md transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#e0c26e' }}
                onMouseEnter={(e) => {
                  if (!isLoading) e.currentTarget.style.backgroundColor = '#c9a94e';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#e0c26e';
                }}
              >
                {isLoading
                  ? 'Starting checkout\u2026'
                  : isSignedIn
                  ? 'Continue to payment'
                  : 'Sign up & Upgrade'}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
