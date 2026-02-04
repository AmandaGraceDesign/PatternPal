'use client';

import { SignInButton, SignedIn, SignedOut, UserButton, useUser } from '@clerk/nextjs';
import { checkClientProStatus } from '@/lib/utils/checkProStatus';
import { useState } from 'react';
import UpgradeModal from '@/components/export/UpgradeModal';
import ManageSubscriptionButton from '@/components/billing/ManageSubscriptionButton';

export default function TopBar() {
  const { user, isSignedIn } = useUser();
  const isPro = isSignedIn && user ? checkClientProStatus(user.publicMetadata) : false;
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const handleHelp = () => {
    window.location.href = 'mailto:education@amandagracedesign.com?subject=PatternPal%20Pro%20Support';
  };

  return (
    <header className="relative z-[60] pointer-events-auto h-12 border-b border-slate-700 bg-slate-900 flex items-center justify-between px-6">
      {/* Left: Branding */}
      <div className="flex items-center">
        <h1 className="text-sm font-semibold text-slate-100">PatternPAL Pro</h1>
      </div>

      {/* Right: Help and Upgrade */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleHelp}
          className="text-xs text-slate-300 hover:text-slate-100 px-3 py-1.5 rounded-md hover:bg-slate-800 transition-colors"
        >
          Help
        </button>
        <SignedIn>
          {isPro ? (
            <ManageSubscriptionButton />
          ) : (
            <button
              onClick={() => setIsUpgradeModalOpen(true)}
              className="text-xs font-medium text-white px-4 py-1.5 rounded-md transition-colors"
              style={{ backgroundColor: '#f1737c' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e05a65'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f1737c'}
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
      />
    </header>
  );
}


