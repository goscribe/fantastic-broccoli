export const ACCENT_PALETTE = [
  "#6952e0", // purple
  "#0ea5e9", // sky
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
] as const;

export function accentForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENT_PALETTE[h % ACCENT_PALETTE.length];
}
