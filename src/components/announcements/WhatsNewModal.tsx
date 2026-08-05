'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CURRENT_ANNOUNCEMENT } from '@/lib/announcements/currentAnnouncement';
import { isAnnouncementPending, markAnnouncementSeen } from '@/lib/announcements/announcementState';
import { getV2Template } from '@/lib/mockups/mockupEngineV2/templates/templateRegistry';

interface WhatsNewModalProps {
  /** Pro users don't get the "Included with Pro" chip. */
  isPro: boolean;
  /** Fired when the CTA is used, with the category to open the gallery on. */
  onSeeAll: (category: string) => void;
}

export default function WhatsNewModal({ isPro, onSeeAll }: WhatsNewModalProps) {
  const [visible, setVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (isAnnouncementPending()) {
      restoreFocusRef.current = document.activeElement;
      setVisible(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    markAnnouncementSeen();
    const el = restoreFocusRef.current;
    if (el instanceof HTMLElement) el.focus();
  }, []);

  const seeAll = useCallback(() => {
    dismiss();
    onSeeAll(CURRENT_ANNOUNCEMENT.ctaCategory);
  }, [dismiss, onSeeAll]);

  // Escape to dismiss, and keep Tab inside the dialog while it's up.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismiss();
        return;
      }
      if (e.key !== 'Tab' || !cardRef.current) return;
      const focusables = cardRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, dismiss]);

  useEffect(() => {
    if (visible) cardRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [visible]);

  if (!visible) return null;

  const a = CURRENT_ANNOUNCEMENT;

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-black/50"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="relative w-full max-w-[452px] max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl px-6 pt-6 pb-5 text-center"
      >
        <button
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-2.5 right-2.5 w-11 h-11 flex items-center justify-center rounded-lg text-[#9ca3af] hover:text-[#6b7280] hover:bg-gray-100 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>

        <div className="text-3xl leading-none" aria-hidden="true">{a.emoji}</div>
        <h2 id="whats-new-title" className="mt-2 text-lg font-bold text-[#294051]">{a.title}</h2>

        {!isPro && (
          <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-[#e0c26e]/15 text-[#b8991d] border border-[#e0c26e]/30">
            Included with Pro
          </span>
        )}

        <p className="mt-2 mx-auto max-w-[40ch] text-sm text-[#6b7280] leading-relaxed">{a.body}</p>

        {/* grid-cols-N compiles to repeat(N, minmax(0,1fr)). The minmax(0,…)
            matters: a plain 1fr won't shrink below its content's min-content
            width, so the longest caption would widen its own column and
            render a larger thumbnail than its neighbours. */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {a.previewIds.map((id) => (
            <figure key={id} className="m-0 min-w-0">
              <img
                src={`/mockups/v2/thumbnails/${id}.jpg`}
                alt=""
                draggable={false}
                className="w-full aspect-square object-cover rounded-lg bg-gray-100 select-none"
                style={{ objectPosition: 'center 32%' }}
                onError={(e) => {
                  e.currentTarget.style.visibility = 'hidden';
                }}
              />
              <figcaption className="mt-1 text-[10px] leading-tight text-[#6b7280] line-clamp-2 min-h-[2.6em]">
                {getV2Template(id)?.name ?? ''}
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="mt-2 text-[11px] italic text-[#9ca3af]">{a.moreNote}</p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={seeAll}
            className="min-h-[44px] px-5 py-3 rounded-lg text-sm font-bold text-white transition-colors bg-[#e0c26e] hover:bg-[#c9a94e]"
          >
            {a.ctaLabel}
          </button>
          <button
            onClick={dismiss}
            className="min-h-[38px] px-4 py-2 text-xs font-medium text-[#9ca3af] hover:text-[#6b7280] transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
