import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  shouldShowAnnouncement,
  isAnnouncementPending,
  markAnnouncementSeen,
  ANNOUNCEMENT_STORAGE_KEY,
} from '../lib/announcements/announcementState';

// ANN-01: the version gate that decides whether the "what's new" modal shows.

/** Swap in a fake localStorage for one test. Returns the restore fn. */
function useStorage(impl: Partial<Storage>) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: impl, configurable: true });
  return () => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  };
}

describe('ANN-01: announcement version gate', () => {
  const restores: Array<() => void> = [];
  afterEach(() => {
    while (restores.length) restores.pop()!();
    vi.restoreAllMocks();
  });

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
