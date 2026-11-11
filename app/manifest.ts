import type { MetadataRoute } from "next";

/** Lets "Add to Home Screen" install the app with its own icon and open it full-screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Strynd",
    short_name: "Strynd",
    description: "Clients, tasks, notes and check-ins in one calm place. By Sonder Project.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    // Splash screen behind the icon: obsidian, matching the icon.
    background_color: "#0a0a09",
    theme_color: "#f6f4ef",
    // Long-press the app icon (Android) for these.
    shortcuts: [
      { name: "Voice command", short_name: "Voice", url: "/?voice=1", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "New task", short_name: "Task", url: "/?new=task", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
      { name: "New note", short_name: "Note", url: "/?new=note", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
    ],
    // Shows Strynd in Android's share sheet; shared text lands in the command bar.
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
