import { describe, it, expect } from 'vitest';
import { mockupV2Templates, getAllV2Templates } from '../lib/mockups/mockupEngineV2/templates/templateRegistry';

// MOCK-02: Kids dress per-zone physicalWidth
describe('MOCK-02: kids dress per-zone physicalWidth', () => {
  const dress = mockupV2Templates['girl-dress-1'];

  it('bodice zone has a defined physicalWidth', () => {
    const bodice = dress.zones?.find(z => z.id === 'bodice');
    expect(bodice).toBeDefined();
    expect(bodice!.physicalWidth).toBeGreaterThan(0);
  });

  it('sleeves zone has a defined physicalWidth', () => {
    const sleeves = dress.zones?.find(z => z.id === 'sleeves');
    expect(sleeves).toBeDefined();
    expect(sleeves!.physicalWidth).toBeGreaterThan(0);
  });

  it('skirt zone has a defined physicalWidth wider than bodice', () => {
    const skirt = dress.zones?.find(z => z.id === 'skirt');
    const bodice = dress.zones?.find(z => z.id === 'bodice');
    expect(skirt).toBeDefined();
    expect(skirt!.physicalWidth).toBeGreaterThan(bodice!.physicalWidth!);
  });
});

// MOCK-01: All 6 V1 mockups present in V2 registry
describe('MOCK-01: V1 mockup migration', () => {
  const v1Ids = ['onesie', 'fabric-swatch', 'wallpaper', 'throw-pillow', 'wrapping-paper', 'journal'];

  it.each(v1Ids)('%s exists in V2 registry', (id) => {
    expect(mockupV2Templates[id]).toBeDefined();
  });

  it.each(v1Ids)('%s has productBase.type === "image"', (id) => {
    expect(mockupV2Templates[id].productBase.type).toBe('image');
  });

  it.each(v1Ids)('%s has category assigned', (id) => {
    expect(mockupV2Templates[id].category).toBeTruthy();
  });
});

// MOCK-03: All templates have sizeLabel
describe('MOCK-03: sizeLabel on all templates', () => {
  const all = getAllV2Templates();

  it('every template has a non-empty sizeLabel', () => {
    for (const t of all) {
      expect(t.sizeLabel, `${t.id} missing sizeLabel`).toBeTruthy();
    }
  });

  it('sizeLabels match format: dimensions + cm + product name', () => {
    const formatRegex = /^\d+(\.\d+)?×\d+(\.\d+)?"\s*\(\d+(\.\d+)?×\d+(\.\d+)?cm\)\s+.+$/;
    for (const t of all) {
      expect(t.sizeLabel, `${t.id} sizeLabel format wrong: ${t.sizeLabel}`).toMatch(formatRegex);
    }
  });
});
