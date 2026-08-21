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

function parseHex(color: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Nearest accent to an arbitrary hex color (e.g. a saved folder color). */
export function accentNameForColor(
  color: string | null | undefined,
  fallbackId: string,
): AccentName {
  const rgb = color ? parseHex(color) : null;
  if (!rgb) return accentNameForId(fallbackId);
  let best: AccentName = ACCENT_NAMES[0];
  let bestDist = Infinity;
  ACCENT_PALETTE.forEach((hex, i) => {
    const target = parseHex(hex);
    if (!target) return;
    const [r, g, b] = target;
    const d = (r - rgb[0]) ** 2 + (g - rgb[1]) ** 2 + (b - rgb[2]) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = ACCENT_NAMES[i];
    }
  });
  return best;
}
