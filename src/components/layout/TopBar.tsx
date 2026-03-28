'use client';

import { SignInButton, SignedIn, SignedOut, UserButton, useClerk, useUser } from '@clerk/nextjs';
import { checkClientProStatus } from '@/lib/utils/checkProStatus';
import { useState, useEffect } from 'react';
import UpgradeModal from '@/components/export/UpgradeModal';
import ManageSubscriptionButton from '@/components/billing/ManageSubscriptionButton';
import AffiliateSlideOut from '@/components/affiliate/AffiliateSlideOut';
import ProTrialBanner from '@/components/upgrade/ProTrialBanner';
import WelcomeModal from '@/components/onboarding/WelcomeModal';

export default function TopBar() {
  const { user, isSignedIn, isLoaded } = useUser();
  const { openSignUp } = useClerk();
  const isPro = isSignedIn && user ? checkClientProStatus(user.publicMetadata) : false;
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState<'monthly' | 'yearly'>('monthly');
  const [tourKey, setTourKey] = useState(0);

  // Deep-link: ?upgrade=1 from landing page
  useEffect(() => {
    if (!isLoaded) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgrade') !== '1') return;

    if (isSignedIn) {
      // Signed in: open upgrade modal directly
      const plan = params.get('plan') === 'yearly' ? 'yearly' : 'monthly';
      setUpgradePlan(plan);
      setIsUpgradeModalOpen(true);
      // Clean up URL
      params.delete('upgrade');
      params.delete('plan');
      const query = params.toString();
      window.history.replaceState({}, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
    } else {
      // Not signed in: open sign-up modal, then redirect back with upgrade params
      openSignUp?.({ forceRedirectUrl: window.location.href });
    }
  }, [isLoaded, isSignedIn, openSignUp]);

  const handleHelp = () => {
    window.location.href = 'mailto:education@amandagracedesign.com?subject=PatternPal%20Pro%20Support';
  };

  return (
    <header className="relative z-[60] pointer-events-auto h-12 border-b border-slate-700 bg-slate-900 rounded-t-2xl flex items-center justify-between px-6">
      {/* Left: Branding */}
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-semibold text-slate-100">PatternPAL Pro</h1>
        <span className="text-[10px] text-slate-500">by</span>
        <a
          href="https://www.amandagracedesign.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-slate-400 hover:text-[#e0c26e] transition-colors"
        >
          Amanda Grace Design
        </a>
      </div>

      {/* Right: Help and Upgrade */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            try { localStorage.removeItem('welcomeTourDismissed'); } catch {}
            setTourKey((k) => k + 1);
          }}
          className="text-xs text-slate-300 hover:text-slate-100 px-3 py-1.5 rounded-md hover:bg-slate-800 transition-colors"
        >
          Tour
        </button>
        <button
          type="button"
          onClick={handleHelp}
          className="text-xs text-slate-300 hover:text-slate-100 px-3 py-1.5 rounded-md hover:bg-slate-800 transition-colors"
        >
          Help
        </button>
        <SignedIn>
          {isPro && (
            <a
              href="https://patternpal-pro.getrewardful.com/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-slate-300 hover:text-slate-100 px-3 py-1.5 rounded-md hover:bg-slate-800 transition-colors"
            >
              Affiliate
            </a>
          )}
          {isPro ? (
            <ManageSubscriptionButton />
          ) : (
            <button
              onClick={() => setIsUpgradeModalOpen(true)}
              className="text-xs font-medium text-white px-4 py-1.5 rounded-md transition-colors"
              style={{ backgroundColor: '#e0c26e' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c9a94e'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e0c26e'}
            >
              Upgrade
            </button>
          )}
          <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: 'w-7 h-7' } }} />
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <button className="text-xs text-slate-300 hover:text-slate-100 px-3 py-1.5 rounded-md hover:bg-slate-800 transition-colors">
              Log In
            </button>
          </SignInButton>
        </SignedOut>
      </div>

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        initialPlan={upgradePlan}
      />

      {isPro ? <AffiliateSlideOut /> : <ProTrialBanner onUpgradeClick={() => setIsUpgradeModalOpen(true)} />}

      <WelcomeModal key={tourKey} />
    </header>
  );
}


