'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEVICE_OPTIONS = ['iPad', 'iPhone', 'Android', 'Desktop / Laptop', 'Other'];
const BROWSER_OPTIONS = ['Safari', 'Chrome', 'Firefox', 'Edge', 'DuckDuckGo', 'Other'];
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const GOLD = '#e0c26e';

function detectDevice(): string {
  if (typeof navigator === 'undefined') return 'Desktop / Laptop';
  const ua = navigator.userAgent;
  const touch = navigator.maxTouchPoints > 1;
  // iPads on iPadOS report as "Macintosh" but expose touch points.
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return 'Android';
  return 'Desktop / Laptop';
}

function detectBrowser(): string {
  if (typeof navigator === 'undefined') return 'Other';
  const ua = navigator.userAgent;
  if (/DuckDuckGo/i.test(ua)) return 'DuckDuckGo';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Firefox\//.test(ua)) return 'Firefox';
  // Chrome must be checked before Safari (Chrome UA contains "Safari").
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}

export default function SupportModal({ isOpen, onClose }: SupportModalProps) {
  const { user, isSignedIn } = useUser();

  const [email, setEmail] = useState('');
  const [device, setDevice] = useState('Desktop / Laptop');
  const [browser, setBrowser] = useState('Other');
  const [message, setMessage] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect device/browser and prefill email when the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setDevice(detectDevice());
    setBrowser(detectBrowser());
    const primaryEmail = user?.primaryEmailAddress?.emailAddress;
    if (primaryEmail) setEmail(primaryEmail);
  }, [isOpen, user]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status !== 'sending') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, status]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > MAX_ATTACHMENT_BYTES) {
      setErrorMsg('That screenshot is over 4MB — please choose a smaller image.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setErrorMsg('');
    setScreenshot(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setErrorMsg("Please tell us what's happening.");
      return;
    }
    if (!email.trim()) {
      setErrorMsg('Please add your email so we can reply.');
      return;
    }

    setStatus('sending');
    setErrorMsg('');

    const form = new FormData();
    form.append('message', message.trim());
    form.append('email', email.trim());
    form.append('device', device);
    form.append('browser', browser);
    form.append('signedIn', isSignedIn ? 'Yes' : 'No');
    form.append(
      'screenSize',
      typeof window !== 'undefined' ? `${window.screen.width}×${window.screen.height}` : 'Unknown'
    );
    form.append('userAgent', typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown');
    if (screenshot) form.append('screenshot', screenshot);

    try {
      const res = await fetch('/api/support', { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't send right now. Please try again.");
      }
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : "Couldn't send right now. Please try again.");
    }
  };

  const handleClose = () => {
    if (status === 'sending') return;
    // Reset transient fields so a reopen is clean.
    setMessage('');
    setScreenshot(null);
    setStatus('idle');
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const inputClass =
    'w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:border-transparent';

  return (
    <div
      className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
      onClick={handleClose}
    >
      <div
        className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-200">Report a problem</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1 -m-1"
            aria-label="Close"
            disabled={status === 'sending'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {status === 'sent' ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">💛</div>
            <p className="text-slate-200 font-medium mb-1">Sent! Thank you.</p>
            <p className="text-sm text-slate-400 mb-6">
              I read every report personally and I&apos;ll get back to you at{' '}
              <span className="text-slate-300">{email}</span>.
            </p>
            <button
              onClick={handleClose}
              className="text-sm font-medium text-white px-5 py-2 rounded-md transition-colors"
              style={{ backgroundColor: GOLD }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#c9a94e')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = GOLD)}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Your email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className={inputClass}
                style={{ accentColor: GOLD }}
                disabled={status === 'sending'}
              />
            </div>

            {/* Device + Browser */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Device</label>
                <select
                  value={device}
                  onChange={(e) => setDevice(e.target.value)}
                  className={inputClass}
                  disabled={status === 'sending'}
                >
                  {DEVICE_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Browser</label>
                <select
                  value={browser}
                  onChange={(e) => setBrowser(e.target.value)}
                  className={inputClass}
                  disabled={status === 'sending'}
                >
                  {BROWSER_OPTIONS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                What&apos;s happening? <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell me what went wrong, and what you were trying to do…"
                rows={4}
                required
                className={`${inputClass} resize-y`}
                disabled={status === 'sending'}
              />
            </div>

            {/* Screenshot */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Screenshot <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600 file:cursor-pointer"
                disabled={status === 'sending'}
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Your artwork is 100% safe — I&apos;ll only use anything you send to reproduce the
                issue, and I&apos;ll never share, store, or repurpose it.
              </p>
            </div>

            {errorMsg && <p className="text-sm text-rose-400">{errorMsg}</p>}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="text-sm text-slate-400 hover:text-slate-200 px-4 py-2 rounded-md transition-colors"
                disabled={status === 'sending'}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-sm font-medium text-white px-5 py-2 rounded-md transition-colors disabled:opacity-60"
                style={{ backgroundColor: GOLD }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#c9a94e')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = GOLD)}
                disabled={status === 'sending'}
              >
                {status === 'sending' ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
