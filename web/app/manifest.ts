import type { MetadataRoute } from "next";

// Next's file-convention route: served at /manifest.webmanifest and linked
// in <head> automatically. Covers Android "Add to Home Screen" / install
// prompts (iOS Safari ignores this file — see the apple-icon.png +
// appleWebApp metadata in layout.tsx for the iOS equivalent).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WILD Gaming",
    short_name: "WILD",
    description: "WILD Gaming Valorant Premier tracker",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0f13",
    theme_color: "#0c0f13",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
