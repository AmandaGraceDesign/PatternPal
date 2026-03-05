import { MockupV2Template } from './types';

export const mockupV2Templates: Record<string, MockupV2Template> = {
  // ─── Apparel ───
  'tshirt-dress': {
    id: 'tshirt-dress',
    name: "Children's T-Shirt Dress",
    description: 'A-line children\'s t-shirt dress with flowing fabric',
    category: 'apparel',
    canvasSize: { width: 800, height: 1000 },
    patternArea: { x: 200, y: 120, width: 400, height: 600 },
    perspective: { topSqueeze: 35, bottomSqueeze: 5 },
    displacement: { intensity: 14, wrinkleFreq: 7, type: 'fabric-drape' },
    blend: { mode: 'multiply', opacity: 0.85 },
    lighting: { enabled: true, intensity: 0.25 },
    physicalSize: { width: 14, height: 22, unit: 'in' },
    productBase: { type: 'procedural', brightness: 210, shape: 'fabric-drape' },
  },
  'womens-skirt': {
    id: 'womens-skirt',
    name: "Women's Skirt",
    description: 'A-line skirt with fabric drape',
    category: 'apparel',
    canvasSize: { width: 800, height: 900 },
    patternArea: { x: 150, y: 80, width: 500, height: 700 },
    perspective: { topSqueeze: 40, bottomSqueeze: 10 },
    displacement: { intensity: 16, wrinkleFreq: 8, type: 'fabric-drape' },
    blend: { mode: 'multiply', opacity: 0.85 },
    lighting: { enabled: true, intensity: 0.3 },
    physicalSize: { width: 20, height: 24, unit: 'in' },
    productBase: { type: 'procedural', brightness: 200, shape: 'fabric-drape' },
  },

  // ─── Home Goods ───
  'tablecloth': {
    id: 'tablecloth',
    name: 'Tablecloth',
    description: 'Tablecloth draped over a table surface',
    category: 'home-goods',
    canvasSize: { width: 900, height: 700 },
    patternArea: { x: 50, y: 50, width: 800, height: 600 },
    perspective: { topSqueeze: 20, bottomSqueeze: 0 },
    displacement: { intensity: 10, wrinkleFreq: 5, type: 'fabric-drape' },
    blend: { mode: 'multiply', opacity: 0.88 },
    lighting: { enabled: true, intensity: 0.2 },
    physicalSize: { width: 60, height: 40, unit: 'in' },
    productBase: { type: 'procedural', brightness: 220, shape: 'fabric-drape' },
  },
  'curtain': {
    id: 'curtain',
    name: 'Curtain',
    description: 'Hanging curtain panel with vertical draping',
    category: 'home-goods',
    canvasSize: { width: 600, height: 1000 },
    patternArea: { x: 50, y: 30, width: 500, height: 940 },
    perspective: { topSqueeze: 0, bottomSqueeze: 0 },
    displacement: { intensity: 18, wrinkleFreq: 6, type: 'vertical-drape' },
    blend: { mode: 'multiply', opacity: 0.85 },
    lighting: { enabled: true, intensity: 0.35 },
    physicalSize: { width: 42, height: 84, unit: 'in' },
    productBase: { type: 'procedural', brightness: 200, shape: 'vertical-drape' },
  },
  'blanket': {
    id: 'blanket',
    name: 'Blanket',
    description: 'Soft throw blanket with gentle folds',
    category: 'home-goods',
    canvasSize: { width: 900, height: 800 },
    patternArea: { x: 50, y: 50, width: 800, height: 700 },
    perspective: { topSqueeze: 10, bottomSqueeze: 5 },
    displacement: { intensity: 12, wrinkleFreq: 5, type: 'fabric-drape' },
    blend: { mode: 'multiply', opacity: 0.87 },
    lighting: { enabled: true, intensity: 0.25 },
    physicalSize: { width: 50, height: 60, unit: 'in' },
    productBase: { type: 'procedural', brightness: 215, shape: 'fabric-drape' },
  },
  'nursery-wall': {
    id: 'nursery-wall',
    name: 'Nursery Wall',
    description: 'Nursery room scene with wallpaper applied to wall',
    category: 'home-goods',
    canvasSize: { width: 1000, height: 800 },
    patternArea: { x: 50, y: 30, width: 900, height: 550 },
    perspective: { topSqueeze: 0, bottomSqueeze: 0 },
    displacement: { intensity: 4, wrinkleFreq: 3, type: 'flat-surface' },
    blend: { mode: 'multiply', opacity: 0.90 },
    lighting: { enabled: true, intensity: 0.15 },
    physicalSize: { width: 120, height: 96, unit: 'in' },
    productBase: { type: 'procedural', brightness: 240, shape: 'flat-surface' },
  },

  // ─── Stationery ───
  'gift-bag': {
    id: 'gift-bag',
    name: 'Gift Bag',
    description: 'Paper gift bag with pattern',
    category: 'stationery',
    canvasSize: { width: 700, height: 900 },
    patternArea: { x: 100, y: 100, width: 500, height: 650 },
    perspective: { topSqueeze: 25, bottomSqueeze: 0 },
    displacement: { intensity: 6, wrinkleFreq: 4, type: 'flat-surface' },
    blend: { mode: 'multiply', opacity: 0.90 },
    lighting: { enabled: true, intensity: 0.2 },
    physicalSize: { width: 10, height: 13, unit: 'in' },
    productBase: { type: 'procedural', brightness: 230, shape: 'flat-surface' },
  },
  'wallpaper-roll': {
    id: 'wallpaper-roll',
    name: 'Wallpaper Roll',
    description: 'Wallpaper roll partially unrolled',
    category: 'stationery',
    canvasSize: { width: 700, height: 900 },
    patternArea: { x: 100, y: 50, width: 500, height: 800 },
    perspective: { topSqueeze: 15, bottomSqueeze: 5 },
    displacement: { intensity: 8, wrinkleFreq: 10, type: 'cylindrical' },
    blend: { mode: 'multiply', opacity: 0.88 },
    lighting: { enabled: true, intensity: 0.3 },
    physicalSize: { width: 20, height: 33, unit: 'in' },
    productBase: { type: 'procedural', brightness: 235, shape: 'cylindrical' },
  },

  // ─── Accessories ───
  'silk-scarf': {
    id: 'silk-scarf',
    name: 'Silk Scarf',
    description: 'Flowing silk scarf with drape',
    category: 'accessories',
    canvasSize: { width: 800, height: 800 },
    patternArea: { x: 80, y: 80, width: 640, height: 640 },
    perspective: { topSqueeze: 20, bottomSqueeze: 15 },
    displacement: { intensity: 15, wrinkleFreq: 7, type: 'fabric-drape' },
    blend: { mode: 'multiply', opacity: 0.82 },
    lighting: { enabled: true, intensity: 0.35 },
    physicalSize: { width: 36, height: 36, unit: 'in' },
    productBase: { type: 'procedural', brightness: 210, shape: 'fabric-drape' },
  },
  'phone-case': {
    id: 'phone-case',
    name: 'Phone Case',
    description: 'Smartphone case with slight curve',
    category: 'accessories',
    canvasSize: { width: 500, height: 900 },
    patternArea: { x: 60, y: 100, width: 380, height: 650 },
    perspective: { topSqueeze: 8, bottomSqueeze: 5 },
    displacement: { intensity: 5, wrinkleFreq: 12, type: 'radial-bulge' },
    blend: { mode: 'multiply', opacity: 0.90 },
    lighting: { enabled: true, intensity: 0.2 },
    physicalSize: { width: 3, height: 6, unit: 'in' },
    productBase: { type: 'procedural', brightness: 225, shape: 'radial-bulge' },
  },
  'desk-mat': {
    id: 'desk-mat',
    name: 'Desk Mat',
    description: 'Large desk mat / mouse pad',
    category: 'accessories',
    canvasSize: { width: 1000, height: 500 },
    patternArea: { x: 50, y: 40, width: 900, height: 420 },
    perspective: { topSqueeze: 10, bottomSqueeze: 0 },
    displacement: { intensity: 3, wrinkleFreq: 4, type: 'flat-surface' },
    blend: { mode: 'multiply', opacity: 0.92 },
    lighting: { enabled: true, intensity: 0.15 },
    physicalSize: { width: 35, height: 16, unit: 'in' },
    productBase: { type: 'procedural', brightness: 60, shape: 'flat-surface' },
  },
};

export function getV2Template(id: string): MockupV2Template | undefined {
  return mockupV2Templates[id];
}

export function getAllV2Templates(): MockupV2Template[] {
  return Object.values(mockupV2Templates);
}

export function getV2TemplatesByCategory(category: string): MockupV2Template[] {
  return Object.values(mockupV2Templates).filter(t => t.category === category);
}

export function getAllV2Categories(): string[] {
  return [...new Set(Object.values(mockupV2Templates).map(t => t.category))];
}
