# Pattern Fill Export Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Pattern Fill Export to serve social media creators via a destination picker, adding 5 platform-sized exports each with their own independent scale control.

**Architecture:** Add `generateSocialFillBlob` to the existing export utility (returns a Blob, no DPI metadata), then restructure `RepeatExportModal` with a `mode` state machine (`picker → cricut | social`). The social view renders within the same modal component — no new files.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, JSZip (already installed), HTML Canvas API

---

## File Map

| File | Change |
|---|---|
| `src/lib/utils/repeatFillExport.ts` | Add `SocialFillBlobConfig` interface, `SOCIAL_DPI` constant, `generateSocialFillBlob` function |
| `src/components/export/RepeatExportModal.tsx` | Add `SizeSlug` type, `SOCIAL_SIZE_PRESETS`, mode state, picker view, full social media view, export handler |

No new files created.

---

## Task 1: Add `generateSocialFillBlob` to repeatFillExport.ts

**Files:**
- Modify: `src/lib/utils/repeatFillExport.ts`

- [ ] **Step 1: Add the interface and constant after the existing exports**

Open `src/lib/utils/repeatFillExport.ts`. After the `RepeatFillCalcResult` interface (line ~35), add:

```typescript
export const SOCIAL_DPI = 96;

export interface SocialFillBlobConfig {
  image: HTMLImageElement;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  targetPxW: number;
  targetPxH: number;
  format: 'png' | 'jpg';
  tileWidthInches: number;
  tileHeightInches: number;
  exportScale: number;
}
```

- [ ] **Step 2: Add `generateSocialFillBlob` at the bottom of the file**

```typescript
/**
 * Render a pattern fill at exact platform pixel dimensions and return a Blob.
 * Used for social media exports. Does NOT auto-download or inject DPI metadata.
 * Uses a fixed 96 DPI bridge to convert tile inches → pixels.
 */
export async function generateSocialFillBlob(
  config: SocialFillBlobConfig
): Promise<Blob> {
  const {
    image, repeatType, targetPxW, targetPxH,
    format, tileWidthInches, tileHeightInches, exportScale,
  } = config;

  // Convert HD/HB tile to full-drop canvas (same as generateRepeatFillExport)
  const mapped = mapRepeatType(repeatType);
  const tileSource: HTMLCanvasElement | HTMLImageElement =
    mapped === 'fulldrop' ? image : convertToFullDrop(image, mapped);

  // DPI bridge: tile size in pixels at current scale
  const tilePixelW = tileWidthInches * exportScale * SOCIAL_DPI;
  const tileAspect = tileWidthInches / tileHeightInches;
  const tilePixelH = tilePixelW / tileAspect;

  const repeatsX = Math.max(1, Math.round(targetPxW / tilePixelW));
  const repeatsY = Math.max(1, Math.round(targetPxH / tilePixelH));

  // Actual tile size fitted evenly into the exact output dimensions
  const actualTilePxW = targetPxW / repeatsX;
  const actualTilePxH = targetPxH / repeatsY;

  // Create canvas at EXACT platform pixel dimensions
  const canvas = document.createElement('canvas');
  canvas.width = targetPxW;
  canvas.height = targetPxH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetPxW, targetPxH);

  // Tile with +1px overlap to prevent sub-pixel seam lines
  for (let x = 0; x < repeatsX; x++) {
    for (let y = 0; y < repeatsY; y++) {
      const dx = Math.floor(x * actualTilePxW);
      const dy = Math.floor(y * actualTilePxH);
      const dw = Math.ceil(actualTilePxW) + 1;
      const dh = Math.ceil(actualTilePxH) + 1;
      ctx.drawImage(tileSource, dx, dy, dw, dh);
    }
  }

  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const quality = format === 'jpg' ? 0.95 : undefined;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to create image blob.'));
      },
      mimeType,
      quality
    );
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/amandacorcoran/Documents/patternpal-pro && npx tsc --noEmit
```

Expected: no errors related to `repeatFillExport.ts`

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/repeatFillExport.ts
git commit -m "feat: add generateSocialFillBlob — pixel-native blob export for social media"
```

---

## Task 2: Add types, constants and mode state to RepeatExportModal

**Files:**
- Modify: `src/components/export/RepeatExportModal.tsx`

- [ ] **Step 1: Add `SizeSlug`, `SocialSizePreset`, and `SOCIAL_SIZE_PRESETS` after the imports**

At the top of `RepeatExportModal.tsx`, after the existing imports, add:

```typescript
import { generateSocialFillBlob, SOCIAL_DPI, SocialFillBlobConfig } from '@/lib/utils/repeatFillExport';
import JSZip from 'jszip';
```

Then add these constants before the component (after `MAX_SCALE`):

```typescript
type SizeSlug =
  | 'instagram-post'
  | 'instagram-portrait'
  | 'story'
  | 'pinterest-pin'
  | 'facebook-cover';

interface SocialSizePreset {
  slug: SizeSlug;
  label: string;
  pxW: number;
  pxH: number;
}

const SOCIAL_SIZE_PRESETS: SocialSizePreset[] = [
  { slug: 'instagram-post',      label: 'Instagram / Facebook Post',     pxW: 1080, pxH: 1080 },
  { slug: 'instagram-portrait',  label: 'Instagram / Facebook Portrait',  pxW: 1080, pxH: 1350 },
  { slug: 'story',               label: 'Story / Reel / TikTok',          pxW: 1080, pxH: 1920 },
  { slug: 'pinterest-pin',       label: 'Pinterest Pin',                  pxW: 1000, pxH: 1500 },
  { slug: 'facebook-cover',      label: 'Facebook Cover',                 pxW: 1640, pxH: 624  },
];

const SOCIAL_PREVIEW_MAX_PX = 90; // max dimension for per-size preview thumbnail
```

- [ ] **Step 2: Add `mode`, `socialFormat`, `checkedSizes`, and `scalesRef` state inside the component**

Inside `RepeatExportModal`, after the existing state declarations:

```typescript
type ModalMode = 'picker' | 'cricut' | 'social';
const [mode, setMode] = useState<ModalMode>('picker');
const [socialFormat, setSocialFormat] = useState<'png' | 'jpg'>('jpg');
const [checkedSizes, setCheckedSizes] = useState<Set<SizeSlug>>(new Set());
const scalesRef = useRef<Record<SizeSlug, number>>({} as Record<SizeSlug, number>);
const selectAllRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 3: Reset all state on modal open**

Update the existing `useEffect` that runs when `isOpen` changes to also reset mode and social state:

```typescript
useEffect(() => {
  if (isOpen) {
    setError(null);
    setIsExporting(false);
    setExportScale(1.0);
    setMode('picker');
    setSocialFormat('jpg');
    setCheckedSizes(new Set());
    scalesRef.current = {};
  }
}, [isOpen]);
```

- [ ] **Step 4: Commit**

```bash
git add src/components/export/RepeatExportModal.tsx
git commit -m "feat: add mode state and social media constants to RepeatExportModal"
```

---

## Task 3: Add destination picker view and wrap Cricut content

**Files:**
- Modify: `src/components/export/RepeatExportModal.tsx`

- [ ] **Step 1: Wrap the existing Cricut modal content**

The current modal body has a shared outer scroll container:
```tsx
<div className="p-6 overflow-auto max-h-[calc(90vh-120px)]">
  {!image ? ... : <div className="space-y-5">...cricut UI...</div>}
</div>
```

**Remove that outer `<div>` entirely.** Each mode branch will own its own container with its own padding and scroll. Replace the whole body block with three sibling mode branches:

```tsx
{/* Picker */}
{mode === 'picker' && ( ... )}

{/* Cricut */}
{mode === 'cricut' && ( ... )}

{/* Social */}
{mode === 'social' && ( ... )}
```

The Cricut branch should wrap the existing content in its own container:
```tsx
{mode === 'cricut' && (
  <div className="p-6 overflow-auto max-h-[calc(90vh-120px)]">
    {!image ? (
      <div className="text-center py-8">
        <p className="text-sm text-[#6b7280]">No pattern loaded. Please upload a pattern first.</p>
      </div>
    ) : (
      <div className="space-y-5">
        {/* ... ALL existing cricut UI stays exactly the same ... */}
      </div>
    )}
  </div>
)}
```

```tsx
{/* Cricut / Silhouette path — existing content, unchanged */}
{mode === 'cricut' && (
  <>
    {!image ? (
      <div className="text-center py-8">
        <p className="text-sm text-[#6b7280]">
          No pattern loaded. Please upload a pattern first.
        </p>
      </div>
    ) : (
      <div className="space-y-5">
        {/* ... ALL existing cricut UI stays exactly the same ... */}
      </div>
    )}
  </>
)}
```

- [ ] **Step 2: Add the destination picker view**

Before the cricut block, add the picker view:

```tsx
{/* Destination picker */}
{mode === 'picker' && (
  <div className="p-6 space-y-4">
    <p className="text-sm text-center text-[#6b7280]">What are you exporting for?</p>
    <div className="space-y-3">
      <button
        onClick={() => setMode('cricut')}
        className="w-full text-left px-4 py-4 border-2 border-[#e0c26e] rounded-lg bg-[#faf3e0] hover:bg-[#f5ecd0] transition-colors"
      >
        <div className="text-sm font-semibold text-[#294051]">🖨 Cricut / Silhouette</div>
        <div className="text-xs text-[#9ca3af] mt-1">Digital paper · print files · Etsy / Creative Fabrica</div>
      </button>
      <button
        onClick={() => setMode('social')}
        className="w-full text-left px-4 py-4 border-2 border-[#e5e7eb] rounded-lg bg-white hover:bg-[#f9fafb] transition-colors"
      >
        <div className="text-sm font-semibold text-[#294051]">📱 Social Media</div>
        <div className="text-xs text-[#9ca3af] mt-1">Instagram · Pinterest · TikTok · Facebook</div>
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 3: Update the Escape key handler to respect `isExporting`**

The existing Escape `useEffect` (around line 107) closes the modal unconditionally. Update it to guard against `isExporting`:

```typescript
useEffect(() => {
  if (!isOpen) return;
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !isExporting) onClose();
  };
  window.addEventListener('keydown', handleEscape);
  return () => window.removeEventListener('keydown', handleEscape);
}, [isOpen, onClose, isExporting]);
```

- [ ] **Step 4: Update the modal header to show Back button when in cricut or social mode**

Replace the existing header title with:

```tsx
<div className="px-4 py-3 border-b border-[#92afa5]/30 flex items-center justify-between bg-[#e0c26e]">
  <div className="flex items-center gap-3">
    {mode !== 'picker' && (
      <button
        onClick={() => setMode('picker')}
        className="text-white/80 hover:text-white text-xs transition-colors"
        disabled={isExporting}
      >
        ← Back
      </button>
    )}
    <h3 className="text-sm font-semibold text-white">
      {mode === 'picker' ? 'Pattern Fill Export' :
       mode === 'cricut' ? 'Cricut / Silhouette Export' :
       'Social Media Export'}
    </h3>
  </div>
  <button
    onClick={onClose}
    className="text-[#705046] hover:text-[#294051] transition-all duration-200"
    aria-label="Close"
    disabled={isExporting}
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>
</div>
```

- [ ] **Step 4: Verify TypeScript compiles and the Cricut path still renders correctly**

```bash
npx tsc --noEmit
```

Start dev server, click Pattern Fill Export → verify picker screen appears → click Cricut/Silhouette → verify existing Cricut UI works as before.

- [ ] **Step 5: Commit**

```bash
git add src/components/export/RepeatExportModal.tsx
git commit -m "feat: add destination picker to RepeatExportModal, wrap cricut path"
```

---

## Task 4: Add social media view — format toggle, Select All, size checkboxes

**Files:**
- Modify: `src/components/export/RepeatExportModal.tsx`

- [ ] **Step 1: Add a helper to manage Select All indeterminate state**

Add this `useEffect` inside the component (after the checkedSizes state):

```typescript
// Sync Select All checkbox indeterminate state (can't be done declaratively in JSX)
useEffect(() => {
  if (!selectAllRef.current) return;
  const count = checkedSizes.size;
  if (count === 0) {
    selectAllRef.current.checked = false;
    selectAllRef.current.indeterminate = false;
  } else if (count === SOCIAL_SIZE_PRESETS.length) {
    selectAllRef.current.checked = true;
    selectAllRef.current.indeterminate = false;
  } else {
    selectAllRef.current.checked = false;
    selectAllRef.current.indeterminate = true;
  }
}, [checkedSizes]);
```

- [ ] **Step 2: Add helper functions for toggling sizes**

Add these inside the component body before the return:

```typescript
const handleSelectAll = () => {
  if (checkedSizes.size === SOCIAL_SIZE_PRESETS.length) {
    setCheckedSizes(new Set());
  } else {
    const all = new Set<SizeSlug>(SOCIAL_SIZE_PRESETS.map(p => p.slug));
    // Initialize scale for any newly checked sizes
    all.forEach(slug => {
      if (!(slug in scalesRef.current)) {
        scalesRef.current[slug] = 1.0;
      }
    });
    setCheckedSizes(all);
  }
};

const handleToggleSize = (slug: SizeSlug) => {
  setCheckedSizes(prev => {
    const next = new Set(prev);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
      if (!(slug in scalesRef.current)) {
        scalesRef.current[slug] = 1.0;
      }
    }
    return next;
  });
};
```

- [ ] **Step 3: Add the social media view block after the cricut block**

```tsx
{/* Social media path */}
{mode === 'social' && (
  <div className="p-4 space-y-4 overflow-auto max-h-[calc(90vh-120px)]">
    {!image ? (
      <div className="text-center py-8">
        <p className="text-sm text-[#6b7280]">No pattern loaded. Please upload a pattern first.</p>
      </div>
    ) : (
      <>
        {/* Format toggle */}
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-semibold text-[#294051] uppercase tracking-wide">Format</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio" name="social-format" value="jpg"
              checked={socialFormat === 'jpg'}
              onChange={() => setSocialFormat('jpg')}
              style={{ accentColor: '#e0c26e' }}
              disabled={isExporting}
            />
            <span className="text-xs text-[#374151]">JPG</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio" name="social-format" value="png"
              checked={socialFormat === 'png'}
              onChange={() => setSocialFormat('png')}
              style={{ accentColor: '#e0c26e' }}
              disabled={isExporting}
            />
            <span className="text-xs text-[#374151]">PNG</span>
          </label>
        </div>

        {/* Select All */}
        <div>
          <h4 className="text-[10px] font-semibold text-[#294051] uppercase tracking-wide mb-2">Select Sizes</h4>
          <label className="flex items-center gap-2 px-3 py-2 bg-[#faf3e0] border border-[#e0c26e]/40 rounded-md cursor-pointer mb-2">
            <input
              ref={selectAllRef}
              type="checkbox"
              onChange={handleSelectAll}
              style={{ accentColor: '#e0c26e', width: 13, height: 13 }}
              disabled={isExporting}
            />
            <span className="text-xs font-semibold text-[#294051]">Select All</span>
          </label>

          {/* Size rows */}
          <div className="space-y-2">
            {SOCIAL_SIZE_PRESETS.map(preset => {
              const isChecked = checkedSizes.has(preset.slug);
              return (
                <SocialSizeRow
                  key={preset.slug}
                  preset={preset}
                  isChecked={isChecked}
                  onToggle={() => handleToggleSize(preset.slug)}
                  isExporting={isExporting}
                  image={image}
                  tileWidth={tileWidth}
                  tileHeight={tileHeight}
                  repeatType={repeatType}
                  originalFilename={originalFilename}
                  socialFormat={socialFormat}
                  scalesRef={scalesRef}
                />
              );
            })}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
            <p className="text-xs text-orange-700">{error}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-xs font-medium bg-white border border-[#e5e7eb] rounded-md text-[#374151] hover:bg-[#f5f5f5] transition-colors"
            disabled={isExporting}
          >
            Cancel
          </button>
          <button
            onClick={handleSocialExport}
            disabled={isExporting || checkedSizes.size === 0}
            className="flex-1 px-4 py-2.5 text-xs font-medium text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#e0c26e' }}
          >
            {isExporting
              ? 'Exporting...'
              : checkedSizes.size === 0
              ? 'Select a Size'
              : checkedSizes.size === 1
              ? 'Export 1 Image'
              : `Export ${checkedSizes.size} Images`}
          </button>
        </div>
      </>
    )}
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/export/RepeatExportModal.tsx
git commit -m "feat: add social media view skeleton — format toggle, Select All, size list"
```

---

## Task 5: Add `SocialSizeRow` component with per-size preview and scale controls

**Files:**
- Modify: `src/components/export/RepeatExportModal.tsx`

This is a focused sub-component defined in the same file, above `RepeatExportModal`.

- [ ] **Step 1: Add helper to compute social preview dimensions**

Add before the `SocialSizeRow` component:

```typescript
/** Preview canvas dimensions: max 90px on longest side, exact aspect ratio */
function socialPreviewDims(pxW: number, pxH: number): { w: number; h: number } {
  const aspect = pxW / pxH;
  if (pxW >= pxH) {
    return { w: SOCIAL_PREVIEW_MAX_PX, h: Math.round(SOCIAL_PREVIEW_MAX_PX / aspect) };
  } else {
    return { w: Math.round(SOCIAL_PREVIEW_MAX_PX * aspect), h: SOCIAL_PREVIEW_MAX_PX };
  }
}

/** Scale that produces exactly targetRepeatsX repeats at 96 DPI */
function socialScaleForRepeatsX(
  targetPxW: number,
  tileWidthInches: number,
  widthMultiplier: number,
  targetRepeatsX: number
): number {
  return targetPxW / (tileWidthInches * SOCIAL_DPI * widthMultiplier * targetRepeatsX);
}
```

- [ ] **Step 2: Add `SocialSizeRow` component above `RepeatExportModal`**

```tsx
interface SocialSizeRowProps {
  preset: SocialSizePreset;
  isChecked: boolean;
  onToggle: () => void;
  isExporting: boolean;
  image: HTMLImageElement;
  tileWidth: number;
  tileHeight: number;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  originalFilename: string | null;
  socialFormat: 'png' | 'jpg';
  scalesRef: React.MutableRefObject<Record<string, number>>;
}

function SocialSizeRow({
  preset, isChecked, onToggle, isExporting,
  image, tileWidth, tileHeight, repeatType,
  originalFilename, socialFormat, scalesRef,
}: SocialSizeRowProps) {
  const [, forceUpdate] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const scale = scalesRef.current[preset.slug] ?? 1.0;
  const wMult = getWidthMultiplier(repeatType);

  // Current repeat counts at this scale
  const tilePixelW = tileWidth * scale * SOCIAL_DPI * wMult;
  const tileAspect = (tileWidth * wMult) / tileHeight;
  const tilePixelH = tilePixelW / tileAspect;
  const repeatsX = Math.max(1, Math.round(preset.pxW / tilePixelW));
  const repeatsY = Math.max(1, Math.round(preset.pxH / tilePixelH));

  const canScaleUp = repeatsX > 1;
  const canScaleDown = socialScaleForRepeatsX(preset.pxW, tileWidth, wMult, repeatsX + 1) >= MIN_SCALE;

  const handleScaleDown = () => {
    const newScale = socialScaleForRepeatsX(preset.pxW, tileWidth, wMult, repeatsX + 1);
    if (newScale >= MIN_SCALE) {
      scalesRef.current[preset.slug] = newScale;
      forceUpdate(n => n + 1);
    }
  };

  const handleScaleUp = () => {
    if (repeatsX <= 1) return;
    const newScale = socialScaleForRepeatsX(preset.pxW, tileWidth, wMult, repeatsX - 1);
    if (newScale <= MAX_SCALE) {
      scalesRef.current[preset.slug] = Math.min(newScale, MAX_SCALE);
      forceUpdate(n => n + 1);
    }
  };

  // Draw preview canvas
  const { w: previewW, h: previewH } = socialPreviewDims(preset.pxW, preset.pxH);

  useEffect(() => {
    if (!isChecked || !canvasRef.current || !image) return;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = previewW * dpr;
    canvas.height = previewH * dpr;
    canvas.style.width = `${previewW}px`;
    canvas.style.height = `${previewH}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, previewW, previewH);

    const mapped = mapRepeatType(repeatType);
    const tileSource: HTMLCanvasElement | HTMLImageElement =
      mapped === 'fulldrop' ? image : convertToFullDrop(image, mapped);

    const tilePW = previewW / repeatsX;
    const tilePH = previewH / repeatsY;
    for (let x = 0; x < repeatsX; x++) {
      for (let y = 0; y < repeatsY; y++) {
        ctx.drawImage(
          tileSource,
          Math.floor(x * tilePW), Math.floor(y * tilePH),
          Math.ceil(tilePW) + 1, Math.ceil(tilePH) + 1
        );
      }
    }
  }, [isChecked, image, repeatType, repeatsX, repeatsY, previewW, previewH]);

  const baseName = sanitizeFilename(originalFilename || 'pattern', 'pattern');
  const fileName = `${baseName}-${preset.slug}.${socialFormat}`;
  const scaledTileW = tileWidth * scale;
  const scaledTileH = tileHeight * scale;

  return (
    <div className={`border rounded-lg overflow-hidden transition-colors ${
      isChecked ? 'border-[#e0c26e]' : 'border-[#e5e7eb]'
    }`}>
      {/* Checkbox row */}
      <label className={`flex items-center justify-between px-3 py-2 cursor-pointer ${
        isChecked ? 'bg-[#faf3e0]' : 'bg-white hover:bg-[#fafafa]'
      }`}>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={onToggle}
            style={{ accentColor: '#e0c26e', width: 13, height: 13 }}
            disabled={isExporting}
          />
          <span className={`text-xs ${isChecked ? 'font-semibold text-[#294051]' : 'text-[#374151]'}`}>
            {preset.label}
          </span>
        </div>
        <span className="text-[10px] text-[#9ca3af]">{preset.pxW}×{preset.pxH}</span>
      </label>

      {/* Expanded section — only when checked */}
      {isChecked && (
        <div className="px-3 py-3 bg-white border-t border-[#f0e9d4] flex items-center gap-3">
          {/* Preview canvas + scale buttons */}
          <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
            <canvas
              ref={canvasRef}
              className="border border-[#e5e7eb] rounded bg-white"
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleScaleDown}
                disabled={isExporting || !canScaleDown}
                className="w-6 h-6 flex items-center justify-center rounded border border-[#e5e7eb] bg-white text-[#374151] text-sm font-bold hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Smaller tiles, more repeats"
              >−</button>
              <span className="text-[9px] text-[#9ca3af] min-w-[56px] text-center">
                {scaledTileW.toFixed(2)}" × {scaledTileH.toFixed(2)}"
              </span>
              <button
                onClick={handleScaleUp}
                disabled={isExporting || !canScaleUp}
                className="w-6 h-6 flex items-center justify-center rounded border border-[#e5e7eb] bg-white text-[#374151] text-sm font-bold hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Larger tiles, fewer repeats"
              >+</button>
            </div>
          </div>
          {/* Info */}
          <div className="text-[11px] text-[#555] space-y-0.5 min-w-0">
            <div><span className="font-semibold text-[#294051]">{repeatsX} × {repeatsY}</span> repeats</div>
            <div className="text-[#9ca3af]">{preset.pxW} × {preset.pxH} px</div>
            <div className="text-[#9ca3af] truncate" title={fileName}>{fileName}</div>
          </div>
        </div>
      )}
    </div>
  );
}
```

Note: `sanitizeFilename`, `mapRepeatType`, `convertToFullDrop`, `getWidthMultiplier` are already defined/imported in the file.

- [ ] **Step 3: Add missing import for `sanitizeFilename` if not already present**

Check the imports at the top of `RepeatExportModal.tsx`. If `sanitizeFilename` isn't imported, add:

```typescript
import { sanitizeFilename } from '@/lib/utils/sanitizeFilename';
```

- [ ] **Step 4: Use the existing file-scoped `mapRepeatType`**

`mapRepeatType` is already defined locally in `RepeatExportModal.tsx` (around line 36). Since `SocialSizeRow` is defined in the same file, it can call `mapRepeatType` directly — no import or export needed. Do **not** add a second copy or export from `repeatFillExport.ts`.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Manual test — start dev server and verify per-size previews**

Start dev server. Upload a pattern. Click Pattern Fill Export → Social Media. Check one size — verify it expands with a correctly-shaped preview canvas and working +/− buttons. Check a second size — verify it gets its own independent preview. Uncheck one — verify it collapses.

- [ ] **Step 7: Commit**

```bash
git add src/lib/utils/repeatFillExport.ts src/components/export/RepeatExportModal.tsx
git commit -m "feat: add SocialSizeRow with per-size live preview and scale controls"
```

---

## Task 6: Add social export handler and wire up the export button

**Files:**
- Modify: `src/components/export/RepeatExportModal.tsx`

- [ ] **Step 1: Add `handleSocialExport` inside the component**

```typescript
const handleSocialExport = async () => {
  if (!image || checkedSizes.size === 0) return;
  setIsExporting(true);
  setError(null);

  try {
    // Single pro gate before any rendering
    const res = await fetch('/api/pro/verify', { method: 'POST' });
    if (!res.ok) throw new Error('Pro subscription required.');

    const slugsToExport = SOCIAL_SIZE_PRESETS.filter(p => checkedSizes.has(p.slug));
    const results: { slug: SizeSlug; label: string; blob: Blob | null }[] = [];

    for (const preset of slugsToExport) {
      const scale = scalesRef.current[preset.slug] ?? 1.0;
      try {
        const blob = await generateSocialFillBlob({
          image,
          repeatType,
          targetPxW: preset.pxW,
          targetPxH: preset.pxH,
          format: socialFormat,
          tileWidthInches: tileWidth,
          tileHeightInches: tileHeight,
          exportScale: scale,
        });
        results.push({ slug: preset.slug, label: preset.label, blob });
      } catch {
        results.push({ slug: preset.slug, label: preset.label, blob: null });
      }
    }

    const successful = results.filter(r => r.blob !== null);
    const failed = results.filter(r => r.blob === null);
    const baseName = sanitizeFilename(originalFilename || 'pattern', 'pattern');
    const ext = socialFormat === 'jpg' ? 'jpg' : 'png';

    if (successful.length === 0) {
      throw new Error('All exports failed. Try a smaller scale or different format.');
    }

    if (successful.length === 1) {
      // Single file — direct download
      const { slug, blob } = successful[0];
      const url = URL.createObjectURL(blob!);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}-${slug}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // Multiple files — zip
      const zip = new JSZip();
      for (const { slug, blob } of successful) {
        zip.file(`${baseName}-${slug}.${ext}`, blob!);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${baseName}-social-media.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    // Warn about partial failures
    if (failed.length > 0) {
      setError(`Could not export: ${failed.map(f => f.label).join(', ')}. Others downloaded successfully.`);
      setIsExporting(false);
    } else {
      setTimeout(() => {
        onClose();
        setIsExporting(false);
      }, 500);
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    setIsExporting(false);
  }
};
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Manual test — full export flow**

Start dev server. Upload a pattern tile.

**Test A — single download:**
- Open Pattern Fill Export → Social Media
- Check only "Instagram / Facebook Post"
- Click Export 1 Image
- Verify a `.jpg` file named `{pattern}-instagram-post.jpg` downloads
- Open it — verify it's 1080×1080 and the pattern tiles correctly

**Test B — multi-file zip:**
- Check "Instagram / Facebook Post" and "Story / Reel / TikTok"
- Click Export 2 Images
- Verify a `.zip` named `{pattern}-social-media.zip` downloads
- Unzip — verify two files at correct pixel dimensions

**Test C — Select All then zip:**
- Check Select All
- Verify all 5 sizes expand with previews
- Export — verify zip contains 5 files at correct dimensions

**Test D — scale adjustment:**
- Check one size, hit + and − buttons
- Verify preview updates
- Export — verify the tile scale in the downloaded file matches what the preview showed

**Test E — Cricut path still works:**
- Open Pattern Fill Export → Cricut / Silhouette
- Verify existing behavior is completely unchanged

- [ ] **Step 4: Commit**

```bash
git add src/components/export/RepeatExportModal.tsx
git commit -m "feat: add social media export handler — pro gate, per-size blobs, zip assembly"
```

---

## Task 7: Push branch and test on live dev server

- [ ] **Step 1: Final TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Push branch**

```bash
git push -u origin pattern-fill-export
```

- [ ] **Step 3: Start dev server for user testing**

```bash
npm run dev
```

Hand off to user for testing at `http://localhost:3000`.
