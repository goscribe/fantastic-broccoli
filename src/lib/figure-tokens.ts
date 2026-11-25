/**
 * Figure style system: the palette study-note figures are drawn in, as
 * `--fig-*` custom properties. Mirror of FIGURE_TOKENS in the server's
 * src/lib/notes/figure-style.ts; change both together. Figures carry the
 * light values as fallbacks (`var(--fig-blue-fill,#D9E8FF)`), so only the dark
 * theme has to set the properties.
 */
export const FIGURE_LIGHT_TOKENS: Record<string, string> = {
  ink: "#131118",
  muted: "#605C6D",
  line: "#45415A",
  guide: "#B4AFC6",
  paper: "#FFFFFF",
  "blue-fill": "#D9E8FF",
  blue: "#2F6FDE",
  "red-fill": "#FFDDD8",
  red: "#D4483B",
  "green-fill": "#D5F2E0",
  green: "#178A55",
  "amber-fill": "#FFEBC2",
  amber: "#B26E00",
  "violet-fill": "#E7E1FB",
  violet: "#6952E0",
  "neutral-fill": "#EEECF4",
  neutral: "#6B6780",
};

export const FIGURE_DARK_TOKENS: Record<string, string> = {
  ink: "#F2F1F5",
  muted: "#AAA6B8",
  line: "#C9C5D6",
  guide: "#55516A",
  paper: "#18171E",
  "blue-fill": "#1C3256",
  blue: "#74A7F7",
  "red-fill": "#4A2420",
  red: "#F27F73",
  "green-fill": "#173D2B",
  green: "#4FC88E",
  "amber-fill": "#44330F",
  amber: "#E3A93C",
  "violet-fill": "#2C2552",
  violet: "#A394EC",
  "neutral-fill": "#2A2836",
  neutral: "#9A95A8",
};

/** `var(--fig-<name>, <light value>)` for a token. */
export const figVar = (name: string) => `var(--fig-${name},${FIGURE_LIGHT_TOKENS[name] ?? "currentColor"})`;

/** The dark theme's `--fig-*` declarations. */
export const figureDarkVars = () =>
  Object.entries(FIGURE_DARK_TOKENS)
    .map(([name, value]) => `--fig-${name}:${value};`)
    .join("");
