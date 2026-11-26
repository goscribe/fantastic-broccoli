/** Share-card constants, apart from og.tsx so pages can use them without importing next/og. */
export const OG_SIZE = { width: 1200, height: 630 };

/**
 * The cards are rendered at build time only (next/og's satori + resvg wasm
 * takes ~200-450 MB of native memory that the process never gives back, more
 * than the 512 MB server has to spare). Once built they never change until the
 * next deploy, so browsers keep them a day and the CDN a week.
 */
export const OG_CACHE_CONTROL = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400";
