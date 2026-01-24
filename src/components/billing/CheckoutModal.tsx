'use client';

import { useMemo, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

type BillingInterval = 'month' | 'year';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
);

const monthlyPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY ?? '';
const yearlyPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY ?? '';

function CheckoutForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setIsSubmitting(true);
    setMessage(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {},
      redirect: 'if_required',
    });

    if (result.error) {
      setMessage(result.error.message ?? 'Payment failed.');
    } else if (result.paymentIntent?.status === 'succeeded') {
      setMessage('Payment successful!');
      onSuccess();
    } else if (result.paymentIntent?.status === 'processing') {
      setMessage('Payment processing. You will be upgraded shortly.');
      onSuccess();
    }

    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {message && (
        <p className="text-xs text-[#6b7280]">{message}</p>
      )}
      <button
        type="submit"
        disabled={!stripe || isSubmitting}
        className="w-full px-4 py-2 rounded-md text-white font-semibold disabled:opacity-50"
        style={{ backgroundColor: '#f1737c' }}
      >
        {isSubmitting ? 'Processing…' : 'Confirm subscription'}
      </button>
    </form>
  );
}

export default function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const [interval, setInterval] = useState<BillingInterval>('month');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceId = interval === 'month' ? monthlyPriceId : yearlyPriceId;
  const hasStripeKey = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

  const options = useMemo(
    () => ({
      clientSecret: clientSecret ?? undefined,
      appearance: { theme: 'stripe' },
    }),
    [clientSecret]
  );

  const handleStartCheckout = async () => {
    if (!priceId) {
      setError('Missing Stripe price configuration.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (!res.ok || !data.clientSecret) {
        setError(data.error || 'Unable to start checkout.');
        return;
      }
      setClientSecret(data.clientSecret);
    } catch (err) {
      console.error(err);
      setError('Unable to start checkout.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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

        {!hasStripeKey ? (
          <p className="text-sm text-[#6b7280]">
            Stripe configuration is missing. Please add your publishable key.
          </p>
        ) : clientSecret ? (
          <Elements stripe={stripePromise} options={options}>
            <CheckoutForm onSuccess={onClose} />
          </Elements>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setInterval('month')}
                className={`border rounded-lg p-3 text-left transition-colors ${
                  interval === 'month'
                    ? 'border-[#f1737c] bg-[#fff4f5]'
                    : 'border-[#e5e7eb] hover:border-[#f1737c]'
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
                    ? 'border-[#f1737c] bg-[#fff4f5]'
                    : 'border-[#e5e7eb] hover:border-[#f1737c]'
                }`}
              >
                <div className="text-sm font-semibold text-[#294051]">
                  Yearly
                </div>
                <div className="text-xs text-[#6b7280]">$79 / year</div>
                <div className="text-[11px] text-[#f1737c] font-medium">
                  2 months free
                </div>
              </button>
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              onClick={handleStartCheckout}
              disabled={isLoading}
              className="w-full px-4 py-2 rounded-md text-white font-semibold disabled:opacity-50"
              style={{ backgroundColor: '#f1737c' }}
            >
              {isLoading ? 'Starting checkout…' : 'Continue to payment'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
