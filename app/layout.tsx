import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Script from "next/script";
import "./globals.css";

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: {
    default: "PatternPal Pro",
    template: "%s | PatternPal Pro",
  },
  description: "PatternPal Pro",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      localization={{
        signIn: {
          start: {
            title: "Create a free account",
            subtitle: "Continue testing your patterns for free",
          },
        },
      }}
    >
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          {/* Rewardful affiliate tracking */}
          <Script id="rewardful-queue" strategy="beforeInteractive">
            {`(function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');`}
          </Script>
          {process.env.NEXT_PUBLIC_REWARDFUL_API_KEY && (
            <Script
              src="https://r.wdfl.co/rw.js"
              data-rewardful={process.env.NEXT_PUBLIC_REWARDFUL_API_KEY}
              strategy="afterInteractive"
            />
          )}
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
