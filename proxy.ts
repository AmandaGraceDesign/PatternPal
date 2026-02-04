import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware({
  publicRoutes: ["/api/stripe/webhook"],
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
