# What's New Announcement Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a dismissible centered modal announcing newly added mockups, gated on a version string so every future batch re-announces itself with a one-file edit.

**Architecture:** Pure gate logic (no DOM) in `src/lib/announcements/`, a presentational modal in `src/components/announcements/`, mounted in `TopBar` beside the existing `WelcomeModal`. The CTA dispatches a window event that `AdvancedToolsBar` listens for and opens the mockup gallery pre-filtered to a category.

**Tech Stack:** Next.js App Router, React 19 client components, TypeScript, Tailwind utility classes, Vitest.

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-08-04-whats-new-announcement-design.md`.
- Storage key is exactly `whatsNewSeen`; the stored value is the version string, not a boolean.
- Storage failures fail **closed** — an exception means don't show the modal.
- Do **not** delete, alter, or bypass `WelcomeModal`'s 9 steps or the top-bar **Tour** button.
- Touch parity is mandatory: interactive targets ≥44px, no hover-only affordances.
- Preview grid must be `repeat(4, minmax(0, 1fr))`, never `repeat(4, 1fr)`.
- Modal capped at 452px wide and `max-height: 85vh` with internal scroll.
- Preview images come from `/mockups/v2/thumbnails/<id>.jpg`; a 404 hides that `<img>` only.
- `src/components/sidebar/ActionsSidebar.tsx` is dead code (imported nowhere). Do not modify it.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/announcements/currentAnnouncement.ts` (create) | The announcement's content and version. The only file edited for future drops. |
| `src/lib/announcements/announcementState.ts` (create) | Pure gate logic + storage read/write. No React, no JSX. |
| `src/__tests__/announcementState.test.ts` (create) | Unit tests for the gate. |
| `src/components/announcements/WhatsNewModal.tsx` (create) | The modal UI. Self-gates on mount. |
| `src/components/layout/TopBar.tsx` (modify) | Mounts the modal; suppresses the tour while an announcement is pending. |
| `src/components/mockups/MockupGalleryModal.tsx` (modify) | Accepts `initialCategory`. |
| `src/components/layout/AdvancedToolsBar.tsx` (modify) | Listens for the open-gallery event. |

---

### Task 1: Announcement config and gate logic

**Files:**
- Create: `src/lib/announcements/currentAnnouncement.ts`
- Create: `src/lib/announcements/announcementState.ts`
- Test: `src/__tests__/announcementState.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `CURRENT_ANNOUNCEMENT: { version: string | null; emoji: string; title: string; body: string; previewIds: readonly string[]; moreNote: string; ctaLabel: string; ctaCategory: string }`
  - `ANNOUNCEMENT_STORAGE_KEY: 'whatsNewSeen'`
  - `shouldShowAnnouncement(stored: string | null, version: string | null): boolean`
  - `isAnnouncementPending(version?: string | null): boolean`
  - `markAnnouncementSeen(version?: string | null): void`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/announcementState.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  shouldShowAnnouncement,
  isAnnouncementPending,
  markAnnouncementSeen,
  ANNOUNCEMENT_STORAGE_KEY,
} from '../lib/announcements/announcementState';

/** Swap in a fake localStorage for one test. */
function useStorage(impl: Partial<Storage>) {
  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { value: impl, configurable: true });
  return () => Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
}

describe('ANN-01: announcement version gate', () => {
  const restores: Array<() => void> = [];
  afterEach(() => { while (restores.length) restores.pop()!(); vi.restoreAllMocks(); });

  it('shows for a visitor who has never seen one', () => {
    expect(shouldShowAnnouncement(null, '2026-08-seasonal')).toBe(true);
  });

  it('hides once the current version has been seen', () => {
    expect(shouldShowAnnouncement('2026-08-seasonal', '2026-08-seasonal')).toBe(false);
  });

  it('shows again when the version is bumped', () => {
    expect(shouldShowAnnouncement('2026-08-seasonal', '2026-12-christmas')).toBe(true);
  });

  it('never shows when version is null', () => {
    expect(shouldShowAnnouncement(null, null)).toBe(false);
    expect(shouldShowAnnouncement('anything', null)).toBe(false);
  });

  it('fails closed when storage throws on read', () => {
    restores.push(useStorage({ getItem() { throw new Error('denied'); } } as unknown as Storage));
    expect(isAnnouncementPending('2026-08-seasonal')).toBe(false);
  });

  it('reads storage when available', () => {
    restores.push(useStorage({ getItem: () => null } as unknown as Storage));
    expect(isAnnouncementPending('2026-08-seasonal')).toBe(true);
  });

  it('writes the version under the documented key', () => {
    const setItem = vi.fn();
    restores.push(useStorage({ setItem } as unknown as Storage));
    markAnnouncementSeen('2026-08-seasonal');
    expect(setItem).toHaveBeenCalledWith(ANNOUNCEMENT_STORAGE_KEY, '2026-08-seasonal');
  });

  it('swallows storage errors on write', () => {
    restores.push(useStorage({ setItem() { throw new Error('denied'); } } as unknown as Storage));
    expect(() => markAnnouncementSeen('2026-08-seasonal')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/announcementState.test.ts`
Expected: FAIL — cannot resolve `../lib/announcements/announcementState`.

- [ ] **Step 3: Write the config**

Create `src/lib/announcements/currentAnnouncement.ts`:

```ts
/**
 * The one file to edit when a new batch of mockups ships.
 *
 * Bump `version` and everyone — including users who dismissed the previous
 * announcement — sees the new one on their next visit. Set `version` to null
 * to switch the announcement off without deleting anything.
 */
export const CURRENT_ANNOUNCEMENT = {
  version: '2026-08-seasonal',
  emoji: '🎃',
  title: 'New Seasonal Mockups',
  body: 'Seven new Halloween & autumn scenes are ready — drop your pattern straight onto them.',
  previewIds: ['halloween-cape', 'halloween-tumbler', 'halloween-bucket', 'halloween-cat-bandana'],
  moreNote: '…plus tea towel, doormat & leggings',
  ctaLabel: 'See All 7 Seasonal',
  ctaCategory: 'seasonal',
} as const satisfies {
  version: string | null;
  emoji: string;
  title: string;
  body: string;
  previewIds: readonly string[];
  moreNote: string;
  ctaLabel: string;
  ctaCategory: string;
};
```

- [ ] **Step 4: Write the gate logic**

Create `src/lib/announcements/announcementState.ts`:

```ts
import { CURRENT_ANNOUNCEMENT } from './currentAnnouncement';

export const ANNOUNCEMENT_STORAGE_KEY = 'whatsNewSeen';

/**
 * Pure comparison — no storage access, so it's trivially testable.
 * A null version means the announcement is switched off entirely.
 */
export function shouldShowAnnouncement(stored: string | null, version: string | null): boolean {
  if (!version) return false;
  return stored !== version;
}

/**
 * Storage-backed gate. Fails closed: if localStorage is unavailable (private
 * browsing, blocked cookies), we show nothing rather than nagging every load.
 */
export function isAnnouncementPending(
  version: string | null = CURRENT_ANNOUNCEMENT.version,
): boolean {
  if (!version) return false;
  try {
    return shouldShowAnnouncement(localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY), version);
  } catch {
    return false;
  }
}

export function markAnnouncementSeen(
  version: string | null = CURRENT_ANNOUNCEMENT.version,
): void {
  if (!version) return;
  try {
    localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, version);
  } catch {
    // storage unavailable — nothing to persist
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/announcementState.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/announcements src/__tests__/announcementState.test.ts
git commit -m "feat(announcements): version-gated announcement state"
```

---

### Task 2: The modal component

**Files:**
- Create: `src/components/announcements/WhatsNewModal.tsx`

**Interfaces:**
- Consumes: `CURRENT_ANNOUNCEMENT`, `isAnnouncementPending`, `markAnnouncementSeen` from Task 1.
- Produces: `default export function WhatsNewModal({ isPro, onSeeAll }: { isPro: boolean; onSeeAll: (category: string) => void })`

- [ ] **Step 1: Write the component**

Create `src/components/announcements/WhatsNewModal.tsx`:

```tsx
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
      if (e.key === 'Escape') { dismiss(); return; }
      if (e.key !== 'Tab' || !cardRef.current) return;
      const focusables = cardRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
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
      onPointerDown={(e) => { if (e.target === e.currentTarget) dismiss(); }}
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
                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```bash
git add src/components/announcements/WhatsNewModal.tsx
git commit -m "feat(announcements): what's new modal component"
```

---

### Task 3: Gallery accepts an initial category, toolbar listens for the open event

**Files:**
- Modify: `src/components/mockups/MockupGalleryModal.tsx`
- Modify: `src/components/layout/AdvancedToolsBar.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: window event `ppp:open-mockup-gallery` with `detail: { category?: string }`; `MockupGalleryModal` prop `initialCategory?: string`.

- [ ] **Step 1: Add the prop to the gallery**

In `src/components/mockups/MockupGalleryModal.tsx`, add to `MockupGalleryModalProps`:

```ts
  /** Category tab to select when the gallery opens. Defaults to 'all'. */
  initialCategory?: string;
```

Add `initialCategory` to the destructured params, then replace the `activeCategory` state declaration with:

```tsx
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory ?? 'all');

  // Re-seed the tab each time the gallery opens so a deep-link into a
  // category doesn't get overridden by whatever tab was left selected.
  useEffect(() => {
    if (isOpen) setActiveCategory(initialCategory ?? 'all');
  }, [isOpen, initialCategory]);
```

- [ ] **Step 2: Listen for the event in AdvancedToolsBar**

In `src/components/layout/AdvancedToolsBar.tsx`, beside the existing `isMockupsOpen` state (line ~154) add:

```tsx
  const [mockupInitialCategory, setMockupInitialCategory] = useState<string>('all');
```

Then add this effect near the component's other effects:

```tsx
  // Lets anything outside this tree (e.g. the what's-new announcement) open
  // the gallery on a given category without prop-drilling through the layout.
  useEffect(() => {
    const onOpenGallery = (e: Event) => {
      const detail = (e as CustomEvent<{ category?: string }>).detail;
      setMockupInitialCategory(detail?.category ?? 'all');
      setIsMockupsOpen(true);
    };
    window.addEventListener('ppp:open-mockup-gallery', onOpenGallery);
    return () => window.removeEventListener('ppp:open-mockup-gallery', onOpenGallery);
  }, []);
```

- [ ] **Step 3: Pass the prop through**

On the `<MockupGalleryModal` element (line ~527), add:

```tsx
        initialCategory={mockupInitialCategory}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc silent; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/mockups/MockupGalleryModal.tsx src/components/layout/AdvancedToolsBar.tsx
git commit -m "feat(mockups): open the gallery on a chosen category via window event"
```

---

### Task 4: Mount in TopBar and suppress the tour

**Files:**
- Modify: `src/components/layout/TopBar.tsx`

**Interfaces:**
- Consumes: `WhatsNewModal` (Task 2), `isAnnouncementPending` (Task 1), the `ppp:open-mockup-gallery` event (Task 3).
- Produces: nothing.

- [ ] **Step 1: Add imports**

```tsx
import WhatsNewModal from '@/components/announcements/WhatsNewModal';
import { isAnnouncementPending } from '@/lib/announcements/announcementState';
```

- [ ] **Step 2: Add state**

Beside the existing `tourKey` state:

```tsx
  // Captured once on mount. Stays true for the whole visit even after the
  // announcement is dismissed, so the tour doesn't pop the moment it closes.
  const [announcementPending, setAnnouncementPending] = useState(false);
  const [tourForced, setTourForced] = useState(false);

  useEffect(() => {
    setAnnouncementPending(isAnnouncementPending());
  }, []);
```

- [ ] **Step 3: Make the Tour button override suppression**

In the Tour button's `onClick`, after `setTourKey((k) => k + 1);` add:

```tsx
            setTourForced(true);
```

- [ ] **Step 4: Gate the tour and mount the announcement**

Replace `<WelcomeModal key={tourKey} />` with:

```tsx
      {(!announcementPending || tourForced) && <WelcomeModal key={tourKey} />}

      <WhatsNewModal
        isPro={isPro}
        onSeeAll={(category) => {
          window.dispatchEvent(
            new CustomEvent('ppp:open-mockup-gallery', { detail: { category } })
          );
        }}
      />
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc silent; tests pass; build compiles.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/TopBar.tsx
git commit -m "feat(announcements): mount what's new modal, suppress tour while pending"
```

---

## Manual verification (after deploy)

Run on the deployed site, and on iPad:

1. Clear `whatsNewSeen` in localStorage, reload → modal appears, welcome tour does not.
2. Click **See All 7 Seasonal** → gallery opens on the Seasonal tab with 7 mockups.
3. Reload → modal does not reappear.
4. Click **Tour** → the 9-step tour still runs.
5. In devtools set `whatsNewSeen` to `old-version`, reload → modal appears again.
6. iPad: modal fits without the page scrolling; all buttons tappable; thumbnails equal size.
