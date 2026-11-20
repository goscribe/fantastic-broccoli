/**
 * Subject families: the app's colour carriers. Every subject and catalog
 * course maps to one family; a family is a hue pair and one illustration.
 * Chrome stays neutral, so these tiles are where the colour lives.
 *
 * `a` is the deep end of the hue (white text sits on it, ≥ 4.5:1); `b` is the
 * bright end, used only behind the illustration. Keep this file and
 * public/design/subjects/ identical on every branch (app + public note pages).
 */
export type SubjectFamily =
  | "maths" | "physics" | "chemistry" | "biology" | "science" | "earth"
  | "computing" | "economics" | "business" | "history" | "society"
  | "psychology" | "english" | "languages" | "general";

export interface FamilyLook {
  /** Deep end: the tile's base colour, and the pill button's text colour. */
  a: string;
  /** Bright end: a glow behind the illustration only. */
  b: string;
  /** What the illustration shows (for the docs table; the art itself is decorative, alt=""). */
  art: string;
}

export const FAMILY: Record<SubjectFamily, FamilyLook> = {
  maths: { a: "#1d4ed8", b: "#3b82f6", art: "set square and operator cube" },
  physics: { a: "#4338ca", b: "#6366f1", art: "atom" },
  chemistry: { a: "#0f766e", b: "#14b8a6", art: "bubbling flask" },
  biology: { a: "#4d7c0f", b: "#84cc16", art: "DNA helix with a leaf" },
  science: { a: "#0369a1", b: "#0ea5e9", art: "microscope" },
  earth: { a: "#047857", b: "#10b981", art: "globe with a map pin" },
  computing: { a: "#6d28d9", b: "#8b5cf6", art: "laptop with code brackets" },
  economics: { a: "#b45309", b: "#f59e0b", art: "coin stack with a rising arrow" },
  business: { a: "#c2410c", b: "#f97316", art: "briefcase with a bar chart" },
  history: { a: "#b91c1c", b: "#ef4444", art: "classical temple" },
  society: { a: "#a21caf", b: "#d946ef", art: "balance scale" },
  psychology: { a: "#be185d", b: "#ec4899", art: "brain with a lightbulb" },
  english: { a: "#be123c", b: "#f43f5e", art: "open book and quill" },
  languages: { a: "#0e7490", b: "#22d3ee", art: "speech bubbles" },
  general: { a: "#5a43d1", b: "#8b7cf0", art: "books and graduation cap" },
};

/** First match wins, so the narrow names sit above the broad ones ("computer science" before "science"). */
const RULES: [SubjectFamily, RegExp][] = [
  ["computing", /\b(computer|computing|programming|coding|software|informatics|data science|machine learning)\b/i],
  ["earth", /\b(geograph\w*|environment\w*|ess|earth science|geology|climate|sustainab\w*)\b/i],
  ["maths", /\b(math\w*|calculus|algebra|geometry|statistics|stats|analysis and approaches|applications and interpretation)\b/i],
  ["physics", /\b(physics|mechanics|electromagnetism|quantum)\b/i],
  ["chemistry", /\b(chem\w*|biochem\w*)\b/i],
  ["biology", /\b(bio\w*|anatomy|genetics|ecology)\b/i],
  ["science", /\bscience\b/i],
  ["psychology", /\bpsych\w*\b/i],
  ["economics", /\b(\w*econ\w*|finance|accounting)\b/i],
  ["business", /\b(business|management|marketing|enterprise)\b/i],
  ["society", /\b(government|politic\w*|sociology|anthropology|philosophy|tok|theory of knowledge|ethics|religio\w*|law|global politics)\b/i],
  ["history", /\b(histor\w*|ancient|medieval|civili[sz]ation\w*|classics)\b/i],
  ["languages", /\benglish b\b/i],
  ["english", /\b(english|literature|writing|poetry|lang & lit|lang and lit)\b/i],
  ["languages", /\b(spanish|french|german|italian|chinese|mandarin|japanese|korean|latin|arabic|languages?|ab initio|español|français)\b/i],
];

/** The family for a subject title, a catalog course title or a catalog `subject`. */
export function familyFor(name: string | null | undefined): SubjectFamily {
  const t = (name ?? "").trim();
  if (t) for (const [key, re] of RULES) if (re.test(t)) return key;
  return "general";
}

/** 360×360 WebP with alpha: 2x for a card-height illustration. */
export const familyArtSrc = (family: SubjectFamily) => `/design/subjects/${family}.webp`;
export const FAMILY_ART_SIZE = 360;

/** Inline custom properties for a `.subject-tile` / `.subject-band` element. */
export function familyVars(family: SubjectFamily): Record<string, string> {
  const { a, b } = FAMILY[family];
  return { "--tile-a": a, "--tile-b": b };
}
