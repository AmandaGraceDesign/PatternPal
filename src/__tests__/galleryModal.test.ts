import { describe, it, expect } from 'vitest';
import { getAllV2Templates, getV2TemplatesByCategory } from '../lib/mockups/mockupEngineV2/templates/templateRegistry';

// GALL-01: Category filtering for the gallery modal

describe('GALL-01: Gallery category filtering', () => {
  it('getV2TemplatesByCategory("apparel") returns only apparel templates', () => {
    const results = getV2TemplatesByCategory('apparel');
    expect(results.length).toBeGreaterThan(0);
    for (const t of results) {
      expect(t.category).toBe('apparel');
    }
    // Verify specific expected apparel IDs are present
    const ids = results.map(t => t.id);
    expect(ids).toContain('onesie');
    expect(ids).toContain('girl-dress-1');
  });

  it('getAllV2Templates() returns at least 18 templates', () => {
    const all = getAllV2Templates();
    expect(all.length).toBeGreaterThanOrEqual(18);
  });

  it('each of the 8 real categories returns at least 1 template', () => {
    const realCategories = [
      'apparel',
      'home-goods',
      'fabric',
      'wallpaper',
      'gifting',
      'stationery',
      'accessories',
      'seasonal',
    ];
    for (const cat of realCategories) {
      const results = getV2TemplatesByCategory(cat);
      expect(results.length, `Category "${cat}" should have at least 1 template`).toBeGreaterThanOrEqual(1);
    }
  });

  it('getV2TemplatesByCategory("nonexistent") returns an empty array', () => {
    const results = getV2TemplatesByCategory('nonexistent');
    expect(results).toHaveLength(0);
  });
});
