import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  async headers() {
    const scriptSrc = [
      "'self'",
      "'unsafe-inline'",
      "https://*.clerk.com",
      "https://*.clerk.dev",
      "https://*.accounts.dev",
      "https://clerk.amandagracedesign.com",
      "https://js.stripe.com",
      "https://challenges.cloudflare.com",
      "https://r.wdfl.co",
    ];

    if (isDev) {
      scriptSrc.push("'unsafe-eval'");
    }

    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      `script-src ${scriptSrc.join(" ")}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://img.clerk.com",
      "font-src 'self' data: https://fonts.gstatic.com https://r2cdn.perplexity.ai",
      "connect-src 'self' https://*.clerk.com https://*.clerk.dev https://*.accounts.dev https://clerk.amandagracedesign.com https://api.stripe.com https://r.stripe.com https://r.wdfl.co https://*.rewardful.com",
      "frame-src https://*.clerk.com https://*.clerk.dev https://*.accounts.dev https://clerk.amandagracedesign.com https://js.stripe.com https://challenges.cloudflare.com",
      "worker-src 'self' blob:",
    ].join("; ");

    return [
      {
        // Apply to HTML/document responses, not static assets
        source: "/((?!_next/static|_next/image|favicon.ico|favicon.png|icon.png).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
