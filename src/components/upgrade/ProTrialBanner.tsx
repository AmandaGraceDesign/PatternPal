'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'proTrialBannerDismissed';

interface ProTrialBannerProps {
  onUpgradeClick: () => void;
}

export default function ProTrialBanner({ onUpgradeClick }: ProTrialBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if dismissed this session
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return;
    }

    // Slide in after 5 seconds — let them use the tool first
    const timer = setTimeout(() => setVisible(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore storage errors
    }
  };

  const handleUpgrade = () => {
    handleDismiss();
    onUpgradeClick();
  };

  // Don't render if dismissed this session
  const [dismissed] = useState(() => {
    try {
      return !!sessionStorage.getItem(STORAGE_KEY);
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
      <div className="px-6 py-3 flex items-center justify-between gap-4" style={{ backgroundColor: '#e0c26e' }}>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white font-semibold">
            Try Pro free for 3 days
          </p>
          <p className="text-[11px] text-white/70 mt-0.5 truncate">
            Unlock Seam Inspector, product mockups &amp; social export — cancel anytime.
          </p>
        </div>

        <button
          onClick={handleUpgrade}
          className="shrink-0 text-xs font-semibold px-4 py-1.5 rounded-md transition-colors"
          style={{ backgroundColor: '#294051', color: '#ffffff' }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e3040')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#294051')}
        >
          Start Free Trial
        </button>

        <button
          onClick={handleDismiss}
          className="shrink-0 text-white/60 hover:text-white transition-colors p-1"
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
