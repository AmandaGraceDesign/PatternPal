'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'affiliateSlideOutDismissed';
const SIGNUP_URL = 'https://patternpal-pro.getrewardful.com/signup';

export default function AffiliateSlideOut() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return;
    }

    // Slide in after 3 seconds
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore storage errors
    }
  };

  // Don't render at all if already dismissed on mount
  const [dismissed] = useState(() => {
    try {
      return !!localStorage.getItem(STORAGE_KEY);
    } catch {
      return true;
    }
  });

  if (dismissed) return null;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[1000] transition-transform duration-500 ease-out ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="bg-slate-800 border-t border-slate-700 px-6 py-3 flex items-center justify-between gap-4">
        <p className="text-xs text-slate-300 flex-1">
          Love PatternPal?{' '}
          <span className="text-slate-100 font-medium">Earn commissions</span>{' '}
          by referring other designers to Pro.
        </p>

        <a
          href={SIGNUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-medium text-white px-4 py-1.5 rounded-md transition-colors"
          style={{ backgroundColor: '#e0c26e' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#c9a94e')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#e0c26e')}
        >
          Become an Affiliate
        </a>

        <button
          onClick={handleDismiss}
          className="shrink-0 text-slate-400 hover:text-slate-200 transition-colors p-1"
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>
    </div>
  );
}
