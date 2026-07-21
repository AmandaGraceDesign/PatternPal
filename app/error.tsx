'use client';

import { useEffect } from 'react';

/**
 * Page-level error boundary. Catches render/lifecycle crashes in the page
 * subtree and shows the *actual* error instead of Next.js's generic
 * "a client-side exception has occurred" white screen — so a user can
 * screenshot exactly what broke. Also reports it to /api/client-error.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[PatternPal] client error:', error);
    try {
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          message: error?.message ?? 'unknown',
          stack: error?.stack ?? null,
          digest: error?.digest ?? null,
          url: typeof window !== 'undefined' ? window.location.href : null,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }),
      }).catch(() => {});
    } catch {
      /* reporting must never itself throw */
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <div className="max-w-md">
        <h1 className="text-xl font-semibold text-neutral-900">
          Something went wrong loading PatternPal
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Try reloading. If it keeps happening, screenshot the details below and
          send them to support — it tells us exactly what to fix.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="rounded-md bg-[#e0c26e] px-4 py-2 text-sm font-medium text-neutral-900 hover:brightness-95"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Reload page
        </button>
      </div>

      <details className="max-w-lg text-left" open>
        <summary className="cursor-pointer text-xs font-medium text-neutral-500">
          Error details (for support)
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-neutral-100 p-3 text-left font-mono text-xs text-neutral-800">
          {error?.message || 'Unknown error'}
          {error?.digest ? `\n\ndigest: ${error.digest}` : ''}
        </pre>
      </details>
    </div>
  );
}
