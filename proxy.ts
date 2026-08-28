import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

// This controls which routes Clerk middleware runs on
export const config = {
  matcher: [
    /*
     * Match all routes except for:
     * - Next.js internals
     * - static files, matched by extension
     * - api routes like /api/stripe/webhook
     *
     * The extension exclusion is a cost guard, not a correctness one. Files
     * under public/ (407 mockup thumbnails, masks and layers) are served 100%
     * from the CDN cache and never need auth — but without excluding them here
     * they still ran Clerk middleware on every request. Measured 2026-08-27:
     * 2.5K middleware invocations against 2.6K total edge requests in the same
     * 15 minutes, i.e. ~96% of all requests, which is what was setting off
     * Vercel usage-anomaly alerts. Opening the mockup gallery pulls dozens of
     * assets, and each one was a billed invocation.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|[^?]*\\.(?:png|jpe?g|gif|svg|webp|ico|css|js|woff2?|ttf|zip|webmanifest|txt|xml)).*)",
  ],
};
