import type { MetadataRoute } from "next";
import { DEFAULT_DESCRIPTION, SHORT_NAME, SITE_NAME } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SHORT_NAME,
    description: DEFAULT_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0f14",
    theme_color: "#FF6B4A",
    icons: [
      {
        src: "/brand/voixly-logomark.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
