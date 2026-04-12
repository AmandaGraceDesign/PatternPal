# Fullscreen Pattern View

## Summary

Add a fullscreen view that hides all app chrome (TopBar, PatternControlsTopBar, AdvancedToolsBar) so users can view their repeating pattern in an immersive, distraction-free canvas. Pan and zoom remain fully functional in fullscreen mode.

## Approach: Hybrid Fullscreen

Try the browser's native Fullscreen API (`requestFullscreen()`) for a truly immersive experience (no browser tabs/address bar). If the API is unavailable or fails (e.g., iOS Safari), fall back to CSS-only mode that hides the app's chrome bars but leaves the browser UI visible.

## Enter / Exit Flow

**Enter:**
1. User clicks the floating fullscreen icon button (top-right corner of the canvas area)
2. Set `isFullscreen = true`
3. Attempt `document.documentElement.requestFullscreen()`
4. If the promise rejects, continue in CSS-only fallback mode (chrome bars still hidden)

**Exit:**
1. User clicks the same button (now showing the compress/minimize icon)
2. If browser fullscreen is active, call `document.exitFullscreen()`
3. Set `isFullscreen = false`
4. Listen for `fullscreenchange` event to sync state when user exits via browser's built-in Esc key

## What Changes in Fullscreen

- **Hidden:** TopBar, PatternControlsTopBar, AdvancedToolsBar
- **Expanded:** Canvas container fills the full viewport (or full screen in native mode)
- **Preserved:** Pan, zoom, rulers, tile outline, scale preview state, zoom level — nothing resets
- **Button swaps icon:** Expand icon (four outward arrows) becomes compress icon (four inward arrows)

## Button Design

- **Position:** Top-right corner of the canvas area, floating overlay
- **Size:** 36×36px, border-radius 8px
- **Style:** Frosted glass — `background: rgba(255,255,255,0.60)`, `backdrop-filter: blur(8px)`, `border: 1px solid rgba(0,0,0,0.12)`, `box-shadow: 0 1px 3px rgba(0,0,0,0.15)`
- **Icon:** Dark stroke (`#333`), 16×16, stroke-width 2.5, no fill
  - Enter: four outward-pointing corner arrows (standard fullscreen icon)
  - Exit: four inward-pointing corner arrows (standard compress icon)
- **Icon style:** Inline SVG matching existing codebase pattern (no icon library)
- **Hover:** Slight opacity increase to signal interactivity
- **Z-index:** Above canvas content but below modals

## State

Single boolean `isFullscreen` in `app/page.tsx`, same level as existing view state (`zoom`, `scalePreviewSize`, etc.). Passed to the canvas component as a prop along with an `onToggleFullscreen` callback.

## Files to Modify

- **`app/page.tsx`** — Add `isFullscreen` state. Conditionally hide TopBar, PatternControlsTopBar, AdvancedToolsBar when true. Pass `isFullscreen` and `onToggleFullscreen` to canvas.
- **`src/components/canvas/PatternPreviewCanvas.tsx`** — Add the floating fullscreen button overlay inside the canvas wrapper. Handle `requestFullscreen()` / `exitFullscreen()` calls and `fullscreenchange` event listener.

## Not in Scope

- Keyboard shortcuts
- Touch gestures (e.g., multi-finger tap)
- Any changes to export, analysis, mockups, or other features
- No new files — button lives inside the existing canvas component
