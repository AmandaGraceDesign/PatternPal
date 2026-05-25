---
name: patternpal-pro-genius-update
description: "Addendum to the PatternPAL Pro Genius skill covering features shipped March 2026: Social Media Export wizard, Text Watermark, Mockup Overlay, and Seam Inspector/Analyzer overhaul. Merge these sections into the main PatternPAL Pro Genius skill file, replacing outdated descriptions where noted."
---

# PatternPAL Pro Genius -- Feature Update (March 2026)

Merge the sections below into the main PatternPAL Pro Genius skill. Sections marked **REPLACE** should overwrite the existing section. Sections marked **ADD** are net-new content.

---

## ADD: Pro Feature -- Social Media Export

Add this as a new numbered Pro feature (after Pattern Fill Export):

### Social Media Export

Purpose-built export for Instagram, Pinterest, TikTok, and Facebook. No more screenshotting your preview or manually cropping in Canva.

**How it works:**
- **2-step wizard:** Step 1 = pick sizes + settings. Step 2 = per-size preview slides with live canvas
- **5 platform-optimized sizes:**
  - Instagram / Facebook Post (1080x1080)
  - Instagram / Facebook Portrait (1080x1350)
  - Story / Reel / TikTok (1080x1920)
  - Pinterest Pin (1000x1500)
  - Facebook Cover (1640x624)
- **Select any combination** -- export one size or all five at once
- **Per-size scale controls:** +/- buttons step through whole-number repeat counts so tiles are never stretched or partially cropped. Each size can have a different scale
- **Aspect-correct tiling:** Tile height is derived from tile width using the native aspect ratio. Extra rows fill the canvas height. No squishing, no stretching, regardless of canvas shape
- **Format choice:** JPG (smaller files, recommended) or PNG (lossless)
- **Multi-file export:** Selecting 2+ sizes downloads a ZIP file. Single size downloads directly
- **Pro-gated:** Single verification check before any rendering begins

**Why this matters:** Social media is how surface designers get discovered. Every platform has different image dimensions. Manually creating correctly-sized pattern preview images for each platform used to mean opening Photoshop, setting up canvases, tiling by hand, and exporting one at a time. PatternPAL does all five in seconds.

---

## ADD: Pro Feature -- Text Watermark (Social Media Export)

Add this under Social Media Export as a sub-feature:

### Text Watermark

Protect your work when sharing on social media. Available on Step 1 of the Social Media Export wizard.

- **Enable/disable checkbox** -- off by default, collapses the section when unchecked
- **Text input** -- your name or brand, up to 60 characters
- **3 Google Fonts:**
  - Montserrat (clean sans-serif)
  - Playfair Display (elegant serif)
  - Homemade Apple (handwritten/script)
- **Color picker** with hex display
- **Opacity slider** -- 10% to 100%
- **Font size slider** -- 16px to 72px (relative to 1080px canvas width, scales proportionally on all sizes)
- **Optional background box** -- checkbox with its own color picker, draws a padded rectangle behind the text for readability on busy patterns
- **Live preview strip** -- shows your watermark text on a checkerboard background in real time as you adjust settings
- **Position:** bottom center, 32px margin from edge (scaled proportionally to canvas size)
- **Font loading:** Google Fonts are lazy-loaded on first enable; fonts are awaited before export drawing to prevent fallback rendering
- **Applied at full resolution** on each exported image via a separate compositing step

**Why this matters:** Designers share pattern previews on Instagram to attract licensing clients and drive sales. Without a watermark, those images get screenshot-stolen constantly. Adding a watermark in Photoshop or Canva is one more manual step that eats creative time. PatternPAL bakes it in automatically.

---

## ADD: Pro Feature -- Mockup Overlay (Social Media Export)

Add this under Social Media Export as a sub-feature:

### Mockup Overlay

Overlay a product mockup on your social media export images to create professional presentation-ready content.

- **Per-slide controls** -- each preview slide (Step 2) has its own "Add Mockup" checkbox and thumbnail picker
- **6 mockups available:** Baby Onesie, Fabric Swatch, Wallpaper, Throw Pillow, Wrapping Paper, Journal
- **Selection is per-size** -- choose different mockups for different platform sizes, or none at all
- **White photo border** with subtle drop shadow around the mockup image
- **Mockup renders at ~55% of the shorter canvas dimension**, centered
- **Full compositing pipeline:** The mockup is rendered with your actual pattern applied using the same canvas compositing engine as the main mockup viewer (masks, multiply blend, onesie/wrapping paper special cases with color overlays, shadows, and highlights)
- **Layering order:** Pattern fill background -> Mockup overlay (centered) -> Watermark (bottom center)
- **Mobile-friendly:** 44px touch targets (Apple minimum), flex-wrap thumbnail layout, responsive container

**Export pipeline order:**
```
Pattern tiling -> Mockup overlay -> Watermark -> Download
```

**Why this matters:** A flat pattern tile on a social media post gets scrolled past. A pattern shown ON a throw pillow or wrapping paper tells a story and helps buyers visualize the product. Designers currently create these mockup images manually in Photoshop or Canva -- PatternPAL generates them automatically as part of the export.

---

## REPLACE: Seam Inspector description

Replace the existing Seam Inspector section with:

### Seam Inspector

The Seam Inspector is a dedicated full-screen analysis view for verifying seamless tile alignment. It has been completely rebuilt.

- **Full-screen modal** with its own canvas, zoom, and pan controls
- **All three repeat types** visible: Full Drop, Half Drop, Half Brick
- **Smooth zoom** with pinch-to-zoom support on touch devices
- **Pan/scroll** to inspect any part of the tiled pattern
- **Tile outline toggle** -- dashed outline shows exact tile boundaries with customizable outline color
- **Ruler system** with unit toggle (inches / cm) for measuring physical tile dimensions
- **High-DPI rendering** -- renders at device pixel ratio for crisp display on Retina/HiDPI screens
- **Offscreen double-buffering** -- renders to an offscreen canvas first, then blits to the visible canvas in one operation to prevent flicker
- **Seam-free tile rendering** -- +1px overlap at every tile boundary eliminates sub-pixel anti-aliasing gaps
- **Touch-friendly** -- works on iPad and tablet with gesture controls

**Why this matters:** A broken seam is the #1 most expensive mistake a surface designer can make. It might be invisible at screen zoom but catastrophic at print scale. The Seam Inspector gives you 400%+ zoom right at the seam intersections so you can verify every edge before committing to print.

---

## REPLACE: Product Mockups description

Replace the existing Product Mockups section with:

### Product Mockups

**Currently live (6 mockups):**
1. **Baby Onesie** (with customizable trim/bow color overlay using color mask compositing)
2. **Fabric Swatch** (realistic fabric texture via multiply blend)
3. **Wallpaper** (room scene with masked pattern area and locked tile aspect ratio)
4. **Throw Pillow** (masked pattern area with multiply blend)
5. **Wrapping Paper** (full compositing with pattern mask, bow color overlay, shadow layer, and highlight layer for realistic 3D effect)
6. **Journal/Notebook** (masked pattern area with multiply blend)

- Each mockup renders your actual pattern using **canvas-based compositing** with PNG base images, alpha masks, and blend modes -- not simple overlays
- **Physical dimension scaling** -- tiles are sized based on the mockup's real-world dimensions (e.g., 18x18" for throw pillow, 86x60" for wallpaper) so the pattern appears at realistic scale
- **Downloadable** for portfolios, pitch decks, social media, client presentations
- **Also available as overlays on Social Media Export** images (see Mockup Overlay feature above)
- No Photoshop required to create professional product mockups

---

## ADD to Pattern Fill Export section

Add these bullet points to the existing Pattern Fill Export feature description:

- **Two-destination export modal:** When opening Pattern Fill Export, users first choose their destination: Social Media (Instagram, Pinterest, TikTok, Facebook) or Cricut / Silhouette. Each path has its own optimized workflow
- **Social Media is listed first** and highlighted as the primary destination, reflecting that most users export for social sharing
- **Modal only closes via the X button** -- backdrop clicks do not dismiss, preventing accidental loss of export settings

---

## ADD to Common Mistakes to Avoid

Add these items:

- Do NOT describe Social Media Export as just "downloading images" -- it's a full wizard with per-size preview, scale controls, watermark, and mockup overlay. Each size gets its own customized preview
- Do NOT say mockup overlay is the same as the mockup viewer -- the overlay renders a mockup ON TOP of the pattern fill as a centered product photo with white border. The mockup viewer is a separate full-size preview of the pattern applied to a product
- Do NOT forget the watermark feature when discussing social media export -- it's a key selling point for designers worried about pattern theft on Instagram
- Do NOT list watermark fonts generically -- name them: Montserrat (sans-serif), Playfair Display (serif), Homemade Apple (handwritten)
- Do NOT forget that mockup overlay selection is PER-SIZE -- a user can have a throw pillow on their Instagram post but a journal on their Pinterest pin

---

## UPDATE: Key Differentiators

Add this new differentiator:

### 8. Social Media Export with Built-In Branding
One-click export to all major social platforms with optional watermark and mockup overlay. No Canva, no Photoshop, no manual resizing. Your pattern goes from tile to Instagram-ready presentation image with your branding in under 60 seconds.

---

## UPDATE: Pain Points

Add this pain point:

9. **Social media content creation:** "I spend 30 minutes per platform creating correctly-sized pattern preview images for Instagram, Pinterest, and TikTok" -- Social Media Export generates all five platform sizes with watermark and mockup overlay in seconds

---

## UPDATE: Proof Points

Update the product status line to:

- **Product status:** Live and actively used. Major features shipped in March 2026: Social Media Export with per-size preview wizard, text watermark system, mockup overlay on exports, rebuilt Seam Inspector with touch support
