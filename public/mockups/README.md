# Custom Mockup Creation Guide 🎨

Welcome to your guide for creating stunning, realistic product mockups! Think of this as your roadmap from "placeholder pretty" to "portfolio perfect."

## Why Custom Mockups Matter

Your patterns deserve a stage that makes them shine! While our placeholder mockups are clean and functional, custom realistic mockups will:
- Make your patterns look touchable, real, and desirable
- Show customers exactly how your designs translate to physical products
- Elevate your brand from "nice" to "I need that NOW"
- Build trust through professional presentation

## Quick Reference Specs

### All Mockups Should Have:
- **Format**: PNG (with transparency preferred, or clean white/neutral background)
- **Minimum Size**: 800x800px
- **Recommended Size**: 1200x1200px or larger (for crisp display on all screens)
- **Aspect Ratio**: Square (1:1) for consistency
- **Color Space**: sRGB
- **File Size**: Under 500KB after optimization (aim for 200-300KB)

---

## Mockup #1: Throw Pillow

### What Works Best
A square decorative pillow photographed at a slight angle to show dimension. Natural lighting from the side creates depth without harsh shadows.

### Pattern Area Specifications
- **Pattern Coverage**: Full pillow face, edge to edge
- **Visible Area**: Approximately 70-80% of image (rest is background/shadow)
- **Pattern Positioning**: Centered on pillow surface
- **Coordinate Reference**: Current system uses coordinates ~(100, 100) to (700, 700) for an 800x800 image

### Photography Tips
- **Setting**: Staged on a neutral surface (white bed, beige sofa, wooden bench)
- **Angle**: 15-30 degree rotation from straight-on
- **Lighting**: Soft, natural window light from left or right
- **Depth**: Slightly fluffed/dimensional, not perfectly flat
- **Background**: Minimal—let the pillow be the star

---

## Mockup #2: Wallpaper/Wall Art

### What Works Best
A clean interior wall shot showing the pattern as wallpaper or large-scale wall art. Include a hint of floor or furniture for context, but keep it minimal.

### Pattern Area Specifications
- **Pattern Coverage**: Main wall area, leaving floor/baseboard visible
- **Visible Area**: 60-70% of image is patterned wall
- **Pattern Positioning**: Upper 2/3 of image
- **Coordinate Reference**: ~(50, 50) to (750, 650) for an 800x800 image

---

## Mockup #3: Baby Onesie

### What Works Best
A baby onesie laid flat or on a simple hanger, photographed from directly above. Clean, bright, and focused on the garment.

### Pattern Area Specifications
- **Pattern Coverage**: Front body of onesie (avoid snaps/neckline)
- **Visible Area**: Central body area, ~300x350px region
- **Pattern Positioning**: Centered on onesie chest/torso
- **Coordinate Reference**: ~(250, 225) to (550, 575) for an 800x800 image

---

## Mockup #4: Tote Bag

### What Works Best
A canvas tote bag photographed at a slight angle to show both front and one side. Natural draping creates realistic appeal.

### Pattern Area Specifications
- **Pattern Coverage**: Front panel of tote (leave handles plain)
- **Visible Area**: Front face, ~400x450px region
- **Pattern Positioning**: Centered on front panel
- **Coordinate Reference**: ~(200, 230) to (600, 680) for an 800x800 image

---

## Pattern Area Coordinates Guide

When you add your custom mockups, you'll need to adjust the pattern area coordinates in `mockupTemplates.ts`. Here's how to find them:

### Method 1: Visual Estimation
1. Open your mockup in an image editor
2. Note the total dimensions (e.g., 1200x1200)
3. Identify where your pattern should appear
4. Estimate coordinates as percentages, then convert to pixels

**Example**: If pattern should cover center 60% of a 1200x1200 image:
- Left: 240px (20% from left edge)
- Top: 240px (20% from top edge)
- Width: 720px (60% of total)
- Height: 720px (60% of total)

### Method 2: Precise Measurement (Recommended)
1. Open mockup in Photoshop, GIMP, or similar
2. Use the Rectangle Selection tool
3. Draw exactly where pattern should appear
4. Note the X, Y, Width, Height in the info panel
5. Update coordinates in code

---

*For complete guide, see the full documentation in the mockup-system-package folder.*
