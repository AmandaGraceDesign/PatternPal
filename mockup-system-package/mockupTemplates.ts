/**
 * Mockup Templates Configuration
 * 
 * This file defines the mockup templates used for pattern visualization.
 * Each template specifies the mockup image and the area where patterns should be applied.
 * 
 * To update coordinates for custom mockups:
 * 1. Open your mockup image in an image editor (Photoshop, GIMP, etc.)
 * 2. Use the selection/measurement tool to determine the pattern area
 * 3. Note the X, Y coordinates (top-left corner) and width/height
 * 4. Update the values below
 * 
 * Pattern Area Coordinates:
 * - x: Distance from left edge of image (in pixels)
 * - y: Distance from top edge of image (in pixels)
 * - width: Width of pattern area (in pixels)
 * - height: Height of pattern area (in pixels)
 */

export interface MockupTemplate {
  id: string;
  name: string;
  category: string;
  image: string;
  patternArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  blendMode?: 'multiply' | 'normal' | 'overlay' | 'soft-light';
  opacity?: number;
  description?: string;
}

export const mockupTemplates: MockupTemplate[] = [
  {
    id: 'pillow',
    name: 'Throw Pillow',
    category: 'home-decor',
    image: '/mockups/pillow.png',
    patternArea: {
      x: 100,      // Start 100px from left
      y: 100,      // Start 100px from top
      width: 600,  // Pattern spans 600px wide
      height: 600  // Pattern spans 600px tall
    },
    blendMode: 'multiply',  // Blend naturally with pillow texture
    opacity: 0.95,           // Slight transparency for realism
    description: 'Square decorative throw pillow with visible texture'
  },
  
  {
    id: 'wallpaper',
    name: 'Wallpaper',
    category: 'home-decor',
    image: '/mockups/wallpaper.png',
    patternArea: {
      x: 50,       // Start 50px from left
      y: 50,       // Start 50px from top
      width: 700,  // Pattern spans 700px wide
      height: 600  // Pattern spans 600px tall (leaving floor visible)
    },
    blendMode: 'normal',     // Full coverage, no blending
    opacity: 1.0,             // Completely opaque
    description: 'Wall interior showing pattern as wallpaper or wall art'
  },
  
  {
    id: 'onesie',
    name: 'Baby Onesie',
    category: 'apparel',
    image: '/mockups/onesie.png',
    patternArea: {
      x: 250,      // Start 250px from left (centered)
      y: 225,      // Start 225px from top
      width: 300,  // Pattern spans 300px wide
      height: 350  // Pattern spans 350px tall
    },
    blendMode: 'multiply',   // Blend with fabric texture
    opacity: 0.92,            // Slight transparency for fabric look
    description: 'Baby onesie flat lay showing front body area'
  },
  
  {
    id: 'tote-bag',
    name: 'Tote Bag',
    category: 'accessories',
    image: '/mockups/tote-bag.png',
    patternArea: {
      x: 200,      // Start 200px from left
      y: 230,      // Start 230px from top (below handles)
      width: 400,  // Pattern spans 400px wide
      height: 450  // Pattern spans 450px tall
    },
    blendMode: 'multiply',   // Blend with canvas texture
    opacity: 0.93,            // Slight transparency for natural look
    description: 'Canvas tote bag showing front panel'
  }
];

/**
 * Helper function to get a mockup template by ID
 */
export function getMockupTemplate(id: string): MockupTemplate | undefined {
  return mockupTemplates.find(template => template.id === id);
}

/**
 * Helper function to get all mockups in a category
 */
export function getMockupsByCategory(category: string): MockupTemplate[] {
  return mockupTemplates.filter(template => template.category === category);
}

/**
 * Helper function to scale pattern area coordinates for different image sizes
 * Useful when you have mockups at different resolutions
 * 
 * @param template - Original template with coordinates for base size
 * @param originalSize - Original mockup size (e.g., 800)
 * @param newSize - New mockup size (e.g., 1200)
 */
export function scaleMockupCoordinates(
  template: MockupTemplate,
  originalSize: number,
  newSize: number
): MockupTemplate {
  const scale = newSize / originalSize;
  
  return {
    ...template,
    patternArea: {
      x: Math.round(template.patternArea.x * scale),
      y: Math.round(template.patternArea.y * scale),
      width: Math.round(template.patternArea.width * scale),
      height: Math.round(template.patternArea.height * scale)
    }
  };
}

/**
 * Validation helper to ensure pattern area is within image bounds
 */
export function validatePatternArea(
  template: MockupTemplate,
  imageWidth: number,
  imageHeight: number
): boolean {
  const { x, y, width, height } = template.patternArea;
  
  return (
    x >= 0 &&
    y >= 0 &&
    x + width <= imageWidth &&
    y + height <= imageHeight
  );
}

export default mockupTemplates;
