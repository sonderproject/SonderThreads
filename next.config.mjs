/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Reuse a page the client already loaded for 30s when you navigate back
    // to it, instead of refetching. Saving anything still refreshes at once
    // (server actions call revalidatePath / router.refresh).
    staleTimes: { dynamic: 30 },
    // Settings → Data → Import backup sends the whole backup file to a server action.
    serverActions: { bodySizeLimit: "4mb" },
    // Put the stylesheet inside the page instead of a separate file, so the
    // first paint doesn't wait on an extra request (Lighthouse "render-blocking").
    inlineCss: true,
  },
  // thesurfdesk.app is the only address the app runs on (Nov 16, 2026). The old domains (kept,
  // so nobody else can take them), www and the vercel.app name send every request to the same
  // path on thesurfdesk.app (308 keeps the method, so old form posts and webhooks still land).
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "(?<old>(?:www\\.)?strynd\\.com|(?:www\\.)?sonderthreads\\.com|www\\.thesurfdesk\\.app|sonder-threads\\.vercel\\.app)" }],
        destination: "https://thesurfdesk.app/:path*",
        permanent: true,
      },
      // The audience landing pages replaced these two search pages (Nov 23, 2026); search ranking follows the redirect.
      { source: "/for/nonprofits", destination: "/nonprofits", permanent: true },
      { source: "/for/small-business", destination: "/business", permanent: true },
    ];
  },
  // Browser security headers on every response.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No other site may show this app inside a frame (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Microphone for voice notes on this site only; no camera or location access.
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
  // pdfkit loads its font metrics from its own package folder at runtime.
  serverExternalPackages: ["pdfkit"],
  // ...and loads them with a runtime require()/fs read the bundler can't
  // see, so list them explicitly or PDF export crashes on Vercel with the
  // font files missing.
  outputFileTracingIncludes: {
    "/api/**/export": [
      // Fonts and the logo for the Impact report PDF (lib/export/impact-pdf.ts).
      "./assets/**",
      "./node_modules/pdfkit/js/standard-fonts/**",
      "./node_modules/pdfkit/js/data/**",
    ],
  },
};

export default nextConfig;
