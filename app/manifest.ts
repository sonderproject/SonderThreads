import type { MetadataRoute } from "next";

/** Lets "Add to Home Screen" install the app with its own icon and open it full-screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "sonderthreads",
    short_name: "sonderthreads",
    description: "Capture information quickly. Organize it automatically. See what matters.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
