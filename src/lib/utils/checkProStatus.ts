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

  // Format 1: Simple isPro boolean
  if (publicMetadata.isPro === true) {
    return true;
  }

  // Format 2: plan === 'patternpal_pro' (optionally with proUntil date)
  if (publicMetadata.plan === 'patternpal_pro') {
    if (publicMetadata.proUntil) {
      const proUntilDate = new Date(publicMetadata.proUntil);
      const now = new Date();
      return proUntilDate > now; // Pro if subscription hasn't expired
    }
    return true;
  }

  return false;
}
