/**
 * Base URL for the goscribe/server API. When unset the app runs in demo mode
 * against the local mock data, so the prototype works without a backend.
 */
export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

export const isLiveApi = apiUrl.length > 0;
