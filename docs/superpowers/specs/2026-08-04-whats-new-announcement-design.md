# "What's New" Announcement Modal — Design

**Date:** 2026-08-04
**Status:** Approved (demo reviewed and signed off)

## Goal

Surface newly added mockups to users on arrival, so a batch drop actually gets
discovered instead of sitting unseen behind the gallery's "All" tab. First use
is the seven Seasonal mockups shipped 2026-08-04.

The mechanism is reusable: every future drop (Christmas, spring, etc.) reuses
the same component and is announced by editing one config file.

## Decisions

These were settled during brainstorming and confirmed against a clickable demo.

| Decision | Choice | Why |
|---|---|---|
| Format | Centered modal, blocking | Chosen over the existing bottom slide-up bar pattern for visibility. |
| Audience | Everyone — signed out, free, and Pro | All seasonal mockups are Pro-locked. For free users it's an upgrade prompt; for Pro it's engagement. |
| Free-user treatment | Adds an "Included with Pro" chip | Honest — signals the lock before the click rather than after. Uses the existing gold badge token. |
| Re-showing | Version string, not a boolean | User adds holiday mockups over time. A boolean would announce once, ever. |
| Welcome tour | Suppressed while an announcement is pending | Two stacked modals is a bad first run. Tour is *not* deleted. |
| Preview images | Reuse `/mockups/v2/thumbnails/*.jpg` | ~6 KB each, already on the CDN. Adds no download weight. |

## Non-goals

- Not deleting or altering the 9-step `WelcomeModal` tour or its **Tour** button.
- No per-user server-side state. localStorage only.
- No admin UI for composing announcements — it's a code-level config edit.
- Not changing the gallery's own behavior beyond accepting an initial category.

## Architecture

### New: `src/lib/announcements/currentAnnouncement.ts`

The single edit point for future drops. Pure data, no React.

```ts
export const CURRENT_ANNOUNCEMENT = {
  version: '2026-08-seasonal',   // bump to re-announce to everyone
  emoji: '🎃',
  title: 'New Seasonal Mockups',
  body: 'Seven new Halloween & autumn scenes are ready — drop your pattern straight onto them.',
  previewIds: ['halloween-cape', 'halloween-tumbler', 'halloween-bucket', 'halloween-cat-bandana'],
  moreNote: '…plus tea towel, doormat & leggings',
  ctaLabel: 'See All 7 Seasonal',
  ctaCategory: 'seasonal',
} as const;
```

Setting `version` to `null` disables the announcement entirely without deleting code.

### New: `src/lib/announcements/announcementState.ts`

Pure, testable gate logic — no DOM, no React. This is what the unit tests target.

- `hasSeenAnnouncement(stored, version)` → boolean
- `shouldShowAnnouncement(stored, version)` → boolean
- Storage read/write helpers that swallow errors (private browsing, storage
  disabled) and fail **closed** — a storage error means don't show, matching
  the existing `AffiliateSlideOut` behavior.

Key: `whatsNewSeen`, value: the version string.

### New: `src/components/announcements/WhatsNewModal.tsx`

Presentational. Mounted in `TopBar` alongside `WelcomeModal`.

- Reads the gate on mount; renders nothing when not showing.
- Centered card, white, `rounded-2xl` — matches `WelcomeModal`'s shell.
- Width capped at 452px (narrower than `WelcomeModal`'s `max-w-lg`/512px);
  height capped at `max-height: 85vh` with internal scroll, so it can never
  exceed the viewport on a short iPad-landscape window.
- Four preview thumbnails in a 4-up grid, collapsing to 2-up under 560px.
  The grid must use `repeat(4, minmax(0, 1fr))`, not `repeat(4, 1fr)` — a plain
  `1fr` won't shrink below its content's min-content width, so the longest
  caption widens its own column and its image renders larger than the rest.
  Captions are a fixed two-line clamped box so every card is the same height.
- Pro chip rendered only when the user is not Pro.
- Primary CTA, "Maybe later" secondary, and a close ✕. All three dismiss and
  write the version.
- Escape key and backdrop click dismiss.
- Touch: Pointer Events, ≥44px targets (iPad parity is mandatory).
- `role="dialog"`, `aria-modal`, labelled by the title, focus trapped, focus
  restored on close.
- Respects `prefers-reduced-motion`.

### Changed: `src/components/layout/TopBar.tsx`

- Mounts `WhatsNewModal`.
- Passes `isPro` (already computed there) so the chip can be conditional.
- Gates `WelcomeModal` behind "no announcement pending."

### Changed: `src/components/mockups/MockupGalleryModal.tsx`

- Accepts an optional `initialCategory` prop, defaulting to `'all'` so all
  existing call sites are unaffected.

### Changed: `src/components/layout/AdvancedToolsBar.tsx`

- Listens for a `ppp:open-mockup-gallery` window event carrying `{ category }`
  and opens its gallery on that category.
- The listener is registered only while mounted, so if a second gallery host
  is ever added, whichever is live responds.

`src/components/sidebar/ActionsSidebar.tsx` also mounts a gallery but is
imported nowhere — it is dead code and is deliberately left untouched.

## Data flow

```
TopBar mounts
  └─ WhatsNewModal reads localStorage.whatsNewSeen
       ├─ matches CURRENT_ANNOUNCEMENT.version → render nothing, tour may run
       └─ differs → render modal, suppress tour this visit
            └─ CTA click
                 ├─ write version to localStorage
                 ├─ close modal
                 └─ dispatch ppp:open-mockup-gallery { category: 'seasonal' }
                      └─ mounted toolbar opens MockupGalleryModal
                           initialCategory='seasonal'
                             ├─ free → 7 locked cards → existing upgrade modal
                             └─ pro  → 7 usable cards
```

## Error handling

- localStorage unavailable → don't show, don't throw.
- A `previewIds` entry with no thumbnail on disk → the `<img>` `onError`
  hides it, matching the gallery's existing fallback. The modal still renders.
- No toolbar mounted to receive the event → modal still closes and records the
  version. The CTA is best-effort; it never traps the user.

## Testing

Unit tests against the pure gate logic in `announcementState.ts`:

1. Fresh visitor (no stored value) → shows.
2. Stored value matches current version → hidden.
3. Stored value is an older version → shows (this is the re-announce path).
4. Storage throws → hidden, no exception escapes.
5. `version: null` → hidden regardless of stored value.
6. Tour suppression: tour runs only when the announcement is not pending.

Manual verification on deployed prod, on iPad: modal appears, CTA lands on the
Seasonal tab, dismissal survives a reload, and the Tour button still replays
the 9-step tour.

## Shipping the next batch

1. Add the mockups (registry entry, medium layers, thumbnails — see
   `mockup-new-template-checklist` memory).
2. Edit `currentAnnouncement.ts`: bump `version`, swap `previewIds`, `title`,
   `body`, `moreNote`, `ctaLabel`, `ctaCategory`.
3. Deploy. Everyone who dismissed the previous announcement sees the new one.

No component changes required.
