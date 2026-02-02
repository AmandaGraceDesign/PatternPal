'use client';

import { SignInButton, UserButton, useUser } from '@clerk/nextjs';
import { checkClientProStatus } from '@/lib/utils/checkProStatus';
import { useState } from 'react';
import UpgradeModal from '@/components/export/UpgradeModal';

export default function TopBar() {
  const { user, isSignedIn } = useUser();
  const isPro = isSignedIn && user ? checkClientProStatus(user.publicMetadata) : false;
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  const handleHelp = () => {
    window.location.href = 'mailto:education@amandagracedesign.com?subject=PatternPal%20Pro%20Support';
  };

  const handleManageSubscription = async () => {
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        const message = data?.error || 'Unable to open the billing portal.';
        window.alert(message);
      }
    } catch (error) {
      console.error('Failed to open customer portal', error);
      window.alert('Unable to open the billing portal.');
    }
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
        {isPro ? (
          <>
            <button
              type="button"
              onClick={handleManageSubscription}
              className="text-xs text-slate-300 hover:text-slate-100 px-3 py-1.5 rounded-md hover:bg-slate-800 transition-colors"
            >
              Manage
            </button>
            <UserButton appearance={{ elements: { userButtonAvatarBox: 'w-7 h-7' } }} />
          </>
        ) : (
          <>
            <button
              onClick={() => setIsUpgradeModalOpen(true)}
              className="text-xs font-medium text-white px-4 py-1.5 rounded-md transition-colors"
              style={{ backgroundColor: '#f1737c' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e05a65'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f1737c'}
            >
              Upgrade
            </button>
            <SignInButton mode="modal">
              <button className="text-xs text-slate-300 hover:text-slate-100 px-3 py-1.5 rounded-md hover:bg-slate-800 transition-colors">
                Log In
              </button>
            </SignInButton>
          </>
        )}
      </div>

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
      />
    </header>
  );
}


