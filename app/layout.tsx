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
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* Cookiebot - must load first for consent banner */}
          <Script
            id="Cookiebot"
            src="https://consent.cookiebot.com/uc.js"
            data-cbid="94c26468-ddf7-4bf1-88ad-aede896d7a17"
            data-blockingmode="auto"
            strategy="beforeInteractive"
          />
          {/* Consent defaults - before GTM */}
          <Script
            id="consent-defaults"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag("consent", "default", {
  ad_personalization: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  analytics_storage: "denied",
  functionality_storage: "denied",
  personalization_storage: "denied",
  security_storage: "granted",
  wait_for_update: 500,
});
gtag("set", "ads_data_redaction", true);
gtag("set", "url_passthrough", true);
gtag("js", new Date());
gtag("config", "AW-11155883885");`,
            }}
          />
          {/* Google Tag Manager */}
          <Script
            id="gtm-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-5PM5T8RC');`,
            }}
          />
          {/* Pinterest Tag */}
          <Script
            id="pinterest-tag"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
pintrk('load', '2613549758241755');
pintrk('page');`,
            }}
          />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
          suppressHydrationWarning
        >
          <noscript>
            <iframe
              src="https://www.googletagmanager.com/ns.html?id=GTM-5PM5T8RC"
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
          {children}
          {/* Rewardful affiliate tracking */}
          <Script src="https://r.wdfl.co/rw.js" data-rewardful="97736d" />
          <Script id="rewardful-queue" strategy="beforeInteractive">
            {`(function(w,r){w._rwq=r;w[r]=w[r]||function(){(w[r].q=w[r].q||[]).push(arguments)}})(window,'rewardful');`}
          </Script>
        </body>
      </html>
    </ClerkProvider>
  );
}
