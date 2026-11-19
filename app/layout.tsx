import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Suspense } from "react";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";
import { Analytics } from "@vercel/analytics/next";

// Sonder Studio type: Outfit for headings, Inter for everything else.
// Self-hosted variable fonts (@fontsource-variable, OFL) instead of
// next/font/google, so builds never depend on Google Fonts answering
// (Vercel builds started failing on it Nov 19, 2026).
const sans = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-sans",
  display: "swap",
});

const display = localFont({
  src: "../node_modules/@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Surfdesk",
  description: SITE_DESCRIPTION,
  applicationName: "Surfdesk",
  appleWebApp: { capable: true, title: "Surfdesk", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the app draw under the notch/home bar; safe-area padding keeps content clear of them.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a09" },
  ],
};

const THEME_INIT_SCRIPT = `
try {
  var z = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (z && document.cookie.indexOf('tz=' + encodeURIComponent(z)) === -1) {
    document.cookie = 'tz=' + encodeURIComponent(z) + '; path=/; max-age=31536000; samesite=lax';
  }
} catch (e) {}
try {
  var t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') {
    document.documentElement.setAttribute('data-theme', t);
  }
} catch (e) {}
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        {/* useSearchParams needs a Suspense boundary so static pages still render. */}
        <Suspense fallback={null}>
          <LoadingIndicator />
        </Suspense>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
