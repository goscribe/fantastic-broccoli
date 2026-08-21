export const ACCENT_PALETTE = [
  "#6952e0", // purple
  "#0ea5e9", // sky
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
] as const;

export const ACCENT_NAMES = [
  "purple",
  "sky",
  "pink",
  "amber",
  "emerald",
] as const;

export type AccentName = (typeof ACCENT_NAMES)[number];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function accentForId(id: string): string {
  return ACCENT_PALETTE[hashId(id) % ACCENT_PALETTE.length];
}

export function accentNameForId(id: string): AccentName {
  return ACCENT_NAMES[hashId(id) % ACCENT_NAMES.length];
}
