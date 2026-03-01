# PatternPal Pro Landing Page Design

## Context

PatternPal Pro needs a landing page to convert both cold traffic (ads, SEO, social) and warm referrals (affiliates). Currently, visitors land directly in the app with zero context.

- **Landing page URL:** `https://www.amandagracedesign.com/seamlesspatterntester`
- **App URL:** `pattern-tester.amandagracedesign.com`
- **Platform:** Kajabi (custom HTML/CSS in code blocks)
- **Main CTA:** "Test Your Patterns Free" -> links directly to the app (no sign-up gate)

## Design Decisions

- **Button over upload widget:** A CTA button is better than an embedded upload widget because (a) cross-domain file passing between Kajabi and the app is technically infeasible, (b) lower cognitive load, (c) the in-app onboarding tour handles the upload walkthrough.
- **Separate domains:** Landing page on main site (Kajabi), app on subdomain. Returning users bookmark the app directly. Cold traffic sees the sales page first.
- **AEO + SEO:** FAQ section with JSON-LD FAQ schema markup for AI answer engines (Perplexity, ChatGPT, Google AI Overviews) and traditional search.
- **Pricing transparency:** Show all three tiers (Anonymous Free / Free Account / Pro) to reduce friction and set expectations.

## Page Structure

### Section 1: Hero

- **Headline:** "Test Your Seamless Patterns Before You Upload"
- **Subtext:** "Check repeats, inspect seams, preview on products, and export print-ready files -- right in your browser. No downloads, no Photoshop."
- **Primary CTA:** "Test Your Patterns Free" (gold button, links to app)
- **Secondary CTA:** "Watch How It Works" (scrolls to video section)
- **Visual:** Screenshot of app with a pattern loaded, or subtle repeating pattern background

### Section 2: How It Works (3 Steps)

Three columns with icons:
1. **Upload** -- "Drop in your pattern tile. Any size, any DPI."
2. **Test** -- "Check repeats, inspect seams, analyze colors, preview on products."
3. **Export** -- "Download print-ready files at 8+ sizes in under 60 seconds."

### Section 3: Video

- Embedded YouTube walkthrough: `https://www.youtube.com/watch?v=c1kzoeCnnXc`
- Headline: "See PatternPal in Action"
- Brief caption below

### Section 4: Feature Showcase (6 Cards)

2x3 grid, each card has icon + title + one-liner:

| Feature | Description | Badge |
|---------|------------|-------|
| Repeat Types | Full drop, half drop, half brick | Free |
| Zoom & Tile Outline | Inspect details without changing scale | Free |
| Scale Preview | See real-world print sizes | Free |
| Pattern Analysis | Contrast, composition, color harmony | PRO |
| Seam Analyzer | Zoom 400% on every seam | PRO |
| Mockups | Preview on 6 real products, download PNGs | PRO |

### Section 5: Pricing (3 Tiers)

| | Anonymous | Free Account | Pro |
|---|---|---|---|
| Price | Free | Free | $X/mo or $X/yr |
| Pattern tests | 3 | Unlimited | Unlimited |
| Exports | 2 sizes, JPG | 2 sizes, JPG | 8+ sizes, PNG/JPEG/TIFF |
| Pattern Analysis | -- | -- | Yes |
| Seam Analyzer | -- | -- | Yes |
| Mockups | -- | -- | Yes |
| CTA | Test Free | Sign Up Free | Upgrade to Pro |

### Section 6: FAQ (AEO + SEO)

8 questions with JSON-LD FAQ structured data:

1. **What is a seamless pattern tester?** -- A tool that lets you preview how your pattern tile repeats at different layouts and sizes before uploading to a print-on-demand site.
2. **How do I test if my pattern repeats correctly?** -- Upload your tile to PatternPal, select a repeat type (full drop, half drop, or half brick), and zoom in to check the seams.
3. **Does PatternPal upload my files to a server?** -- No. Your files stay entirely in your browser. Nothing is ever sent to a server.
4. **What repeat types does PatternPal support?** -- Full drop, half drop, and half brick -- the three most common repeat layouts used in textile and surface pattern design.
5. **Can I export my patterns for print-on-demand?** -- Yes. Pro users can batch export at 8+ sizes in PNG, JPEG, or TIFF format at 150 or 300 DPI.
6. **What file formats does PatternPal export?** -- PNG, JPEG, and TIFF. Free users get JPG at 2 sizes. Pro users get all formats at 8+ sizes.
7. **How much does PatternPal Pro cost?** -- [Price TBD]. There's also a completely free tier with unlimited pattern testing.
8. **Do I need Photoshop to test seamless patterns?** -- No. PatternPal runs entirely in your browser -- no downloads or software required.

### Section 7: Final CTA

- Dark background, high contrast
- Headline: "Ready to test your patterns?"
- CTA: "Test Your Patterns Free" (gold button, links to app)

## Technical Implementation

- **Delivery:** Standalone HTML/CSS page pasted into Kajabi custom code blocks
- **Responsive:** Mobile-first design with breakpoints
- **Brand colors:** Gold `#e0c26e`, dark `#294051`, gray `#6b7280`
- **Schema markup:** JSON-LD for FAQ (AEO), Organization, and SoftwareApplication
- **No JavaScript dependencies:** Pure HTML/CSS for Kajabi compatibility (except YouTube embed iframe)
- **Meta tags:** Open Graph, Twitter Card, meta description optimized for search

## Assets Needed

- [x] YouTube video walkthrough
- [ ] App screenshot(s) for hero
- [ ] Testimonials (placeholder for now)
- [ ] Final Pro pricing ($X/mo, $X/yr)

## Success Metrics

- Click-through rate on "Test Your Patterns Free" CTA
- Scroll depth (do people see the pricing section?)
- Video play rate
- Conversion to sign-up and Pro upgrade (tracked in app)
