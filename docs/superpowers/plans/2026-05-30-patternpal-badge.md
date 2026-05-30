# "Tested in PatternPAL" Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stamp an auto-contrast "Tested in PatternPAL" brand badge onto Social Media and Mockup exports only — default-ON and removable for paid Pro users, locked-on for trial users.

**Architecture:** A new pure-ish badge module (`src/lib/badge/patternpalBadge.ts`) mirrors the existing watermark lib: it picks navy-vs-gold by sampling background luminance and stamps the chosen PNG into the bottom-left corner of a blob. A small shared toggle component is added to the three export panels. Each panel holds local `badgeEnabled` state and stamps the badge as the top layer, after the user watermark. Easyscale/Cricut and Pattern Fill export paths are untouched.

**Tech Stack:** Next.js (App Router) client components, TypeScript, HTML Canvas 2D, Vitest (jsdom). Reference design: `docs/superpowers/specs/2026-05-30-patternpal-badge-design.md`.

---

## File Structure

- **Create** `src/lib/badge/patternpalBadge.ts` — badge logic: variant pick, rect math, gating decision, luminance sampling, `applyBadgeToBlob`.
- **Create** `src/components/badge/PatternpalBadgeToggle.tsx` — the shared toggle row UI.
- **Create** `src/__tests__/patternpalBadge.test.ts` — unit tests for the pure functions.
- **Modify** `src/components/export/RepeatExportModal.tsx` — add `isPro` prop, `badgeEnabled` state, toggle row in social UI, stamp in the social export loop.
- **Modify** `src/components/layout/AdvancedToolsBar.tsx` — pass `isPro` to RepeatExportModal; add `badgeEnabled` state, toggle row, stamp in mockup `onDownload`.
- **Modify** `src/components/sidebar/ActionsSidebar.tsx` — add `badgeEnabled` state, toggle row, stamp in mockup `onDownload`.
- **Track** the two badge PNGs in git; ignore the source `.zip`.

**Conventions to follow:** tests import via **relative paths** (`../lib/...`), not the `@/` alias (vitest has no alias resolver). The codebase deliberately avoids canvas mocking in tests, so unit tests cover only pure functions; canvas-dependent behavior is verified manually.

---

### Task 1: Badge core module + pure-function tests

**Files:**
- Create: `src/lib/badge/patternpalBadge.ts`
- Test: `src/__tests__/patternpalBadge.test.ts`
- Track assets: `public/tested-in-patternpal-navy.png`, `public/tested-in-patternpal-gold.png`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/patternpalBadge.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  pickBadgeVariant,
  computeBadgeRect,
  shouldStampBadge,
  BADGE_WIDTH_PERCENT,
} from '../lib/badge/patternpalBadge';

describe('pickBadgeVariant', () => {
  it('returns navy on a light background', () => {
    expect(pickBadgeVariant(0.9)).toBe('navy');
  });
  it('returns gold on a dark background', () => {
    expect(pickBadgeVariant(0.1)).toBe('gold');
  });
  it('returns navy exactly at the threshold boundary (0.5 is not > 0.5 -> gold)', () => {
    expect(pickBadgeVariant(0.5)).toBe('gold');
    expect(pickBadgeVariant(0.51)).toBe('navy');
  });
});

describe('computeBadgeRect', () => {
  it('sizes the badge to BADGE_WIDTH_PERCENT of canvas width and bottom-left insets it', () => {
    const aspect = 4; // 4:1 badge
    const rect = computeBadgeRect(1000, 1500, aspect);
    expect(rect.drawW).toBe(Math.round(1000 * BADGE_WIDTH_PERCENT));
    expect(rect.drawH).toBe(Math.round(rect.drawW / aspect));
    const inset = Math.round(1000 * 0.04);
    expect(rect.drawX).toBe(inset);
    expect(rect.drawY).toBe(1500 - inset - rect.drawH);
  });
});

describe('shouldStampBadge', () => {
  it('honors badgeEnabled for paid Pro users', () => {
    expect(shouldStampBadge({ isPaidPro: true, badgeEnabled: true })).toBe(true);
    expect(shouldStampBadge({ isPaidPro: true, badgeEnabled: false })).toBe(false);
  });
  it('forces the badge on for trial (non-paid) users regardless of toggle', () => {
    expect(shouldStampBadge({ isPaidPro: false, badgeEnabled: false })).toBe(true);
    expect(shouldStampBadge({ isPaidPro: false, badgeEnabled: true })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/patternpalBadge.test.ts`
Expected: FAIL — cannot find module `../lib/badge/patternpalBadge`.

- [ ] **Step 3: Write the badge module**

Create `src/lib/badge/patternpalBadge.ts`:

```ts
export type BadgeVariant = 'navy' | 'gold';

/** Served from /public. Navy = dark mark for light backgrounds; gold = light
 *  mark for dark backgrounds. Both PNGs are the same artwork, so they share
 *  one aspect ratio. */
const BADGE_ASSETS: Record<BadgeVariant, string> = {
  navy: '/tested-in-patternpal-navy.png',
  gold: '/tested-in-patternpal-gold.png',
};

/** Badge width as a fraction of the exported canvas width. Single tuning knob. */
export const BADGE_WIDTH_PERCENT = 0.2;
/** Corner inset (left + bottom) as a fraction of canvas width. */
const BADGE_INSET_PERCENT = 0.04;
/** Perceptual-luminance threshold (0..1). Above this the background is "light". */
const LUMINANCE_THRESHOLD = 0.5;

/** Trial users always get the badge; paid Pro users can opt out via the toggle. */
export function shouldStampBadge(opts: { isPaidPro: boolean; badgeEnabled: boolean }): boolean {
  return opts.isPaidPro ? opts.badgeEnabled : true;
}

/** Light backgrounds get the navy mark, dark backgrounds get the gold mark. */
export function pickBadgeVariant(luminance: number): BadgeVariant {
  return luminance > LUMINANCE_THRESHOLD ? 'navy' : 'gold';
}

/** Bottom-left draw rectangle for the badge given the canvas size and the
 *  badge's width/height aspect ratio. */
export function computeBadgeRect(canvasW: number, canvasH: number, badgeAspect: number) {
  const drawW = Math.max(1, Math.round(canvasW * BADGE_WIDTH_PERCENT));
  const drawH = Math.max(1, Math.round(drawW / badgeAspect));
  const inset = Math.round(canvasW * BADGE_INSET_PERCENT);
  const drawX = inset;
  const drawY = canvasH - inset - drawH;
  return { drawX, drawY, drawW, drawH };
}

/** Average perceptual luminance (0..1) of a rectangle of a 2D context.
 *  Samples every 4th pixel for speed. Returns 1 (treated as light) if the
 *  region can't be read. */
export function sampleRegionLuminance(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
): number {
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.max(1, Math.floor(w));
  const sh = Math.max(1, Math.floor(h));
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(sx, sy, sw, sh).data;
  } catch {
    return 1;
  }
  let sum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 16) {
    sum += (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    count++;
  }
  return count > 0 ? sum / count : 1;
}

/** Load an image from a URL. Resolves null on failure. */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** One decode per PNG, mirroring the watermark logo cache. */
const badgeCache = new Map<string, Promise<HTMLImageElement | null>>();
function cachedLoadBadge(src: string): Promise<HTMLImageElement | null> {
  const existing = badgeCache.get(src);
  if (existing) return existing;
  const p = loadImage(src);
  badgeCache.set(src, p);
  return p;
}

/** Composite the contrast-appropriate PatternPAL badge into the bottom-left of
 *  an existing image blob and return a new blob. On any asset/context failure
 *  the input blob is returned unchanged so an export never fails over a badge.
 *  Callers gate with shouldStampBadge(); this function always stamps. */
export async function applyBadgeToBlob(
  blob: Blob, w: number, h: number, format: 'png' | 'jpg',
): Promise<Blob> {
  // Navy is loaded first purely to measure the shared aspect ratio.
  const measure = await cachedLoadBadge(BADGE_ASSETS.navy);
  if (!measure) return blob;
  const rect = computeBadgeRect(w, h, measure.width / measure.height);

  const img = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return blob;
  ctx.drawImage(img, 0, 0, w, h);

  const luminance = sampleRegionLuminance(ctx, rect.drawX, rect.drawY, rect.drawW, rect.drawH);
  const variant = pickBadgeVariant(luminance);
  const badgeImg = variant === 'navy' ? measure : await cachedLoadBadge(BADGE_ASSETS.gold);
  if (!badgeImg) return blob;
  ctx.drawImage(badgeImg, rect.drawX, rect.drawY, rect.drawW, rect.drawH);

  return new Promise(resolve => {
    canvas.toBlob(
      b => resolve(b ?? blob),
      format === 'jpg' ? 'image/jpeg' : 'image/png',
      format === 'jpg' ? 0.92 : undefined,
    );
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/patternpalBadge.test.ts`
Expected: PASS — all three describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/badge/patternpalBadge.ts src/__tests__/patternpalBadge.test.ts \
        public/tested-in-patternpal-navy.png public/tested-in-patternpal-gold.png
git commit -m "feat(badge): add PatternPAL badge module + assets"
```

---

### Task 2: Shared toggle component

**Files:**
- Create: `src/components/badge/PatternpalBadgeToggle.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/badge/PatternpalBadgeToggle.tsx`:

```tsx
'use client';

interface Props {
  enabled: boolean;
  onChange: (value: boolean) => void;
  /** Trial (non-paid) users: badge is forced on and the control is disabled. */
  locked?: boolean;
}

export default function PatternpalBadgeToggle({ enabled, onChange, locked = false }: Props) {
  const checked = locked ? true : enabled;
  return (
    <div className="border-2 border-[#e0c26e] rounded-md px-3 py-2.5 bg-[#faf3e0]">
      <label className="flex items-start gap-2.5 cursor-pointer" style={{ touchAction: 'manipulation' }}>
        <input
          type="checkbox"
          checked={checked}
          disabled={locked}
          onChange={e => onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-[#294051]"
        />
        <span className="flex flex-col">
          <span className="text-xs font-semibold text-[#294051]">Tested in PatternPAL badge</span>
          <span className="text-[10px] text-[#705046]">
            {locked
              ? 'Included on trial exports — upgrade to remove'
              : 'Adds a small PatternPAL mark to the bottom-left corner'}
          </span>
        </span>
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: PASS (no errors related to the new file).

- [ ] **Step 3: Commit**

```bash
git add src/components/badge/PatternpalBadgeToggle.tsx
git commit -m "feat(badge): add shared PatternpalBadgeToggle row"
```

---

### Task 3: Wire badge into Social Media Export

**Files:**
- Modify: `src/components/export/RepeatExportModal.tsx`
- Modify: `src/components/layout/AdvancedToolsBar.tsx` (pass `isPro` prop)

- [ ] **Step 1: Add imports to RepeatExportModal**

In `src/components/export/RepeatExportModal.tsx`, immediately after the existing line:

```tsx
import WatermarkPanel from '@/components/watermark/WatermarkPanel';
```

add:

```tsx
import PatternpalBadgeToggle from '@/components/badge/PatternpalBadgeToggle';
import { applyBadgeToBlob, shouldStampBadge } from '@/lib/badge/patternpalBadge';
```

- [ ] **Step 2: Add the `isPro` prop**

In the `RepeatExportModalProps` interface, add a field after `initialMode?: ...;`:

```tsx
  /** True for PAID Pro users (not trial). Controls whether the badge toggle is
   *  user-removable; trial users get the badge locked on. */
  isPro?: boolean;
```

In the component signature destructure, add `isPro,` after `initialMode,`:

```tsx
  originalFilename,
  initialMode,
  isPro,
}: RepeatExportModalProps) {
```

- [ ] **Step 3: Add `badgeEnabled` state and reset**

After the watermark state line:

```tsx
  const [watermark, setWatermark] = useState<WatermarkConfig>({ ...DEFAULT_WATERMARK });
```

add:

```tsx
  const [badgeEnabled, setBadgeEnabled] = useState(true);
```

In the "Reset on open" effect, after `setWatermark({ ...DEFAULT_WATERMARK });`, add:

```tsx
      setBadgeEnabled(true);
```

- [ ] **Step 4: Stamp the badge in the social export loop**

In the social export `for` loop, find the watermark stamp block:

```tsx
          // Stamp watermark onto exported image (if text OR a logo is present)
          if (watermark.enabled && (watermark.text.trim() || watermark.logoDataUrl)) {
            blob = await applyWatermarkToBlob(blob, exportPxW, exportPxH, watermark, socialFormat);
          }
```

Immediately after that block (still inside the `try`), add:

```tsx
          // Stamp the "Tested in PatternPAL" badge as the top layer
          if (shouldStampBadge({ isPaidPro: !!isPro, badgeEnabled })) {
            blob = await applyBadgeToBlob(blob, exportPxW, exportPxH, socialFormat);
          }
```

- [ ] **Step 5: Add the toggle row to the social UI**

Find the watermark panel in the social view:

```tsx
                    {/* Watermark */}
                    <WatermarkPanel watermark={watermark} setWatermark={setWatermark} />
```

Immediately after it, add:

```tsx
                    {/* PatternPAL badge */}
                    <PatternpalBadgeToggle
                      enabled={badgeEnabled}
                      onChange={setBadgeEnabled}
                      locked={!isPro}
                    />
```

- [ ] **Step 6: Pass `isPro` from AdvancedToolsBar**

In `src/components/layout/AdvancedToolsBar.tsx`, in the `<RepeatExportModal ... />` usage, add the prop after `initialMode={...}`:

```tsx
        initialMode={repeatModalMode ?? undefined}
        isPro={isPro}
      />
```

(`isPro` is already defined in this component as the paid-Pro check — do not use `proAllowed`, which is true for trials.)

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/export/RepeatExportModal.tsx src/components/layout/AdvancedToolsBar.tsx
git commit -m "feat(badge): stamp badge on Social Media exports"
```

---

### Task 4: Wire badge into Mockup download (AdvancedToolsBar)

**Files:**
- Modify: `src/components/layout/AdvancedToolsBar.tsx`

- [ ] **Step 1: Add imports**

After the existing line:

```tsx
import WatermarkPanel from '@/components/watermark/WatermarkPanel';
```

add:

```tsx
import PatternpalBadgeToggle from '@/components/badge/PatternpalBadgeToggle';
import { applyBadgeToBlob, shouldStampBadge } from '@/lib/badge/patternpalBadge';
```

- [ ] **Step 2: Add `badgeEnabled` state**

After the watermark state line:

```tsx
  const [watermark, setWatermark] = useState<WatermarkConfig>({ ...DEFAULT_WATERMARK });
```

add:

```tsx
  const [badgeEnabled, setBadgeEnabled] = useState(true);
```

- [ ] **Step 3: Stamp the badge in the mockup `onDownload`**

In the mockup `downloadAfterRenderRef.current` callback, find:

```tsx
                  const wmActive = watermark.enabled && (watermark.text.trim() || watermark.logoDataUrl);
                  const composedBlob = wmActive
                    ? await applyWatermarkToBlob(
                        sourceBlob, dl.width, dl.height, watermark, 'png',
                      )
                    : sourceBlob;
                  const finalBlob = await injectPngDpi(composedBlob, OUTPUT_DPI);
```

Replace it with:

```tsx
                  const wmActive = watermark.enabled && (watermark.text.trim() || watermark.logoDataUrl);
                  let composedBlob = wmActive
                    ? await applyWatermarkToBlob(
                        sourceBlob, dl.width, dl.height, watermark, 'png',
                      )
                    : sourceBlob;
                  if (shouldStampBadge({ isPaidPro: isPro, badgeEnabled })) {
                    composedBlob = await applyBadgeToBlob(composedBlob, dl.width, dl.height, 'png');
                  }
                  const finalBlob = await injectPngDpi(composedBlob, OUTPUT_DPI);
```

(Only changes: `const` → `let`, and the inserted badge block.)

- [ ] **Step 4: Add the toggle row to the mockup UI**

Find the mockup watermark panel:

```tsx
              {/* Watermark (text + logo) — same UX as social export */}
              <WatermarkPanel watermark={watermark} setWatermark={setWatermark} />
```

Immediately after it, add:

```tsx
              {/* PatternPAL badge */}
              <PatternpalBadgeToggle
                enabled={badgeEnabled}
                onChange={setBadgeEnabled}
                locked={!isPro}
              />
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/AdvancedToolsBar.tsx
git commit -m "feat(badge): stamp badge on mockup downloads (AdvancedToolsBar)"
```

---

### Task 5: Wire badge into Mockup download (ActionsSidebar)

**Files:**
- Modify: `src/components/sidebar/ActionsSidebar.tsx`

- [ ] **Step 1: Add imports**

After the existing line:

```tsx
import WatermarkPanel from '@/components/watermark/WatermarkPanel';
```

add:

```tsx
import PatternpalBadgeToggle from '@/components/badge/PatternpalBadgeToggle';
import { applyBadgeToBlob, shouldStampBadge } from '@/lib/badge/patternpalBadge';
```

- [ ] **Step 2: Add `badgeEnabled` state**

After the watermark state line:

```tsx
  const [watermark, setWatermark] = useState<WatermarkConfig>({ ...DEFAULT_WATERMARK });
```

add:

```tsx
  const [badgeEnabled, setBadgeEnabled] = useState(true);
```

- [ ] **Step 3: Restructure the mockup `onDownload` to stamp watermark and/or badge**

Find this block in the `onDownload` handler:

```tsx
              const wmActive = watermark.enabled && (watermark.text.trim() || watermark.logoDataUrl);
              if (wmActive) {
                const sourceBlob: Blob = await new Promise((resolve, reject) =>
                  mockupCanvas.toBlob(
                    b => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
                    'image/png',
                  ),
                );
                const stamped = await applyWatermarkToBlob(
                  sourceBlob, mockupCanvas.width, mockupCanvas.height, watermark, 'png',
                );
                await downloadBlobAsImage(stamped, filename);
              } else {
                await downloadCanvasAsImage(mockupCanvas, filename);
              }
```

Replace it with:

```tsx
              const wmActive = watermark.enabled && (watermark.text.trim() || watermark.logoDataUrl);
              const stampBadge = shouldStampBadge({ isPaidPro: isPro, badgeEnabled });
              if (wmActive || stampBadge) {
                let composed: Blob = await new Promise((resolve, reject) =>
                  mockupCanvas.toBlob(
                    b => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
                    'image/png',
                  ),
                );
                if (wmActive) {
                  composed = await applyWatermarkToBlob(
                    composed, mockupCanvas.width, mockupCanvas.height, watermark, 'png',
                  );
                }
                if (stampBadge) {
                  composed = await applyBadgeToBlob(
                    composed, mockupCanvas.width, mockupCanvas.height, 'png',
                  );
                }
                await downloadBlobAsImage(composed, filename);
              } else {
                await downloadCanvasAsImage(mockupCanvas, filename);
              }
```

- [ ] **Step 4: Add the toggle row to the mockup UI**

Find the watermark panel:

```tsx
            {/* Watermark (text + logo) — same UX as social export */}
            <WatermarkPanel watermark={watermark} setWatermark={setWatermark} />
```

Immediately after it, add:

```tsx
            {/* PatternPAL badge */}
            <PatternpalBadgeToggle
              enabled={badgeEnabled}
              onChange={setBadgeEnabled}
              locked={!isPro}
            />
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/sidebar/ActionsSidebar.tsx
git commit -m "feat(badge): stamp badge on mockup downloads (ActionsSidebar)"
```

---

### Task 6: Housekeeping + full verification

**Files:**
- Modify/Create: `.gitignore`

- [ ] **Step 1: Ignore the source asset zip**

Append to `.gitignore` (create it if absent):

```
# PatternPAL badge source package — not served, not committed
public/tested-in-patternpal.zip
```

- [ ] **Step 2: Confirm the zip is not tracked**

Run: `git status --porcelain public/tested-in-patternpal.zip`
Expected: no output (ignored/untracked, not staged).

- [ ] **Step 3: Run the full unit-test suite**

Run: `npm test`
Expected: PASS, including `patternpalBadge.test.ts`. No previously-passing test regresses.

- [ ] **Step 4: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Manual verification (browser, including iPad/touch)**

Run `npm run dev` and verify:
1. **Social export, paid Pro:** toggle visible, ON by default; export a light pattern → navy badge bottom-left; export a dark pattern → gold badge; toggle OFF → no badge.
2. **Mockup download, paid Pro (both the toolbar and sidebar entry points):** same toggle behavior; badge appears bottom-left on the downloaded PNG.
3. **Trial user (`proAccess === 'allowed'`, not paid):** toggle is checked + disabled with the "upgrade to remove" hint; badge is always stamped.
4. **Negative — no badge leaks:** run an **Easyscale/Cricut** export and a **Pattern Fill** export → confirm NO PatternPAL badge on either.
5. **Coexistence:** with a user watermark logo set (bottom-center) AND the badge ON, both render without the badge obscuring the user logo.
6. **iPad/touch:** the toggle checkbox responds to tap/Pencil.

- [ ] **Step 6: Commit**

```bash
git add .gitignore
git commit -m "chore(badge): ignore badge source zip; finalize"
```

---

## Self-Review Notes

- **Spec coverage:** placement (Task 1 `computeBadgeRect`), auto-contrast color (Task 1 `pickBadgeVariant` + `sampleRegionLuminance`), gating incl. trial-forced-on (Task 1 `shouldStampBadge`, wired in Tasks 3–5 using paid `isPro`), social stamp (Task 3), both mockup stamps (Tasks 4–5), toggle UI its own row (Task 2, placed in Tasks 3–5), Easyscale/Pattern-Fill untouched (verified Task 6 step 5.4), zip housekeeping (Task 6). All spec sections map to a task.
- **Type consistency:** `applyBadgeToBlob(blob, w, h, format)` and `shouldStampBadge({ isPaidPro, badgeEnabled })` signatures are identical at all call sites. The RepeatExportModal prop is `isPro` (paid); AdvancedToolsBar passes its paid `isPro`, not `proAllowed`.
- **No placeholders:** every code step shows complete code; every run step shows the command and expected result.
