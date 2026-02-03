/**
 * Client-side utility to check if a user has Pro status
 * Supports multiple metadata formats:
 * 1. publicMetadata.isPro (legacy/simple format)
 * 2. publicMetadata.plan === 'patternpal_pro' with proUntil date
 */
export function checkClientProStatus(publicMetadata: any): boolean {
  if (!publicMetadata) {
    return false;
  }

  return publicMetadata.pro === true;
}
