/**
 * Subject families: the app's colour carriers. Every subject and catalog
 * course maps to one family; a family is a hue pair and one illustration.
 * Chrome stays neutral, so these tiles are where the colour lives.
 *
 * `a` is the deep end of the hue (white text sits on it, ≥ 4.5:1); `b` is the
 * bright end, used only behind the illustration. Keep this file and
 * public/design/subjects/ identical on every branch (app + public note pages).
 *
 * The server stores which family a subject wears (`Workspace.subjectFamily`,
 * picked once by a model or by the learner) and validates against the same
 * 15 keys: goscribe/server `src/lib/subject-family.ts` (`SUBJECT_FAMILIES`).
 * Both repos carry a unit test pinning the list; change them together.
 */
export const SUBJECT_FAMILIES = [
  "maths", "physics", "chemistry", "biology", "science", "earth",
  "computing", "economics", "business", "history", "society",
  "psychology", "english", "languages", "general",
] as const;

export type SubjectFamily = (typeof SUBJECT_FAMILIES)[number];

export function isSubjectFamily(value: unknown): value is SubjectFamily {
  return typeof value === "string" && (SUBJECT_FAMILIES as readonly string[]).includes(value);
}

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

/**
 * Topic words and course codes, for subjects named after a file or a unit
 * rather than a course ("B4 Thermodynamics Guide +3", "Cl1 AAHL T3 C1
 * Differentiation"). Tried only after RULES finds no subject name, so
 * "Biology: cell differentiation" stays biology. Keep to words that mean one
 * subject at school; a wrong colour is worse than the neutral one.
 */
const TOPIC_RULES: [SubjectFamily, RegExp][] = [
  ["computing", /\b(data transmission|digital infrastructures?|networks?|networking|algorithms?|databases?|cyber\w*|python|javascript|html|sql|binary|boolean|operating systems?)\b/i],
  ["maths", /\b(aa ?[hs]l|ai ?[hs]l|calc|pre-?calc\w*|(anti[ -]?)?differentiation|antiderivatives?|derivatives?|integrals?|trig\w*|vectors?|matri(x|ces)|logarithms?|quadratics?|polynomials?|probability|sequences and series|complex numbers)\b/i],
  ["physics", /\b(thermodynamics?|kinematics|electric(al)? (fields?|circuits?)|magneti\w+|electricity|circuits?|optics|momentum|relativity|nuclear|radioactiv\w+|waves)\b/i],
  ["chemistry", /\b(organic|stoichiometry|kinetics|equilibri(um|a)|titrations?|redox|periodic(ity| table)|acids? and bases?|bonding|moles?)\b/i],
  ["biology", /\b(photosynthesis|respiration|osmosis|enzymes?|dna|mitosis|meiosis|cells?|evolution|ecosystems?|homeostasis)\b/i],
  ["economics", /\b(macro|micro|fiscal|monetary|inflation|elasticity|gdp|market (structures?|failure)|supply and demand)\b/i],
  ["history", /\b(cold war|world war|ww ?(1|2|i|ii)|revolutions?|empires?|weimar|tudors?)\b/i],
  ["earth", /\b(glaciation|glaciers?|tectonics?|rivers|coasts|urbani[sz]ation|ecosystems and biomes|hazards)\b/i],
  ["psychology", /\b(cognitive|behaviou?ris\w+|sociocultural approach|abnormal)\b/i],
  ["english", /\b(gatsby|shakespeare|macbeth|hamlet|othello|orwell|novels?|poems?|essays?|paper 2 comparative)\b/i],
];

/** The family for a subject title, a catalog course title or a catalog `subject`. */
export function familyFor(name: string | null | undefined): SubjectFamily {
  const t = (name ?? "").trim();
  if (!t) return "general";
  for (const [key, re] of RULES) if (re.test(t)) return key;
  for (const [key, re] of TOPIC_RULES) if (re.test(t)) return key;
  return "general";
}

/**
 * The family a subject wears: the one the server stored for it when there is
 * one (so it never changes on its own), else today's rules on its name.
 * Every tile, band and row goes through this, so a subject looks the same
 * everywhere. A server that does not return the field yet (or returns a key
 * this build does not know) simply gets the rules.
 */
export function resolveSubjectFamily(stored: unknown, name?: string | null): SubjectFamily {
  return isSubjectFamily(stored) ? stored : familyFor(name);
}

/** Flat vector art on a 360×360 viewBox, transparent, drawn in tints of the family's own hue. */
export const familyArtSrc = (family: SubjectFamily) => `/design/subjects/${family}.svg`;
export const FAMILY_ART_SIZE = 360;

/**
 * Hues for subjects that match no family ("Week 7 lecture slides"): a real
 * account can have dozens, and one purple for all of them is a wall. Each
 * borrows a family's colour pair (so white text is already AA on it) and
 * keeps the neutral books-and-cap art.
 */
export const GENERAL_HUES: SubjectFamily[] = ["general", "maths", "chemistry", "economics", "psychology", "science", "earth", "physics", "business", "languages"];

/** FNV-1a: small, stable across sessions and browsers. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The family whose colours a tile wears. A matched family wears its own; an
 * unmatched one ("general") picks one from GENERAL_HUES by `seed` (the
 * workspace's id, else its name), so it is the same every time and the same
 * on the subject's own page. No seed: the default purple.
 */
export function hueFamilyFor(family: SubjectFamily, seed?: string | null): SubjectFamily {
  const key = (seed ?? "").trim();
  if (family !== "general" || !key) return family;
  return GENERAL_HUES[hash(key) % GENERAL_HUES.length];
}

/** Inline custom properties for a `.subject-tile` / `.subject-band` element. `seed` varies the hue of an unmatched subject. */
export function familyVars(family: SubjectFamily, seed?: string | null): Record<string, string> {
  const { a, b } = FAMILY[hueFamilyFor(family, seed)];
  return { "--tile-a": a, "--tile-b": b };
}
