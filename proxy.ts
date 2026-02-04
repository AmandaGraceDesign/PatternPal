import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

// This controls which routes Clerk middleware runs on
export const config = {
  matcher: [
    /*
     * Match all routes except for:
     * - static files
     * - api routes like /api/stripe/webhook
     */
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook).*)",
  ],
};
