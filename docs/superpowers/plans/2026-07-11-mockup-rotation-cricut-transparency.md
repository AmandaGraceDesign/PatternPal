# Mockup Pattern Rotation + Transparent Cricut PNG — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-area drag-to-rotate control for patterns on mockups (with a "rotate all" toggle), and a transparent-background option for the Cricut/Pattern-Fill PNG export.

**Architecture:** The mockup engine already rotates each zone independently (`processZone` has a rotate branch keyed on `zone.patternAngle`). We add a *runtime* angle override that mirrors the existing per-zone `patternOffsetOverrides` plumbing exactly — engine input field → `processZone` param → call sites → React state → gesture. The Cricut export flattens onto white via one unconditional `fillRect`; we gate that fill behind a PNG-only `transparentBackground` flag and show a checkerboard in the preview.

**Tech Stack:** Next.js (App Router, `--webpack`), React 18 client components, TypeScript, HTML Canvas 2D, Pointer Events, Vitest + jsdom.

## Global Constraints

- **iPad/Pencil parity is mandatory.** All new gestures use Pointer Events (not mouse/touch events) and set `touch-action: none` on the interactive element. (Half of users are on iPad with Pencil.)
- **Transparency is PNG-only.** JPG has no alpha; a transparent canvas exported to JPEG renders black. The transparent toggle is disabled unless `format === 'png'`.
- **Cricut export stays Pro-locked** — no change to existing gating (`/api/pro/verify`).
- **Rotation is preview/export-only.** It never mutates the saved pattern, and does not touch EasyScale or social exports.
- **`sharedPatternArea` templates are excluded from rotation in v1.** Those templates bypass the per-zone rotate branch; they must show no rotate handle and receive no angle override.
- **Testing reality:** this repo has Vitest + jsdom but NO testing-library and does NOT pixel-test the canvas pipeline (see `src/__tests__/MockupPipeline.test.ts` — it uses source-level assertions). Follow that convention: unit-test pure helpers, source-assert the engine threading, and manually UAT the canvas/gesture behavior.
- Test command: `npx vitest run <file>`. Full suite: `npm test`. Lint: `npm run lint`. Build: `npm run build`.

---

## Feature B — Transparent Cricut PNG (build first: smaller, independent, lower risk)

### Task 1: Gate the Cricut export's white fill behind a PNG-only flag

**Files:**
- Modify: `src/lib/utils/repeatFillExport.ts` (interface ~8-18; export fill 191-193)
- Test: `src/__tests__/repeatFillExport.transparency.test.ts` (create)

**Interfaces:**
- Produces: `shouldPaintBackground(format: 'png' | 'jpg', transparentBackground?: boolean): boolean` — exported pure helper. Returns `false` only when `transparentBackground === true && format === 'png'`.
- Produces: `RepeatFillExportConfig.transparentBackground?: boolean` — new optional config field (default falsy = current behavior).

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/repeatFillExport.transparency.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { shouldPaintBackground } from '../lib/utils/repeatFillExport';

describe('shouldPaintBackground', () => {
  it('paints white by default (no flag)', () => {
    expect(shouldPaintBackground('png', undefined)).toBe(true);
    expect(shouldPaintBackground('jpg', undefined)).toBe(true);
  });
  it('skips the fill only for transparent PNG', () => {
    expect(shouldPaintBackground('png', true)).toBe(false);
  });
  it('always paints white for JPG even if transparent requested (JPEG has no alpha)', () => {
    expect(shouldPaintBackground('jpg', true)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/repeatFillExport.transparency.test.ts`
Expected: FAIL — `shouldPaintBackground is not a function` (not exported yet).

- [ ] **Step 3: Add the helper and the config field**

In `src/lib/utils/repeatFillExport.ts`, add the field to the interface (after `originalFilename` at line 17):

```ts
  originalFilename: string | null;
  /** When true AND format === 'png', skip the white background fill so the
   *  exported PNG preserves the pattern's own transparency. Ignored for JPG
   *  (JPEG has no alpha channel). Default: paint white (legacy behavior). */
  transparentBackground?: boolean;
```

Add the exported helper just above `generateRepeatFillExport` (before line 154):

```ts
/**
 * Whether to paint the opaque white background before tiling.
 * Only a transparent-requested PNG skips it — JPG must always flatten to
 * white because JPEG cannot store alpha.
 */
export function shouldPaintBackground(
  format: 'png' | 'jpg',
  transparentBackground?: boolean
): boolean {
  return !(transparentBackground === true && format === 'png');
}
```

- [ ] **Step 4: Gate the fill in the export**

In `generateRepeatFillExport`, replace the unconditional fill (lines 191-193):

```ts
  // Fill with white background — unless a transparent PNG was requested.
  if (shouldPaintBackground(format, config.transparentBackground)) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/repeatFillExport.transparency.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/repeatFillExport.ts src/__tests__/repeatFillExport.transparency.test.ts
git commit -m "feat(cricut): gate export white fill behind PNG-only transparent flag"
```

---

### Task 2: Cricut modal — transparent toggle + checkerboard preview

**Files:**
- Modify: `src/components/export/RepeatExportModal.tsx` (state ~546; preview `drawPreview` 668-706; format block 1140-1177; export call ~740; preview canvas markup 1187-1191)

**Interfaces:**
- Consumes: `shouldPaintBackground` (Task 1), `RepeatFillExportConfig.transparentBackground` (Task 1).

- [ ] **Step 1: Add state**

After `const [format, setFormat] = useState<'png' | 'jpg'>('png');` (line 546):

```ts
  const [transparentBackground, setTransparentBackground] = useState(false);
```

- [ ] **Step 2: Gate the preview fill and add a checkerboard**

In `drawPreview` (the `useCallback`), replace the fill at lines 689-690:

```ts
    ctx.clearRect(0, 0, pW, pH);
    if (shouldPaintBackground(format, transparentBackground)) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pW, pH);
    }
```

Add `shouldPaintBackground` to the import at the top of the file (it already imports from `repeatFillExport` for the export call — extend that import to include `shouldPaintBackground`).

Add `format` and `transparentBackground` to the `drawPreview` dependency array (currently `[image, calc, repeatType]` at line 706):

```ts
  }, [image, calc, repeatType, format, transparentBackground]);
```

Wrap the preview `<canvas>` (lines 1187-1191) so a CSS checkerboard shows through the now-transparent canvas when transparent is on:

```tsx
                      <div
                        className="flex-shrink-0"
                        style={
                          transparentBackground && format === 'png'
                            ? {
                                backgroundImage:
                                  'linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)',
                                backgroundSize: '16px 16px',
                                backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
                              }
                            : undefined
                        }
                      >
                        <canvas
                          ref={previewCanvasRef}
                          style={{ width: PREVIEW_WIDTH, imageRendering: 'auto' }}
                        />
                      </div>
```

(Replace the existing `<div className="flex-shrink-0">` wrapper around the canvas at line 1187 with the block above.)

- [ ] **Step 3: Add the toggle UI, PNG-gated**

Immediately after the Format block's closing (after line 1177), add:

```tsx
                {/* Transparent background (PNG only) */}
                <div>
                  <label
                    className={`flex items-center ${format === 'png' ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={transparentBackground && format === 'png'}
                      onChange={() => setTransparentBackground((v) => !v)}
                      disabled={isExporting || format !== 'png'}
                      className="mr-2 w-3 h-3 border-[#e5e7eb] rounded focus:ring-1"
                      style={{ accentColor: '#e0c26e' }}
                    />
                    <span className="text-sm text-[#374151]">
                      Transparent background
                      <span className="text-[10px] text-[#9ca3af] font-normal ml-1">
                        PNG only
                      </span>
                    </span>
                  </label>
                </div>
```

- [ ] **Step 4: Thread the flag into the export call**

In the export handler (`handleExport`, where `generateRepeatFillExport({...})` is called ~line 740), add to the config object:

```ts
        format,
        transparentBackground: transparentBackground && format === 'png',
```

(Add the `transparentBackground` line alongside the existing `format` field.)

- [ ] **Step 5: Verify build + lint**

Run: `npm run lint && npx vitest run src/__tests__/repeatFillExport.transparency.test.ts`
Expected: lint clean, tests PASS.

- [ ] **Step 6: Manual UAT**

Run: `npm run dev`, open a pattern that has real transparency (e.g. a PNG with alpha), open Advanced Tools → Cricut/Silhouette export.
Verify:
1. Toggle is disabled/greyed when JPG is selected; enabled on PNG.
2. With PNG + toggle ON, the preview shows a checkerboard behind the pattern.
3. Export the file, open it in an image editor → background is genuinely transparent.
4. Toggle OFF → export has white background (no regression).
5. Open the exported PNG's DPI (in an editor that shows it) → still 150/300 as selected (confirms `injectPngDpi` preserved alpha + metadata).

- [ ] **Step 7: Commit**

```bash
git add src/components/export/RepeatExportModal.tsx
git commit -m "feat(cricut): transparent-background toggle with checkerboard preview"
```

---

## Feature A — Pattern rotation on mockups

### Task 3: Engine — runtime per-zone angle override

**Files:**
- Modify: `src/lib/mockups/mockupEngineV2/MockupPipeline.ts` (input type ~196; `processZone` signature 231-234 + angle math 276; call sites 480-481 and 509-510)
- Test: `src/__tests__/MockupPipeline.rotation.test.ts` (create — source-level assertion, matching the existing `MockupPipeline.test.ts` convention)

**Interfaces:**
- Consumes: existing `ROOT_ZONE_KEY` export.
- Produces: `PipelineInput.patternAngleOverrides?: Record<string, number>` — per-zone angle in **degrees**, added to the zone's static `patternAngle`. Keyed by `zone.id`, or `ROOT_ZONE_KEY` for single-zone templates.
- Produces: `processZone(..., overrideOffsetX, overrideOffsetY, overrideAngle = 0)` — new trailing param.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/MockupPipeline.rotation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('MOCK-ROT: pipeline per-zone angle override threading', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../lib/mockups/mockupEngineV2/MockupPipeline.ts'),
    'utf-8'
  );

  it('declares patternAngleOverrides on the pipeline input', () => {
    expect(src).toMatch(/patternAngleOverrides\??:\s*Record<string,\s*number>/);
  });

  it('adds the override to the zone patternAngle in processZone', () => {
    expect(src).toMatch(/\(zone\.patternAngle\s*\?\?\s*0\)\s*\+\s*overrideAngle/);
  });

  it('threads the override at BOTH the multi-zone and single-zone call sites', () => {
    const multi = src.match(/patternAngleOverrides\?\.\[zone\.id\]/g) ?? [];
    const root = src.match(/patternAngleOverrides\?\.\[ROOT_ZONE_KEY\]/g) ?? [];
    expect(multi.length).toBeGreaterThanOrEqual(1);
    expect(root.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/MockupPipeline.rotation.test.ts`
Expected: FAIL on all three (fields/threading not present yet).

- [ ] **Step 3: Add the input field**

In `MockupPipeline.ts`, after the `patternOffsetOverrides` field (line 196):

```ts
  patternOffsetOverrides?: Record<string, { x: number; y: number }>;
  /** Per-zone runtime rotation (degrees) added to each zone's static
   *  `patternAngle`. Used by the modal's drag-to-rotate feature. Keyed by
   *  `zone.id`; single-zone templates use `ROOT_ZONE_KEY`. */
  patternAngleOverrides?: Record<string, number>;
```

- [ ] **Step 4: Add the processZone param and fold it into the angle**

Change the `processZone` signature — add after `overrideOffsetY = 0,` (line 233):

```ts
  overrideOffsetX = 0,
  overrideOffsetY = 0,
  /** Runtime rotation (deg) added to zone.patternAngle. */
  overrideAngle = 0,
): HTMLCanvasElement {
```

Change the angle line (276) from `const angleDeg = zone.patternAngle ?? 0;` to:

```ts
    const angleDeg = (zone.patternAngle ?? 0) + overrideAngle;
```

- [ ] **Step 5: Thread at both call sites**

Multi-zone call (after line 481, `input.patternOffsetOverrides?.[zone.id]?.y,`):

```ts
        input.patternOffsetOverrides?.[zone.id]?.x,
        input.patternOffsetOverrides?.[zone.id]?.y,
        input.patternAngleOverrides?.[zone.id],
      );
```

Single-zone call (after line 510, `input.patternOffsetOverrides?.[ROOT_ZONE_KEY]?.y,`):

```ts
      input.patternOffsetOverrides?.[ROOT_ZONE_KEY]?.x,
      input.patternOffsetOverrides?.[ROOT_ZONE_KEY]?.y,
      input.patternAngleOverrides?.[ROOT_ZONE_KEY],
    );
```

(Passing `undefined` when no override exists is fine — the `overrideAngle = 0` default applies.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/__tests__/MockupPipeline.rotation.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/mockups/mockupEngineV2/MockupPipeline.ts src/__tests__/MockupPipeline.rotation.test.ts
git commit -m "feat(mockups): runtime per-zone pattern angle override in pipeline"
```

---

### Task 4: Renderer — rotation state, selection, and angle override threading

**Files:**
- Modify: `src/components/mockups/MockupRendererV2.tsx` (props 9-61 + destructure 163-186; state ~198; reset effect 231-241; runPipeline call ~346-352; deps sig 224 + 400-405)

**Interfaces:**
- Consumes: `PipelineInput.patternAngleOverrides` (Task 3).
- Produces (props): `rotateAll?: boolean` (default false), `onSelectZone?: (zoneKey: string | null) => void` (optional; parent may show which area is selected). These are additive/optional so existing callers (gallery) are unaffected.
- Produces (internal state consumed by Task 5): `patternAngles: Record<string, number>` (degrees), `selectedZoneKey: string | null`, setters, and a `rotateAll` prop.

- [ ] **Step 1: Add the two new optional props**

In the `MockupRendererV2Props` interface (after `fitContainer?` at line 60):

```ts
  fitContainer?: boolean;
  /** When true, a rotate-handle drag rotates EVERY eligible zone by the same
   *  delta instead of only the selected zone. Default false. */
  rotateAll?: boolean;
```

Add to the destructured params (after `fitContainer = false,` at line 184):

```ts
  fitContainer = false,
  rotateAll = false,
  onRenderComplete,
```

- [ ] **Step 2: Add rotation state next to the offset state**

After `const [patternOffsets, setPatternOffsets] = useState<...>({});` (line 198):

```ts
  const [patternAngles, setPatternAngles] = useState<Record<string, number>>({});
  const [selectedZoneKey, setSelectedZoneKey] = useState<string | null>(null);
```

- [ ] **Step 3: Add a memoized signature for the angles**

After `const patternOffsetsSig = useMemo(...)` (line 224):

```ts
  const patternAnglesSig = useMemo(() => JSON.stringify(patternAngles), [patternAngles]);
```

- [ ] **Step 4: Reset rotation state on template change**

In the template-change reset effect (line 231-241), add:

```ts
  useEffect(() => {
    setPatternOffsets({});
    setPatternAngles({});
    setSelectedZoneKey(null);
    setIsDragging(false);
    ...
```

- [ ] **Step 5: Thread the angle override into runPipeline**

In the `runPipeline({...})` call, right after the `patternOffsetOverrides` block (ends line 352), add. Angle is scale-invariant (unlike offset), so pass it straight through — no `scaleFactor` multiply:

```ts
          patternAngleOverrides: Object.keys(patternAngles).length > 0
            ? patternAngles
            : undefined,
```

- [ ] **Step 6: Add the angle signature to the render-effect deps**

In the deps array (after `patternOffsetsSig,` at line 400):

```ts
    patternOffsetsSig,
    patternAnglesSig,
```

- [ ] **Step 7: Verify it compiles**

Run: `npm run lint`
Expected: no errors. (No behavior change yet — the handle/gesture comes in Task 5. `selectedZoneKey`/`patternAngles` are set but unused until then; if lint flags unused vars, that's expected and resolved by Task 5 which reads them. If the linter blocks the commit on unused vars, proceed directly to Task 5 before committing — they are one logical unit.)

- [ ] **Step 8: Commit**

```bash
git add src/components/mockups/MockupRendererV2.tsx
git commit -m "feat(mockups): rotation state + angle-override threading in renderer"
```

---

### Task 5: Renderer — drag-to-rotate handle gesture

**Files:**
- Modify: `src/components/mockups/MockupRendererV2.tsx` (pointer handlers 454-546; JSX return 548-588)

**Interfaces:**
- Consumes: `patternAngles`, `setPatternAngles`, `selectedZoneKey`, `setSelectedZoneKey`, `rotateAll` (Task 4); existing `pickZoneAt`, `wrapperRef`, `template`, `ROOT_ZONE_KEY`.

**Design notes (read before implementing):**
- The wrapper already handles body-drag = move. We ADD a separate absolutely-positioned handle element for the selected zone. The handle has its OWN pointer handlers and calls `stopPropagation()` so the wrapper's move-drag never fires during a rotate.
- Tap (pointerup with no drag) on the body selects the zone under the pointer (`pickZoneAt`), so the handle appears there. Single-zone templates auto-select `ROOT_ZONE_KEY`.
- The handle sits at the selected zone's CENTER (expressed as a % of the wrapper via the zone's `patternArea` over `template.canvasSize`), visually lifted by a fixed radius. Rotation angle is computed from the pointer's position relative to that center in client coordinates — independent of render scale.

- [ ] **Step 1: Add a zone-center helper and rotate refs**

Just above `handlePointerDown` (line 454), add:

```ts
  // rAF-coalesced rotation, mirroring the offset drag's coalescing.
  const rotateStartRef = useRef<{
    pointerId: number;
    zoneKeys: string[];
    centerClientX: number;
    centerClientY: number;
    startPointerDeg: number;
    startAngles: Record<string, number>;
  } | null>(null);
  const pendingRotateRef = useRef<Record<string, number> | null>(null);
  const rotateRafIdRef = useRef<number | null>(null);

  /** Center of a zone as a fraction (0..1) of the full template canvas. */
  const zoneCenterFraction = (zoneKey: string): { fx: number; fy: number } | null => {
    const cs = template.canvasSize;
    if (zoneKey === ROOT_ZONE_KEY || !template.zones || template.zones.length === 0) {
      const pa = template.patternArea;
      if (!pa) return { fx: 0.5, fy: 0.5 };
      return { fx: (pa.x + pa.width / 2) / cs.width, fy: (pa.y + pa.height / 2) / cs.height };
    }
    const zone = template.zones.find((z) => z.id === zoneKey);
    if (!zone) return null;
    const pa = zone.patternArea;
    return { fx: (pa.x + pa.width / 2) / cs.width, fy: (pa.y + pa.height / 2) / cs.height };
  };

  /** True when the current template supports per-zone rotation (see global
   *  constraint: sharedPatternArea templates bypass the rotate branch). */
  const rotationSupported = !template.sharedPatternArea;
```

- [ ] **Step 2: Auto-select the root zone for single-zone templates**

After the reset effect (around line 241), add an effect so single-zone templates always show the handle:

```ts
  useEffect(() => {
    if (!dragEnabled || !rotationSupported) { setSelectedZoneKey(null); return; }
    if (!template.zones || template.zones.length === 0) {
      setSelectedZoneKey(ROOT_ZONE_KEY);
    }
  }, [template, dragEnabled, rotationSupported]);
```

- [ ] **Step 3: Select the zone on a tap**

In `handlePointerUp` (line 520-534), after `flushPendingDrag();` and before the `onClick` line, set the selection when the gesture was a tap (not a drag):

```ts
    flushPendingDrag();

    // A tap (no drag) selects the zone under the pointer so its rotate handle appears.
    if (!wasDragRef.current) {
      if (rotationSupported) {
        const zoneKey = pickZoneAt(e.clientX, e.clientY);
        if (zoneKey) setSelectedZoneKey(zoneKey);
      }
      onClick?.();
    }
```

- [ ] **Step 4: Add the rotate-handle pointer handlers**

Add after `handlePointerCancel` (line 546):

```ts
  const RAD2DEG = 180 / Math.PI;

  const handleRotateDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!selectedZoneKey) return;
    e.stopPropagation();
    const wrap = wrapperRef.current;
    const frac = zoneCenterFraction(selectedZoneKey);
    if (!wrap || !frac) return;
    const rect = wrap.getBoundingClientRect();
    const centerClientX = rect.left + frac.fx * rect.width;
    const centerClientY = rect.top + frac.fy * rect.height;
    const startPointerDeg = Math.atan2(e.clientY - centerClientY, e.clientX - centerClientX) * RAD2DEG;

    // rotateAll → every eligible zone rotates together; else just the selected one.
    const zoneKeys = rotateAll
      ? (template.zones && template.zones.length > 0
          ? template.zones.map((z) => z.id)
          : [ROOT_ZONE_KEY])
      : [selectedZoneKey];
    const startAngles: Record<string, number> = {};
    for (const k of zoneKeys) startAngles[k] = patternAngles[k] ?? 0;

    rotateStartRef.current = { pointerId: e.pointerId, zoneKeys, centerClientX, centerClientY, startPointerDeg, startAngles };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };

  const handleRotateMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = rotateStartRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const nowDeg = Math.atan2(e.clientY - s.centerClientY, e.clientX - s.centerClientX) * RAD2DEG;
    const delta = nowDeg - s.startPointerDeg;
    const next: Record<string, number> = {};
    for (const k of s.zoneKeys) {
      // Normalize to [0,360) for a tidy stored value.
      next[k] = ((s.startAngles[k] + delta) % 360 + 360) % 360;
    }
    pendingRotateRef.current = next;
    if (rotateRafIdRef.current === null) {
      rotateRafIdRef.current = requestAnimationFrame(() => {
        rotateRafIdRef.current = null;
        const pending = pendingRotateRef.current;
        if (!pending) return;
        setPatternAngles((prev) => ({ ...prev, ...pending }));
      });
    }
  };

  const endRotate = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = rotateStartRef.current;
    if (!s || s.pointerId !== e.pointerId) return;
    e.stopPropagation();
    rotateStartRef.current = null;
    try { (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId); } catch {}
    if (rotateRafIdRef.current !== null) {
      cancelAnimationFrame(rotateRafIdRef.current);
      rotateRafIdRef.current = null;
    }
    const pending = pendingRotateRef.current;
    if (pending) { pendingRotateRef.current = null; setPatternAngles((prev) => ({ ...prev, ...pending })); }
  };
```

- [ ] **Step 5: Render the handle in the JSX**

Inside the wrapper `<div>`, after the `{isRendering && ...}` block and before the wrapper's closing `</div>` (line 587), add the handle. It only renders when dragging is enabled, rotation is supported, and a zone is selected:

```tsx
      {dragEnabled && rotationSupported && selectedZoneKey && (() => {
        const frac = zoneCenterFraction(selectedZoneKey);
        if (!frac) return null;
        return (
          <div
            aria-hidden
            className="absolute z-20"
            style={{
              left: `${frac.fx * 100}%`,
              top: `${frac.fy * 100}%`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          >
            {/* connector line from center up to the grab dot */}
            <div
              className="absolute left-1/2 -translate-x-1/2 bg-white/80"
              style={{ bottom: '0', width: '2px', height: '48px' }}
            />
            {/* the grab dot — this is the only pointer target */}
            <div
              role="button"
              aria-label="Rotate pattern"
              onPointerDown={handleRotateDown}
              onPointerMove={handleRotateMove}
              onPointerUp={endRotate}
              onPointerCancel={endRotate}
              className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white shadow-md border border-[#294051] flex items-center justify-center"
              style={{
                top: '-56px',
                width: '28px',
                height: '28px',
                pointerEvents: 'auto',
                touchAction: 'none',
                cursor: 'grab',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#294051" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
            </div>
          </div>
        );
      })()}
```

- [ ] **Step 6: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: clean. (`build` catches type errors across the module.)

- [ ] **Step 7: Manual UAT**

Run `npm run dev`, open a pattern, open a mockup that has MULTIPLE zones (e.g. a tie/knot or multi-panel product) in the tweak modal.
Verify:
1. Tapping an area shows the rotate handle floating above that area's center.
2. Dragging the handle rotates ONLY that area's pattern; other areas unchanged.
3. Tapping a different area moves the handle there; rotating it is independent.
4. Body-drag (not on the handle) still MOVES the pattern (no regression to drag-to-position).
5. Works with touch/Pencil on iPad (or touch emulation): handle grabs, rotates smoothly, no page scroll.
6. On a single-zone template, the handle appears automatically and rotates the whole pattern.
7. Open the download/full-res path → the exported mockup reflects the rotation (state flows through the same component at `isCapturingFullRes`).

- [ ] **Step 8: Commit**

```bash
git add src/components/mockups/MockupRendererV2.tsx
git commit -m "feat(mockups): drag-to-rotate handle for per-area pattern rotation"
```

---

### Task 6: Modal — "rotate all" toggle wired to the renderer

**Files:**
- Modify: `src/components/mockups/MockupModalBody.tsx` (renderer usage 196-219; controls bar ~237)

**Interfaces:**
- Consumes: `MockupRendererV2` `rotateAll` prop (Task 4).

- [ ] **Step 1: Add the toggle state**

Near the other mockup control state at the top of `MockupModalBody` (co-locate with `shadowEnableds` etc.), add:

```ts
  const [rotateAll, setRotateAll] = useState(false);
```

- [ ] **Step 2: Pass the prop to the renderer**

In the `<MockupRendererV2 ... />` usage (add near `dragEnabled` at line 214):

```tsx
                dragEnabled
                rotateAll={rotateAll}
```

- [ ] **Step 3: Add the toggle to the controls bar**

In the controls bar (`<div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 ...">` at line 237), add a control alongside the existing Scale control:

```tsx
        {/* Rotate all areas together */}
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={rotateAll}
            onChange={() => setRotateAll((v) => !v)}
            className="w-3 h-3 border-[#e5e7eb] rounded focus:ring-1"
            style={{ accentColor: '#e0c26e' }}
          />
          <span>Rotate all areas together</span>
        </label>
```

- [ ] **Step 4: Verify build + lint**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 5: Manual UAT**

Run `npm run dev`, open a multi-zone mockup:
1. With "Rotate all areas together" OFF, rotating one area's handle rotates only that area.
2. Turn it ON, rotate a handle → every area rotates by the same amount together.
3. Turn it OFF again → back to independent rotation.

- [ ] **Step 6: Commit**

```bash
git add src/components/mockups/MockupModalBody.tsx
git commit -m "feat(mockups): 'rotate all areas together' toggle"
```

---

### Task 7: Final verification pass (both features)

**Files:** none (verification only)

- [ ] **Step 1: Full test suite + lint + build**

Run: `npm test && npm run lint && npm run build`
Expected: all tests pass (including the two new test files), lint clean, build succeeds.

- [ ] **Step 2: Regression sweep — rotation excluded on sharedPatternArea templates**

Run `npm run dev`. Open a template known to use `sharedPatternArea` (grep `sharedPatternArea` in `src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts` to find one).
Verify:
1. NO rotate handle appears on that template (handle is gated on `!template.sharedPatternArea`).
2. Body drag-to-position still works there (no regression).

- [ ] **Step 3: Cross-feature smoke test**

1. EasyScale export still works (unaffected — different path). Export a PNG, confirm no behavior change.
2. Mockup social/download export still works with and without rotation applied.
3. Cricut export: transparent PNG (checkerboard preview → transparent file), opaque PNG, and JPG (toggle disabled) all export correctly.

- [ ] **Step 4: Update the feature-requests tracker**

Append all three requests to `docs/user-feature-requests.md` (per project convention): mockup pattern rotation (shipped this branch), transparent Cricut PNG (shipped this branch), and drag-and-drop logo placement (tracked follow-up, not in this branch). Then commit:

```bash
git add docs/user-feature-requests.md
git commit -m "docs: log rotation, transparent-Cricut, and logo-drag feature requests"
```

---

## Self-review notes

- **Spec coverage:** Feature A interaction model → Tasks 3-6; per-area + rotate-all → Tasks 5-6; drag handle + iPad → Task 5; `sharedPatternArea` exclusion → Tasks 5 (gating) + 7 (verify); export parity via same component → Task 5 step 7. Feature B: skip white fill → Task 1; PNG-only + JPG-disabled → Tasks 1-2; checkerboard preview → Task 2; DPI alpha check → Task 2 step 6; Pro-locked unchanged → untouched. Logo-drag follow-up → Task 7 step 4 (tracked only, out of scope). All spec sections mapped.
- **Type consistency:** `patternAngleOverrides` (Record<string, number>, degrees) is used identically in Task 3 (engine) and Task 4 (renderer). `overrideAngle` param name consistent in Task 3. `shouldPaintBackground(format, transparentBackground)` signature identical across Tasks 1-2. `rotateAll`/`selectedZoneKey`/`patternAngles` names consistent across Tasks 4-6.
- **No placeholders:** every code step shows the actual code. Canvas/gesture behavior that jsdom can't assert is covered by explicit manual UAT steps, matching this repo's existing testing convention (source-level assertions, no pixel tests, no component-testing library).
