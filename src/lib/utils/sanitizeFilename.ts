/**
 * Sanitize filename to prevent path traversal and injection attacks
 * - Removes/replaces path separators (/, \)
 * - Removes dangerous characters (null bytes, control chars)
 * - Rejects directory traversal sequences (..)
 * - Limits filename length to prevent filesystem issues
 * @param input - Raw filename from user input
 * @param fallback - Safe fallback name if input is invalid
 * @returns Safe filename suitable for filesystem operations
 */
export function sanitizeFilename(input: string, fallback = 'file'): string {
  const trimmed = (input || '').trim();

  // Explicitly reject directory traversal attempts
  if (trimmed.includes('..')) {
    console.warn('Filename contains directory traversal sequence (..), using fallback');
    return fallback;
  }

  // Remove null bytes (can truncate filenames on some systems)
  // Remove control characters (0x00-0x1F, 0x7F-0x9F)
  const withoutDangerous = trimmed
    .replace(/\x00/g, '')  // Null bytes
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '');  // Control characters

  // Replace path separators and normalize special chars
  const cleaned = withoutDangerous
    .replace(/[\\/]/g, '_')  // Path separators → underscore
    .replace(/[^\w.\- ]+/g, '_')  // Non-word chars → underscore (except . - space)
    .replace(/\s+/g, ' ')  // Multiple spaces → single space
    .trim();

  // Use fallback if sanitization removed everything
  const safe = cleaned || fallback;

  // Limit length (120 chars is safe for most filesystems)
  return safe.slice(0, 120);
}
