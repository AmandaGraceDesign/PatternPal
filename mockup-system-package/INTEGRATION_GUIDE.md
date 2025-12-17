# Mockup System Integration Guide 🚀

Welcome to your complete guide for integrating the mockup visualization system! This guide will walk you through everything from basic setup to advanced customization.

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [File Structure](#file-structure)
3. [Basic Usage](#basic-usage)
4. [Customizing Mockups](#customizing-mockups)
5. [Advanced Features](#advanced-features)
6. [Performance Optimization](#performance-optimization)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Copy Files to Your Project

```bash
# Copy mockup images
cp -r public/mockups /your-project/public/

# Copy TypeScript configuration
cp mockupTemplates.ts /your-project/src/lib/mockups/

# Copy React component
cp MockupRenderer.tsx /your-project/src/components/mockups/
```

### 2. Basic Implementation

```tsx
import React from 'react';
import { MockupRenderer } from '@/components/mockups/MockupRenderer';
import { mockupTemplates } from '@/lib/mockups/mockupTemplates';

function MyPatternPreview() {
  const pillowMockup = mockupTemplates.find(m => m.id === 'pillow');
  const myPatternUrl = '/patterns/my-awesome-pattern.png';

  return (
    <MockupRenderer
      mockupTemplate={pillowMockup}
      patternImageUrl={myPatternUrl}
    />
  );
}
```

That's it! You now have a working mockup renderer. 🎉

---

## File Structure

```
your-project/
├── public/
│   └── mockups/
│       ├── pillow.png
│       ├── wallpaper.png
│       ├── onesie.png
│       ├── tote-bag.png
│       └── README.md (creation guide)
│
├── src/
│   ├── components/
│   │   └── mockups/
│   │       └── MockupRenderer.tsx
│   │
│   └── lib/
│       └── mockups/
│           └── mockupTemplates.ts
│
└── ... (rest of your project)
```

---

## Basic Usage

### Rendering a Single Mockup

```tsx
import { MockupRenderer } from '@/components/mockups/MockupRenderer';
import { getMockupTemplate } from '@/lib/mockups/mockupTemplates';

function SingleMockup() {
  return (
    <MockupRenderer
      mockupTemplate={getMockupTemplate('pillow')}
      patternImageUrl="/patterns/floral-design.png"
      patternScale={1.2}  // Make pattern 20% larger
    />
  );
}
```

### Rendering Multiple Mockups (Gallery)

```tsx
import { MockupGallery } from '@/components/mockups/MockupRenderer';
import { mockupTemplates } from '@/lib/mockups/mockupTemplates';

function MockupShowcase({ patternUrl }) {
  return (
    <MockupGallery
      mockupTemplates={mockupTemplates}
      patternImageUrl={patternUrl}
      columns={2}
      gap={24}
      onMockupClick={(template) => {
        console.log('Clicked:', template.name);
      }}
    />
  );
}
```

### Filtering by Category

```tsx
import { getMockupsByCategory } from '@/lib/mockups/mockupTemplates';

function HomeDecorMockups({ patternUrl }) {
  const homeDecorMockups = getMockupsByCategory('home-decor');
  
  return (
    <div>
      <h2>Your Pattern on Home Decor</h2>
      <MockupGallery
        mockupTemplates={homeDecorMockups}
        patternImageUrl={patternUrl}
      />
    </div>
  );
}
```

---

## Customizing Mockups

### Adding Your Own Mockup Template

1. **Add your mockup image** to `/public/mockups/`

2. **Update mockupTemplates.ts**:

```typescript
import { MockupTemplate } from './mockupTemplates';

export const customMockup: MockupTemplate = {
  id: 'my-custom-pillow',
  name: 'Luxury Velvet Pillow',
  category: 'home-decor',
  image: '/mockups/velvet-pillow.png',
  patternArea: {
    x: 120,
    y: 130,
    width: 560,
    height: 540
  },
  blendMode: 'multiply',
  opacity: 0.88,  // More transparent for velvet texture
  description: 'Luxurious velvet throw pillow with rich texture'
};

// Add to the mockupTemplates array
export const mockupTemplates: MockupTemplate[] = [
  // ... existing mockups
  customMockup
];
```

### Adjusting Pattern Area Coordinates

**Method 1: Using Image Editor**

1. Open mockup in Photoshop/GIMP
2. Use Rectangle Selection Tool
3. Draw where pattern should appear
4. Note X, Y, Width, Height from info panel
5. Update coordinates in mockupTemplates.ts

**Method 2: Visual Testing**

```tsx
// Create a test component to visualize pattern area
function MockupCoordinateTester() {
  const [coords, setCoords] = useState({
    x: 100, y: 100, width: 600, height: 600
  });

  return (
    <div>
      <div>
        <label>X: <input type="number" value={coords.x} 
          onChange={e => setCoords({...coords, x: +e.target.value})} />
        </label>
        {/* Similar inputs for y, width, height */}
      </div>
      
      <MockupRenderer
        mockupTemplate={{
          ...testMockup,
          patternArea: coords
        }}
        patternImageUrl="/test-pattern.png"
      />
      
      <pre>{JSON.stringify(coords, null, 2)}</pre>
    </div>
  );
}
```

### Optimizing Blend Modes for Different Materials

```typescript
// For fabric (pillows, onesies, totes)
blendMode: 'multiply',
opacity: 0.90-0.95

// For smooth surfaces (wallpaper, hard goods)
blendMode: 'normal',
opacity: 1.0

// For translucent materials
blendMode: 'overlay',
opacity: 0.75-0.85

// For soft, dreamy effects
blendMode: 'soft-light',
opacity: 0.80-0.90
```

---

## Advanced Features

### Downloading Rendered Mockups

```tsx
import { MockupRenderer, useMockupDownload } from '@/components/mockups/MockupRenderer';

function DownloadableMockup({ pattern }) {
  const { downloadMockup } = useMockupDownload();
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  const handleDownload = () => {
    if (canvas) {
      downloadMockup(canvas, `${pattern.name}-mockup.png`);
    }
  };

  return (
    <div>
      <MockupRenderer
        mockupTemplate={getMockupTemplate('pillow')}
        patternImageUrl={pattern.url}
        onRenderComplete={setCanvas}
      />
      
      <button onClick={handleDownload}>
        Download Mockup
      </button>
    </div>
  );
}
```

### Dynamic Pattern Scaling

```tsx
function ScalablePatternMockup({ patternUrl }) {
  const [scale, setScale] = useState(1.0);

  return (
    <div>
      <label>
        Pattern Scale: {scale.toFixed(1)}x
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={scale}
          onChange={(e) => setScale(parseFloat(e.target.value))}
        />
      </label>
      
      <MockupRenderer
        mockupTemplate={getMockupTemplate('wallpaper')}
        patternImageUrl={patternUrl}
        patternScale={scale}
      />
    </div>
  );
}
```

### Loading State Customization

```tsx
import { MockupRenderer } from '@/components/mockups/MockupRenderer';
import { Loader } from '@/components/ui/Loader';

function CustomLoadingMockup() {
  return (
    <div className="relative">
      <MockupRenderer
        mockupTemplate={getMockupTemplate('tote-bag')}
        patternImageUrl="/pattern.png"
      />
      
      {/* Add custom CSS to style .mockup-loading */}
      <style jsx>{`
        .mockup-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem;
          background: linear-gradient(135deg, #f5f5f5, #e8e8e8);
        }
        
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e0e0e0;
          border-top-color: #666;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
```

### Responsive Mockup Grid

```tsx
function ResponsiveMockupGallery({ patternUrl }) {
  return (
    <div className="responsive-mockup-grid">
      <MockupGallery
        mockupTemplates={mockupTemplates}
        patternImageUrl={patternUrl}
      />
      
      <style jsx>{`
        .mockup-gallery {
          grid-template-columns: 1fr;
        }
        
        @media (min-width: 640px) {
          .mockup-gallery {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        
        @media (min-width: 1024px) {
          .mockup-gallery {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
```

---

## Performance Optimization

### Lazy Loading Mockups

```tsx
import { lazy, Suspense } from 'react';

const MockupRenderer = lazy(() => import('@/components/mockups/MockupRenderer'));

function LazyMockup() {
  return (
    <Suspense fallback={<div>Loading mockup...</div>}>
      <MockupRenderer
        mockupTemplate={getMockupTemplate('pillow')}
        patternImageUrl="/pattern.png"
      />
    </Suspense>
  );
}
```

### Memoizing Rendered Mockups

```tsx
import { memo } from 'react';

const MemoizedMockupRenderer = memo(
  MockupRenderer,
  (prevProps, nextProps) => {
    return (
      prevProps.mockupTemplate.id === nextProps.mockupTemplate.id &&
      prevProps.patternImageUrl === nextProps.patternImageUrl &&
      prevProps.patternScale === nextProps.patternScale
    );
  }
);
```

### Image Preloading

```tsx
function preloadMockupImages(templates: MockupTemplate[]) {
  templates.forEach(template => {
    const img = new Image();
    img.src = template.image;
  });
}

// Call on app initialization
useEffect(() => {
  preloadMockupImages(mockupTemplates);
}, []);
```

### Optimizing Canvas Rendering

```typescript
// In mockupTemplates.ts, for large mockups
export const scaledMockup = scaleMockupCoordinates(
  largeMockupTemplate,
  2400,  // Original size
  1200   // Scaled size for web
);
```

---

## Troubleshooting

### Pattern Not Showing

**Problem**: Pattern area is blank or white

**Solutions**:
1. Check pattern image URL is correct and accessible
2. Verify pattern area coordinates are within image bounds
3. Check browser console for CORS errors
4. Ensure blend mode and opacity aren't hiding the pattern

```tsx
// Debug helper
function DebugMockup() {
  return (
    <MockupRenderer
      mockupTemplate={{
        ...template,
        blendMode: 'normal',  // Test with no blending
        opacity: 1.0          // Full opacity
      }}
      patternImageUrl={patternUrl}
      onRenderComplete={(canvas) => {
        console.log('Canvas rendered:', canvas.width, 'x', canvas.height);
      }}
    />
  );
}
```

### Pattern Looks Distorted

**Problem**: Pattern appears stretched or compressed

**Solutions**:
1. Ensure pattern image has correct aspect ratio
2. Adjust pattern area to match pattern proportions
3. Use patternScale to fine-tune sizing

### Slow Rendering Performance

**Problem**: Mockups take too long to load

**Solutions**:
1. Optimize mockup images (compress to <300KB)
2. Use lazy loading for multiple mockups
3. Implement memoization
4. Reduce mockup image dimensions if too large

### CORS Errors

**Problem**: "Tainted canvas" or CORS errors

**Solutions**:
1. Ensure images are served from same domain
2. Add proper CORS headers on image server
3. Use proxy for external images
4. Check crossOrigin attribute is set

### Memory Leaks

**Problem**: Browser slows down with many mockups

**Solutions**:
1. Implement virtual scrolling for large galleries
2. Clean up canvas references properly
3. Limit number of simultaneously rendered mockups
4. Use React.memo to prevent unnecessary re-renders

---

## Best Practices 🌟

### 1. **Image Optimization**
- Keep mockup images under 300KB
- Use appropriate dimensions (1200x1200 is usually enough)
- Optimize with TinyPNG or Squoosh before adding to project

### 2. **Coordinate Precision**
- Test coordinates with various pattern styles
- Document your coordinate measurement process
- Create a test suite with different patterns

### 3. **Error Handling**
- Always provide fallback images
- Show helpful error messages
- Log errors for debugging

### 4. **User Experience**
- Show loading states
- Enable download functionality
- Provide pattern scale controls
- Offer multiple mockup options

### 5. **Code Organization**
- Keep mockup configurations separate
- Document blend mode choices
- Version control your mockup images
- Maintain consistent naming conventions

---

## Example: Complete Pattern Showcase

Here's a full-featured example bringing it all together:

```tsx
import { useState } from 'react';
import { 
  MockupGallery, 
  MockupRenderer, 
  useMockupDownload 
} from '@/components/mockups/MockupRenderer';
import { 
  mockupTemplates, 
  getMockupsByCategory 
} from '@/lib/mockups/mockupTemplates';

function PatternShowcase({ pattern }) {
  const [selectedMockup, setSelectedMockup] = useState(null);
  const [patternScale, setPatternScale] = useState(1.0);
  const { downloadMockup } = useMockupDownload();
  const [canvas, setCanvas] = useState(null);

  const categories = ['home-decor', 'apparel', 'accessories'];

  return (
    <div className="pattern-showcase">
      <header>
        <h1>{pattern.name}</h1>
        <p>{pattern.description}</p>
      </header>

      {/* Category Tabs */}
      <div className="category-tabs">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => {/* switch category */}}
            className="category-tab"
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Main Mockup Display */}
      {selectedMockup ? (
        <div className="selected-mockup-view">
          <div className="mockup-controls">
            <label>
              Pattern Scale: {patternScale.toFixed(1)}x
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={patternScale}
                onChange={(e) => setPatternScale(+e.target.value)}
              />
            </label>
            
            <button onClick={() => canvas && downloadMockup(canvas)}>
              Download Mockup
            </button>
            
            <button onClick={() => setSelectedMockup(null)}>
              Back to Gallery
            </button>
          </div>

          <MockupRenderer
            mockupTemplate={selectedMockup}
            patternImageUrl={pattern.imageUrl}
            patternScale={patternScale}
            onRenderComplete={setCanvas}
          />
        </div>
      ) : (
        /* Mockup Gallery */
        <MockupGallery
          mockupTemplates={mockupTemplates}
          patternImageUrl={pattern.imageUrl}
          columns={2}
          gap={24}
          onMockupClick={setSelectedMockup}
        />
      )}
    </div>
  );
}

export default PatternShowcase;
```

---

## Next Steps 🚀

1. **Integrate the components** into your project
2. **Test with your patterns** to ensure rendering looks great
3. **Customize blend modes** for your specific mockup photos
4. **Optimize images** for fast loading
5. **Gather user feedback** on mockup quality and usefulness

Remember: Start with the placeholder mockups, get everything working smoothly, then upgrade to gorgeous realistic photos one by one!

---

## Resources

- [Canvas API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Blend Modes Reference](https://developer.mozilla.org/en-US/docs/Web/CSS/blend-mode)
- [Image Optimization Guide](/public/mockups/README.md)

---

*Happy mockup creating! Your patterns are going to look AMAZING.* ✨

*Questions? Issues? The console logs are your friend—check them first!*
