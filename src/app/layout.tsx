import type { Metadata, Viewport } from "next";
import { Nunito, Geist_Mono, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/providers";
import { themeInitScript } from "@/lib/theme";
import { legacyBodyScript, newUiInitScript } from "@/lib/new-ui-init";
import { accentInitScript } from "@/lib/accent-theme";
import { daypartInitScript } from "@/lib/daypart";
import {
  defaultDescription,
  defaultTitle,
  jsonLdScriptProps,
  keywords,
  organizationJsonLd,
  siteName,
  siteUrl,
  softwareApplicationJsonLd,
  webSiteJsonLd,
} from "@/lib/seo";

const GOOGLE_TAG_ID = "AW-18375140054";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: `%s | ${siteName}`,
  },
  description: defaultDescription,
  keywords,
  applicationName: siteName,
  // Installable web app (manifest.ts); on iOS, web push needs the home-screen app.
  appleWebApp: { capable: true, title: "Scribe", statusBarStyle: "default" },
  category: "education",
  openGraph: {
    type: "website",
    siteName,
    url: siteUrl,
    title: defaultTitle,
    description: defaultDescription,
    images: [{ url: "/brand/og-default.png", width: 1200, height: 630, alt: "Scribe: study from your notes" }],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/brand/og-default.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${nunito.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: newUiInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: accentInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: daypartInitScript }} />
        <script {...jsonLdScriptProps(organizationJsonLd)} />
        <script {...jsonLdScriptProps(webSiteJsonLd)} />
        <script {...jsonLdScriptProps(softwareApplicationJsonLd)} />
      </head>
      {/*
        `app-brand` on <body> is what gives every screen the product palette and
        font (tokens.css), including dialogs and toasts portalled here. The
        legacy `?ui=old` screens keep the old :root tokens (and their dark
        mode), so the class comes off before first paint when that is chosen.
      */}
      <body suppressHydrationWarning className="app-brand min-h-full bg-background text-foreground font-sans">
        <script dangerouslySetInnerHTML={{ __html: legacyBodyScript }} />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-tag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_TAG_ID}');
          `}
        </Script>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
