import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('MOCK-ROT: pipeline per-zone angle override threading', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../lib/mockups/mockupEngineV2/MockupPipeline.ts'),
    'utf-8'
  );

  it('declares patternAngleOverrides on the pipeline input', () => {
    expect(src).toMatch(/patternAngleOverrides\??:\s*Record<string,\s*number>/);
  });

  it('adds the override to the zone patternAngle in processZone', () => {
    expect(src).toMatch(/\(zone\.patternAngle\s*\?\?\s*0\)\s*\+\s*overrideAngle/);
  });

  it('threads the override at BOTH the multi-zone and single-zone call sites', () => {
    const multi = src.match(/patternAngleOverrides\?\.\[zone\.id\]/g) ?? [];
    const root = src.match(/patternAngleOverrides\?\.\[ROOT_ZONE_KEY\]/g) ?? [];
    expect(multi.length).toBeGreaterThanOrEqual(1);
    expect(root.length).toBeGreaterThanOrEqual(1);
  });
});
