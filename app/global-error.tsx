'use client';

import { useEffect } from 'react';

/**
 * Last-resort boundary. Catches crashes in the root layout itself
 * (ClerkProvider, providers, scripts) — the case that produces the full
 * white "Application error" screen. It replaces the whole document, so it
 * must render its own <html>/<body> and cannot rely on Tailwind or the app
 * fonts; everything here is inline and self-contained on purpose.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[PatternPal] global error:', error);
    try {
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          message: error?.message ?? 'unknown',
          stack: error?.stack ?? null,
          digest: error?.digest ?? null,
          scope: 'global',
          url: typeof window !== 'undefined' ? window.location.href : null,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }),
      }).catch(() => {});
    } catch {
      /* reporting must never itself throw */
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          padding: '64px 24px',
          textAlign: 'center',
          fontFamily: 'Arial, Helvetica, sans-serif',
          color: '#171717',
          background: '#ffffff',
        }}
      >
        <div style={{ maxWidth: 440 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
            Something went wrong loading PatternPal
          </h1>
          <p style={{ marginTop: 8, fontSize: 14, color: '#525252' }}>
            Try reloading. If it keeps happening, screenshot the details below
            and send them to support — it tells us exactly what to fix.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={() => reset()}
            style={{
              borderRadius: 6,
              border: 'none',
              background: '#e0c26e',
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              color: '#171717',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              borderRadius: 6,
              border: '1px solid #d4d4d4',
              background: '#fff',
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              color: '#404040',
              cursor: 'pointer',
            }}
          >
            Reload page
          </button>
        </div>

        <pre
          style={{
            maxWidth: 520,
            maxHeight: 256,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            borderRadius: 6,
            background: '#f5f5f5',
            padding: 12,
            textAlign: 'left',
            fontFamily: 'monospace',
            fontSize: 12,
            color: '#262626',
          }}
        >
          {error?.message || 'Unknown error'}
          {error?.digest ? `\n\ndigest: ${error.digest}` : ''}
        </pre>
      </body>
    </html>
  );
}
