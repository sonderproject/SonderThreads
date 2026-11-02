/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
