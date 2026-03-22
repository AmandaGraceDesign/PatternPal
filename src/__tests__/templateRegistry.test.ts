import { describe, it, expect } from 'vitest';
import { mockupV2Templates, getAllV2Templates } from '../lib/mockups/mockupEngineV2/templates/templateRegistry';

// MOCK-02: Kids dress per-zone physicalWidth
describe('MOCK-02: kids dress per-zone physicalWidth', () => {
  const dress = mockupV2Templates['tshirt-dress'];

  it('bodice zone has physicalWidth 13.5', () => {
    const bodice = dress.zones?.find(z => z.id === 'bodice');
    expect(bodice).toBeDefined();
    expect(bodice!.physicalWidth).toBe(13.5);
  });

  it('skirt zone has physicalWidth 18', () => {
    const skirt = dress.zones?.find(z => z.id === 'skirt');
    expect(skirt).toBeDefined();
    expect(skirt!.physicalWidth).toBe(18);
  });

  it('skirt zone has fabric-drape displacement with non-zero intensity', () => {
    const skirt = dress.zones?.find(z => z.id === 'skirt');
    expect(skirt).toBeDefined();
    expect(skirt!.displacement.type).toBe('fabric-drape');
    expect(skirt!.displacement.intensity).toBeGreaterThan(0);
  });

  it('bodice zone has flat-surface displacement with intensity 0', () => {
    const bodice = dress.zones?.find(z => z.id === 'bodice');
    expect(bodice).toBeDefined();
    expect(bodice!.displacement.type).toBe('flat-surface');
    expect(bodice!.displacement.intensity).toBe(0);
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
