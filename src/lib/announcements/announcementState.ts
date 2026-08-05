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
