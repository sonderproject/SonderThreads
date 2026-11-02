/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfkit loads its font metrics from its own package folder at runtime.
  serverExternalPackages: ["pdfkit"],
  // ...and reads them with fs, which the bundler can't see, so without this
  // the .afm font files are missing on Vercel and every PDF export crashes.
  outputFileTracingIncludes: {
    "/api/**/export": ["./node_modules/pdfkit/js/data/**"],
  },
};

export default nextConfig;
