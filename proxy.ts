import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: ["/api/stripe/webhook"],
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
