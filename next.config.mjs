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
  },
  // pdfkit loads its font metrics from its own package folder at runtime.
  serverExternalPackages: ["pdfkit"],
  // ...and loads them with a runtime require()/fs read the bundler can't
  // see, so list them explicitly or PDF export crashes on Vercel with the
  // font files missing.
  outputFileTracingIncludes: {
    "/api/**/export": [
      "./node_modules/pdfkit/js/standard-fonts/**",
      "./node_modules/pdfkit/js/data/**",
    ],
  },
};

export default nextConfig;
