import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Crawlers get <title>, description, canonical and robots in the initial
  // <head> instead of streamed into <body>: Next's default HTML-limited bot
  // list, plus Googlebot (the public /notes pages depend on canonical + noindex).
  htmlLimitedBots:
    /Googlebot|[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight/i,
  async redirects() {
    return [
      // A course is a subject: its own page duplicated the subject page's topic list.
      { source: "/courses/:workspaceId", destination: "/workspace/:workspaceId", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // The service worker must never be served stale (push / notification
        // click fixes have to reach installed apps on the next visit).
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
