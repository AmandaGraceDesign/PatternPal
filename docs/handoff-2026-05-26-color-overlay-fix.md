---
task: PatternPal launch day — color overlay fix + remaining launch verification
status: 6 commits on local main (94 ahead of origin/main), NOT pushed to prod.
date: 2026-05-26
branch: main (local)
---

## What shipped this session (1 commit on local main)

- `2ead556` fix(mockup-color-overlay): flat multiply matches PSD Color Fill

## The color overlay bug + fix

**Symptom.** Cuffs/trim on boys-pjs and apron came out muddy/dirty/blackened vs
the same hex applied in Photoshop. Reported on apron too.

**Wrong leads we tried first (and discarded):**
1. Shadow opacity — turning shadow OFF still showed the muddy result.
2. `color` blend mode — went fluorescent (full saturation on bright cuffs).
3. `color-burn` — made it worse.
4. `linear-burn` (custom ImageData pass) — crushed the cuffs to dark burgundy.

**Real cause.** The pipeline was building the accent layer as `accentColor ×
contrast-boosted luminance shading layer (multiply)` THEN multiplying that
onto the photo, THEN doing a soft-light "highlight recovery" pass at 0.3.
That triple-step pre-darkened the accent before it ever touched the photo,
making the final composite much darker than a vanilla PSD Color Fill +
Multiply layer (which just multiplies the flat hex once onto the photo).

**Fix.** New default behavior: **flat multiply** — fill the masked region
with the raw accent color, multiply onto the photo, done. No pre-multiplied
shading, no soft-light recovery. Matches PSD reference exactly per Mandy's
side-by-side test.

**Escape hatch.** `flatMultiply: false` on a template opts back into the
legacy shading+soft-light pipeline. Not currently used by any template.

**Files:**
- [src/lib/mockups/mockupEngineV2/MockupPipeline.ts](src/lib/mockups/mockupEngineV2/MockupPipeline.ts) — wrapped legacy steps in `!flatMultiply` branch, default flipped
- [src/lib/mockups/mockupEngineV2/templates/types.ts](src/lib/mockups/mockupEngineV2/templates/types.ts) — added optional `blendMode`, `opacity`, `flatMultiply` fields on `colorOverlay`
- `templateRegistry.ts` — unchanged in final state; we tried per-template overrides but ended up flipping the global default instead

**Verification status.** Mandy confirmed boys-pjs cuffs look PERFECT with new
default. Other mockups with colorOverlay (swimsuit-kids-2, girl-dress-2,
mens-tie, mens-dress-shirt, nursery-wallpaper, wrapping-paper-roll, others)
— **not yet spot-checked.** All now use the new flat-multiply default. If any
one regresses, add `flatMultiply: false` to its template entry.

## Carry-forward from prior session (yesterday's handoff)

Local `main` is **94 commits ahead of origin/main** — NOT pushed.

The full launch payload (88-commit merge of merge-test → main, plus iOS save
sheet fix, iPad drag fixes, gallery regression fix, "20+ mockups coming"
copy removal, AND this color overlay fix) is sitting on local main.

### What was attempted yesterday for preview verification (failed, parked)

`launch-preview` branch exists on origin/launch-preview (commit `2280c00`
empty trigger commit on top of yesterday's launch commits). Mandy tried to
preview on `pattern-pal-git-launch-preview-amanda-grace-design.vercel.app`
but Clerk wouldn't render auth UI because:

> **`pk_live_*` Clerk keys are domain-locked to production domain only.**
> They don't work on `*.vercel.app` preview URLs. ClerkProvider silently
> rejects → no SignIn button → looks like the env vars never made it.

Vercel Preview env vars ARE correctly set (Clerk, Stripe, OpenAI, etc.) via
`scripts/link-env-to-preview.sh` — that part worked. But the keys themselves
just can't function on preview domains.

**Resolution for now:** Mandy reverted to testing on `npm run dev` against
local main (the "what will be prod" version). iOS share sheet untestable
on `http://` LAN but everything else is.

### Cleanup not yet done

- `launch-preview` branch (local + remote) — still exists. Mandy approved
  deletion in principle but never confirmed; defer to her.
- `scripts/link-env-to-preview.sh` — keep, useful if she rotates a secret.
- `.env.prod-snapshot` — already deleted.

## To ship to production

```
git push origin main
```

That's the launch. After push, on real iPad against production domain,
verify the iOS share sheet works (this is the only thing untestable on dev).

## Open backlog (not launch-blocking)

- iPad Save-to-Photos for Easyscale + Pattern Fill exports (different code
  path from social/mockup) — tracked in tasks/todo.md
- Mockup-modal "13.64" scale label mystery — needs Mandy screenshot
- nursery-wallpaper / wrapping-paper-roll colorOverlayLabel tuning
- Rename "Entry Wallpaper" colorOverlayLabel
- **NEW: spot-check non-pjs/apron mockups** with colorOverlay against PSD
  references — flat multiply is now their default too, so they may have
  shifted slightly. None reported broken yet.

## Active local dev server

`next-server v16.1.6` running on port 3000 (PID 45573 as of last check).
Was up ~22h. HMR has been picking up edits, including today's color
overlay fix.
