/**
 * Base URL for the goscribe/server API. Required — the app always runs
 * against the live backend.
 */
export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

if (typeof window !== "undefined" && !apiUrl) {
  throw new Error(
    "NEXT_PUBLIC_API_URL is not set — point it at the goscribe/server API.",
  );
}
