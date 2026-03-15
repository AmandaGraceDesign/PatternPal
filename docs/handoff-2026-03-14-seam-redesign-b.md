# Handoff — March 14, 2026 (evening) — Seam Inspector Redesign

## Branch: `seam-analyzer`

## Goal

Redesign SeamInspector to open as a full-page view in a **new browser tab** instead of a modal. Single view mode with pink dashed tile outline.

## Status: BLOCKED — Data Transfer Too Large for Storage APIs

### What's Done
- [x] `openSeamInspector` helper created (`src/lib/seam-inspector/openSeamInspector.ts`)
- [x] `/seam-inspector` page route created (`app/seam-inspector/page.tsx`)
- [x] `SeamInspectorCanvas` full-page component created (`src/components/analysis/SeamInspectorCanvas.tsx`)
- [x] Canvas wired into page route
- [x] SeamAnalyzer, AdvancedToolsBar, ActionsSidebar rewired to use `openSeamInspector()`
- [x] Old SeamInspector modal deleted
- [x] Build passes clean

### What's Broken

**The image data URL exceeds both `sessionStorage` and `localStorage` quotas.**

The `openSeamInspector` helper converts the pattern image to a PNG data URL via `canvas.toDataURL('image/png')`. For large pattern images, this data URL is too large for web storage APIs (~5MB limit each).

Error: `QuotaExceededError: Failed to execute 'setItem' on 'Storage'`

The original postMessage approach also didn't work — the handshake failed silently (likely React strict mode double-mounting the useEffect in dev, causing the `ready`/`init` sequence to desync).

### Fix Options (in order of preference)

1. **Blob URL + postMessage hybrid** — Convert image to a Blob URL (no size limit), store only the metadata in sessionStorage, and pass the Blob URL separately. The child tab can fetch the Blob URL since it's same-origin. However, Blob URLs are revoked when the parent navigates away, so the child needs to copy the data immediately.

2. **Fix the postMessage handshake** — Add retry logic: child sends `ready` every 200ms until it receives `init`. Parent responds to every `ready` idempotently. This handles the strict mode double-mount.

3. **IndexedDB** — No size limit. Parent writes image data to IndexedDB, child reads it. More code but very reliable.

4. **SharedWorker or BroadcastChannel** — Modern APIs for cross-tab communication. BroadcastChannel has good support (Chrome 54+, Safari 15.4+).

### Recommended: Option 2 (fix postMessage with retry)

Simplest change. In the child's useEffect, send `ready` on a 200ms interval until `init` is received. In the parent, keep the listener active and respond to each `ready` (idempotently — only send `init` once). This is resilient to React strict mode and timing issues.

## Key Files

| File | Status |
|------|--------|
| `src/lib/seam-inspector/openSeamInspector.ts` | Needs fix — storage approach doesn't work for large images |
| `app/seam-inspector/page.tsx` | Needs fix — must match whatever data transfer approach is chosen |
| `src/components/analysis/SeamInspectorCanvas.tsx` | Done — full-page canvas component works |
| `src/components/analysis/SeamAnalyzer.tsx` | Done — rewired |
| `src/components/layout/AdvancedToolsBar.tsx` | Done — rewired |
| `src/components/sidebar/ActionsSidebar.tsx` | Done — rewired |

## Commits This Session

- `99fb2fa` feat: add openSeamInspector helper for cross-tab communication
- `2d34390` feat: add /seam-inspector page route with postMessage handshake
- `d9c0c77` feat: add SeamInspectorCanvas full-page component
- `0a931ba` feat: wire SeamInspectorCanvas into page route
- `4e5bf09` refactor: SeamAnalyzer uses openSeamInspector
- `a15fa67` refactor: AdvancedToolsBar uses openSeamInspector
- `ea4aa6f` refactor: ActionsSidebar uses openSeamInspector
- `323d8d0` refactor: remove old SeamInspector modal
- `78e8c19` fix: replace postMessage with sessionStorage (BROKEN — QuotaExceededError)

## To Resume

Fix the data transfer between parent and child tabs. Only two files need changes: `openSeamInspector.ts` and `app/seam-inspector/page.tsx`. Everything else is done and working.

Spec: `docs/superpowers/specs/2026-03-14-seam-inspector-redesign.md`
Plan: `docs/superpowers/plans/2026-03-14-seam-inspector-redesign.md`
