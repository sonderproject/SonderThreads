import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

// Sonder Studio type: Outfit for headings, Inter for everything else.
const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const display = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Strynd",
  description: SITE_DESCRIPTION,
  applicationName: "Strynd",
  appleWebApp: { capable: true, title: "Strynd", statusBarStyle: "default" },
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
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
