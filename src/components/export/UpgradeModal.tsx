'use client';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-200">Upgrade to Pro</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Unlock Scale & Export and other Pro features to take your pattern workflow to the next level.
          </p>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-slate-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-slate-300">Export patterns at multiple sizes</span>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-slate-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-slate-300">Choose DPI and format options</span>
            </div>
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-slate-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-slate-300">Batch export to zip files</span>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-600 rounded-md text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Maybe Later
            </button>
            <button
              onClick={() => {
                // TODO: Implement actual upgrade flow
                console.log('Upgrade clicked');
                onClose();
              }}
              className="flex-1 px-4 py-2 text-white rounded-md transition-colors"
              style={{ backgroundColor: '#f1737c' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e05a65';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f1737c';
              }}
            >
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

