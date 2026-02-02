export function sanitizeFilename(input: string, fallback = 'file'): string {
  const trimmed = (input || '').trim();
  const cleaned = trimmed
    .replace(/[\\/]/g, '_')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  const safe = cleaned || fallback;
  return safe.slice(0, 120);
}
