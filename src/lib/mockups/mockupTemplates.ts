/**
 * Mockup Template Definitions
 * Defines mockup types and their configuration
 * 
 * Pattern area coordinates are in pixels (for 800x800px mockup images)
 */

export type MockupType = 'pillow' | 'wallpaper' | 'onesie' | 'tote-bag' | 'fabric-swatch';

export interface MockupTemplate {
  id: MockupType;
  name: string;
  description: string;
  templateImage: string; // Path to template image (for backward compatibility)
  image: string; // Path to template image (new format)
  category?: string;
  maskImage?: string; // Optional mask for pattern area
  patternArea: {
    x: number; // Pixels from left edge
    y: number; // Pixels from top edge
    width: number; // Width in pixels
    height: number; // Height in pixels
    transform?: string; // CSS transform for perspective/distortion (legacy)
  };
  blendMode?: 'multiply' | 'normal' | 'overlay' | 'soft-light';
  opacity?: number;
  approach: 'css' | 'canvas'; // Rendering approach
  physicalDimensions?: {
    width: number; // Physical width in inches
    height: number; // Physical height in inches
    unit: 'inch' | 'cm';
    displayLabel: string; // e.g., "16 × 16 inch Throw Pillow"
  };
}

// Mockup template configurations
// Coordinates are in pixels for 800x800px mockup images
export const mockupTemplates: Record<MockupType, MockupTemplate> = {
  pillow: {
    id: 'pillow',
    name: 'Throw Pillow',
    description: 'See your pattern on a decorative pillow',
    templateImage: '/mockups/pillow.png', // Legacy property
    image: '/mockups/pillow.png',
    category: 'home-decor',
    patternArea: {
      x: 100,      // Start 100px from left
      y: 100,      // Start 100px from top
      width: 600,  // Pattern spans 600px wide
      height: 600, // Pattern spans 600px tall
    },
    blendMode: 'multiply',  // Blend naturally with pillow texture
    opacity: 0.95,           // Slight transparency for realism
    approach: 'canvas',
    physicalDimensions: {
      width: 16,
      height: 16,
      unit: 'inch',
      displayLabel: '16 × 16 inch Throw Pillow'
    },
  },
  wallpaper: {
    id: 'wallpaper',
    name: 'Wallpaper',
    description: 'Preview your pattern as wallpaper',
    templateImage: '/mockups/wallpaper.png',
    image: '/mockups/wallpaper.png',
    maskImage: '/mockups/wallpaper_mask.png',
    category: 'home-decor',
    patternArea: {
      x: 0,         // Start at left edge
      y: 0,         // Start at top edge
      width: 1024,  // Match image width
      height: 1024, // Match image height
    },
    blendMode: 'multiply',   // Test multiply blend mode
    opacity: 0.9,            // 90% opacity for better blending
    approach: 'canvas',
    physicalDimensions: {
      width: 144,  // 12 feet
      height: 96,  // 8 feet
      unit: 'inch',
      displayLabel: '12 × 8 ft Wall'
    },
  },
  onesie: {
    id: 'onesie',
    name: 'Baby Onesie',
    description: 'See your pattern on baby clothing',
    templateImage: '/mockups/onesie.png',
    image: '/mockups/onesie.png',
    maskImage: '/mockups/onesie_mask_new.png',
    category: 'apparel',
    patternArea: {
      x: 0,         // Start at left edge
      y: 0,         // Start at top edge
      width: 1024,  // Match image width
      height: 1024, // Match image height
    },
    blendMode: 'multiply',   // Blend with fabric texture
    opacity: 0.9,            // 90% opacity for better blending
    approach: 'canvas',
    physicalDimensions: {
      width: 12,
      height: 14,
      unit: 'inch',
      displayLabel: 'Medium Baby Onesie (12 × 14 inch)'
    },
  },
  'tote-bag': {
    id: 'tote-bag',
    name: 'Tote Bag',
    description: 'Preview your pattern on a tote bag',
    templateImage: '/mockups/tote-bag.png',
    image: '/mockups/tote-bag.png',
    category: 'accessories',
    patternArea: {
      x: 200,      // Start 200px from left
      y: 230,      // Start 230px from top (below handles)
      width: 400,  // Pattern spans 400px wide
      height: 450,  // Pattern spans 450px tall
    },
    blendMode: 'multiply',   // Blend with canvas texture
    opacity: 0.93,            // Slight transparency for natural look
    approach: 'canvas',
    physicalDimensions: {
      width: 15,
      height: 16,
      unit: 'inch',
      displayLabel: '15 × 16 inch Tote Bag'
    },
  },
  'fabric-swatch': {
    id: 'fabric-swatch',
    name: 'Fabric Swatch',
    description: 'See your pattern on a fabric swatch',
    templateImage: '/mockups/fabric_swatch.png',
    image: '/mockups/fabric_swatch.png',
    maskImage: '/mockups/fabric_swatch_mask.png',
    category: 'fabric',
    patternArea: {
      x: 0,         // Start at left edge
      y: 0,         // Start at top edge
      width: 1024,  // Match image width
      height: 1024, // Match image height
    },
    blendMode: 'multiply',   // Blend with fabric texture
    opacity: 0.9,            // 90% opacity for better blending
    approach: 'canvas',
    physicalDimensions: {
      width: 8,
      height: 8,
      unit: 'inch',
      displayLabel: '8 × 8 inch Fabric Swatch'
    },
  },
};

export function getMockupTemplate(type: MockupType): MockupTemplate {
  return mockupTemplates[type];
}

export function getAllMockupTypes(): MockupType[] {
  return Object.keys(mockupTemplates) as MockupType[];
}

/**
 * Helper function to get all mockups in a category
 */
export function getMockupsByCategory(category: string): MockupTemplate[] {
  return Object.values(mockupTemplates).filter(template => template.category === category);
}
