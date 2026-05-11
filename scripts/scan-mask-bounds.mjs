#!/usr/bin/env node
/**
 * Scan all *-mask.png files in public/mockups/v2/ and print the
 * bounding box of "white" pixels (the pattern fill region). Used to
 * derive patternArea coords for templateRegistry entries.
 *
 * Treats a pixel as "white" if luminance > 128 AND alpha > 128.
 * Skips *-color-mask.png (those are accent regions, not pattern bounds).
 *
 * Usage: node scripts/scan-mask-bounds.mjs
 */
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const V2_DIR = join(__dirname, '..', 'public', 'mockups', 'v2');

async function scan(file) {
  const path = join(V2_DIR, file);
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      if (lum > 128 && a > 128) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) {
    return { file, canvas: { width, height }, bounds: null };
  }
  return {
    file,
    canvas: { width, height },
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
  };
}

const all = await readdir(V2_DIR);
const masks = all.filter(f => f.endsWith('-mask.png') && !f.endsWith('-color-mask.png'));

const results = {};
for (const m of masks) {
  const r = await scan(m);
  results[m] = r;
  const b = r.bounds;
  console.log(
    `${m.padEnd(40)} canvas=${r.canvas.width}x${r.canvas.height}  bounds=` +
    (b ? `x:${b.x} y:${b.y} w:${b.width} h:${b.height}` : 'EMPTY')
  );
}

console.log('\n--- JSON ---');
console.log(JSON.stringify(results, null, 2));
