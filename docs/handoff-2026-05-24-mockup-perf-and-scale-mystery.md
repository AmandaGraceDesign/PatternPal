---
task: Mockup perf fixes (thumbnails, LRU cache) + iPad workflow + UNRESOLVED scale-label bug
status: 2 commits shipped on `merge-test`; ONE bug still open
created: 2026-05-24
current_branch: merge-test
---

## What shipped today (2 commits)

### `ef251d1` fix(mockups-v2): re-categorize apron & tie, add missing nursery-wallpaper

- **apron**: apparel → accessories (Mandy's call: apron is a kitchen accessory)
- **mens-tie**: accessories → apparel (Mandy's call: tie is clothing)
- **nursery-wallpaper**: full registry entry added at [templateRegistry.ts:720-750](../src/lib/mockups/mockupEngineV2/templates/templateRegistry.ts#L720-L750). **The asset files were committed in `e625f30` last night but the commit silently dropped the registry entry** — the template never appeared in the gallery. Modeled on the Entry Wallpaper template: single 'wall' zone, 3000×4500 canvas, mask bbox (0,0–3000,3950), Accent Color overlay, full shadow+highlight assets.

### `b1d11b4` perf(mockups): jpeg thumbnails + bounded image cache + tunnel script

Two real perf bugs surfaced during iPad testing (both also help desktop):

**Bug A — Social-export "Add Mockup" thumbnails were 5+ MB each.** The 44×44 picker buttons at [RepeatExportModal.tsx:425](../src/components/export/RepeatExportModal.tsx#L425) used `<img src>` pointing at the full 3000×4500 product PNGs. Opening the picker fetched ~100 MB. Fix: pre-rendered JPEG thumbnails (200px max, q85) in [public/mockups/v2/thumbnails/](../public/mockups/v2/thumbnails/), named by template ID. **Total folder: 392 KB.** Generated with `sips` — see [/tmp/gen-thumbs.sh](file:///tmp/gen-thumbs.sh) (script is gone after reboot; copy below). If a template is added/renamed, regenerate by hand.

**Bug B — MockupRendererV2.imageCache had no eviction.** Module-level Map at [MockupRendererV2.tsx:63](../src/components/mockups/MockupRendererV2.tsx#L63). Opening the gallery decoded ~125 layers simultaneously (5 per template × 25 templates), many 50+ MB after RGBA decode. iPad Safari killed the tab when memory exceeded ~1.5 GB. Fix: bounded LRU at 40 entries (≈ 8 templates × 5 layers — fits one category fully cached). Access bumps recency via `delete + set`. Hot path (interactively tweaking one mockup) keeps full cache benefit.

**Also added:** `npm run tunnel` script → `ngrok http 3000`. For non-HTTPS iPad testing on the same WiFi, hit the laptop's LAN IP directly (e.g. `http://10.0.0.144:3000`); use ngrok only when you need HTTPS (e.g., to test the `navigator.share` iOS save-to-Photos pathway).

**Verified:** `npx tsc --noEmit` clean, `npx vitest run` 28/28 pass. iPad-verified via LAN: social modal thumbnails appear instantly, gallery modal no longer crashes.

## UNRESOLVED — Mockup modal subtitle shows different tile size than main canvas

**Symptom:** Mandy has tile = 13×22 (W×H) on the main canvas. Opens the desk-mat mockup modal. The subtitle reads **"based on 13.64\" scale"** (her words; not sure exactly which label — see below).

**She insists Easyscale is OFF** when this happens.

**What was investigated:**

- Subtitle code at [ActionsSidebar.tsx:361](../src/components/sidebar/ActionsSidebar.tsx#L361) is `Based on ${tileWidth.toFixed(1)} × ${tileHeight.toFixed(1)} inch repeat` — that's two numbers and ends in "repeat", not "scale". User reports seeing one number ending in "scale". So she's looking at a label I haven't found.
- AdvancedToolsBar has the same format at [AdvancedToolsBar.tsx:422](../src/components/layout/AdvancedToolsBar.tsx#L422).
- `13.64` is suspiciously specific. Math hypothesis: if Easyscale `scalePreviewSize = 13.64` (in inches as the new longest edge) and original longest = 22, factor = 0.62 → effective tile = `8.06 × 13.64`. Mandy might be reading the height of the effective tile and calling it "scale". **But she says Easyscale is off**, so this hypothesis is shaky.
- `MockupGalleryModal` does accept `scaleFactor` + `scalePreviewActive` as props (lines 21–22) but never forwards them. Currently irrelevant — `tileWidth` flowing in is already `effectiveTileWidth` from [PatternControlsTopBar.tsx:410](../src/components/layout/PatternControlsTopBar.tsx#L410). So the mockup IS getting whatever the canvas is using.
- No `setTileWidth` is called anywhere after the modal opens. No auto-snap-to-product or fit-to-canvas logic found.

**Next debugging steps for fresh session:**

1. **Pin down what label she's reading.** Ask for a screenshot, or have her describe the exact text and where it appears in the modal. The string `13.64` doesn't match any literal in the code; it has to be a `.toFixed()` call with two decimals — `grep -rn "toFixed(2)" src/components/mockups/ src/components/sidebar/ActionsSidebar.tsx`. Likely candidates: [RepeatExportModal.tsx:380](../src/components/export/RepeatExportModal.tsx#L380) (`scaledTileW.toFixed(2)`) — but that's the social-export modal, not mockup modal.
2. **Check whether `scalePreviewActive` is silently true.** Add a `console.log` at the top of MockupRendererV2 dumping `tileWidth, tileHeight, scaleFactor` — have her open the mockup modal and read out the values. If `tileWidth` going in is 13.64, the bug is upstream (PatternControlsTopBar is computing effective wrongly, or scalePreviewActive defaults to true somewhere). If it's 13 or 22, the bug is in the label code I haven't found.
3. **Try reproducing.** Set tile to 13×22 with Easyscale verified OFF, open desk-mat. If the subtitle shows `Based on 13.0 × 22.0 inch repeat`, ask Mandy to point at where she sees "13.64".

**Hypothesis to verify or rule out first:** Easyscale state persists across sessions/reloads. She may have toggled it on previously and forgotten — the toggle in [PatternControlsTopBar.tsx:278](../src/components/layout/PatternControlsTopBar.tsx#L278) (`data-tour="scale-preview"`) might be active without her realizing.

## Carried over from prior handoff (still relevant)

- **iPad: re-shoot `wrapping-paper-roll-highlight.png`** with tighter highlight regions — current PNG has 72% semi-transparent white pixels causing soft-light to wash to white at 100%.
- **iPad: tune `nursery-wallpaper` colorOverlayLabel** if "Accent Color" doesn't match what the color mask covers.
- **iPad: confirm `wrapping-paper-roll` zones (sheet/roll)** read correctly.
- **Backlog: commit the pre-existing untracked v2 assets** for desk-mat, gift-bag, mens-dress-shirt, mens-tie, phone-case, womens-blouse so registry entries work on fresh clones. (These are still untracked — check `git status`.)
- **Backlog: Entry Wallpaper colorOverlayLabel rename.**

## Reference: how to regenerate thumbnails

```bash
# Save as /tmp/gen-thumbs.sh and run from repo root:
declare -a pairs=(
  "onesie:onesie" "girl-dress-1:girl-dress-1" "swim-trunks-1:swim-trunks-1"
  "swimsuit-kids-2:swimsuit-kids-2" "apron:apron" "boys-pjs:boys-pjs"
  "girl-dress-2:girl-dress-2" "fabric-swatch:fabric-swatch" "throw-pillow:throw-pillow"
  "curtain:curtains" "tea-towel-1:tea-towel-1" "tea-towel-3:tea-towel3"
  "picnic-blanket:picnic-blanket" "duvet-1:duvet-1" "mug-1:mug-1" "mug-2:mug-2"
  "wrapping-paper:gift-box" "wrapping-paper-roll:wrapping-paper-roll"
  "gift-bag:gift-bag" "wallpaper:entry-wallpaper" "nursery-wallpaper:nursery-wallpaper"
  "journal:journal" "silk-scarf:silk-scarf" "mens-tie:mens-tie" "phone-case:phone-case"
  "desk-mat:desk-mat" "tote-bag:tote-bag" "mens-dress-shirt:mens-dress-shirt"
  "womens-blouse:womens-blouse"
)
mkdir -p public/mockups/v2/thumbnails
for p in "${pairs[@]}"; do
  id="${p%%:*}"; src="${p##*:}"
  [ -f "public/mockups/v2/${src}.png" ] && \
    sips -Z 200 -s format jpeg -s formatOptions 85 \
      "public/mockups/v2/${src}.png" --out "public/mockups/v2/thumbnails/${id}.jpg" >/dev/null
done
```

(Note: `tea-towel-3` source is `tea-towel3.png`; `wrapping-paper` uses `gift-box.png`; `wallpaper` uses `entry-wallpaper.png`; `curtain` uses `curtains.png`. Other IDs match filenames 1:1.)

## iPad testing setup (LAN)

Mandy's laptop IP from last session: `10.0.0.144`. May drift after router reboot — run `ipconfig getifaddr en0` to refresh.

1. `npm run dev` (already binds to 0.0.0.0)
2. iPad opens `http://10.0.0.144:3000` (same WiFi as laptop)
3. For HTTPS testing (iOS share-sheet): `npm run tunnel` and open the printed ngrok URL instead.
