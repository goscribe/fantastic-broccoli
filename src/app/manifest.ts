import type { MetadataRoute } from "next";

/**
 * Makes Scribe installable (Android "Install app", iOS "Add to Home Screen").
 * On iOS, web push only works once the app is opened from the home screen.
 * Served at /manifest.webmanifest; Next adds the <link> itself.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Scribe — AI study app",
    short_name: "Scribe",
    description: "Turn your notes into 5-minute study sessions, flashcards and practice questions.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#6952e0",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/cat-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/cat-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/cat-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/cat-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
