import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Crawlers get <title>, description, canonical and robots in the initial
  // <head> instead of streamed into <body>: Next's default HTML-limited bot
  // list, plus Googlebot (the public /notes pages depend on canonical + noindex).
  htmlLimitedBots:
    /Googlebot|[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight/i,
  // Flashcard decks are read from disk at request time (src/lib/notes-public/flashcards-server.ts).
  outputFileTracingIncludes: {
    "/notes/**": ["./src/data/flashcards/**/*.json"],
    "/api/notes-flashcards/**": ["./src/data/flashcards/**/*.json"],
  },
  async redirects() {
    return [
      // A course is a subject: its own page duplicated the subject page's topic list.
      { source: "/courses/:workspaceId", destination: "/workspace/:workspaceId", permanent: true },
      // Topic and unit pages share their course's card now (built once, at build time;
      // src/app/notes/[courseId]/opengraph-image.tsx): old per-topic image URLs that
      // crawlers and link previews still hold go to it without a render.
      { source: "/notes/:courseId/:topicId/opengraph-image", destination: "/notes/:courseId/opengraph-image", permanent: true },
      { source: "/notes/:courseId/:topicId/twitter-image", destination: "/notes/:courseId/twitter-image", permanent: true },
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
