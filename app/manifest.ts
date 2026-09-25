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
    // Long-press the app icon (Android) for these.
    shortcuts: [
      { name: "Voice command", short_name: "Voice", url: "/?voice=1", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "New task", short_name: "Task", url: "/?new=task", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "New note", short_name: "Note", url: "/?new=note", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
    // Shows sonderthreads in Android's share sheet; shared text lands in the command bar.
    share_target: {
      action: "/share",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
