/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfkit loads its font metrics from its own package folder at runtime.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
