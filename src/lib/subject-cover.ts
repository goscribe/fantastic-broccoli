/** Flat cover art per subject family, matched from the subject's title. */
export type CoverKey =
  | "math" | "physics" | "chemistry" | "biology" | "computing" | "economics"
  | "history" | "geography" | "literature" | "languages" | "philosophy"
  | "psychology" | "art" | "music" | "environment" | "general";

const RULES: [CoverKey, RegExp][] = [
  ["math", /\b(math|maths|calculus|algebra|geometry|statistics|analysis and approaches|applications and interpretation)/i],
  ["physics", /\b(physics|mechanics|electromagnetism|quantum)/i],
  ["chemistry", /\b(chem|chemistry|organic|biochem)/i],
  ["biology", /\b(bio|biology|anatomy|genetics|ecology)/i],
  ["computing", /\b(computer|computing|programming|coding|software|\bcs\b|informatics|data science|machine learning|\bml\b|\bai\b)/i],
  ["economics", /\b(econ|economics|business|finance|accounting|management|marketing)/i],
  ["history", /\b(history|ancient|medieval|civilisation|civilization)/i],
  ["geography", /\b(geography|geo\b|earth science|geology)/i],
  ["environment", /\b(environment|environmental|ess\b|climate|sustainab)/i],
  ["languages", /\benglish b\b/i],
  ["literature", /\b(english|literature|writing|poetry|lang & lit|lang and lit|novel)/i],
  ["languages", /\b(spanish|french|german|italian|chinese|mandarin|japanese|korean|latin|arabic|language|\blang\b|\bab initio\b|english b|español|français)/i],
  ["philosophy", /\b(philosophy|tok\b|theory of knowledge|ethics|logic|religion)/i],
  ["psychology", /\b(psych|psychology|sociology|anthropology)/i],
  ["art", /\b(art|design|visual|drawing|photography|film|theatre|theater|drama)/i],
  ["music", /\b(music|band|orchestra|choir|piano|guitar)/i],
];

/** Soft tint pair (from → to) behind each cover; different per family on purpose. */
export const COVER_TINT: Record<CoverKey, [string, string]> = {
  math: ["#ede9fe", "#ddd6fe"],
  physics: ["#e0f2fe", "#bae6fd"],
  chemistry: ["#d1fae5", "#a7f3d0"],
  biology: ["#dcfce7", "#bbf7d0"],
  computing: ["#e0e7ff", "#c7d2fe"],
  economics: ["#fef3c7", "#fde68a"],
  history: ["#fef3c7", "#fed7aa"],
  geography: ["#ccfbf1", "#99f6e4"],
  literature: ["#fce7f3", "#fbcfe8"],
  languages: ["#ffe4e6", "#fecdd3"],
  philosophy: ["#f3e8ff", "#e9d5ff"],
  psychology: ["#fae8ff", "#f5d0fe"],
  art: ["#fee2e2", "#fecaca"],
  music: ["#e0e7ff", "#ddd6fe"],
  environment: ["#ecfccb", "#d9f99d"],
  general: ["#f1eefc", "#e4defa"],
};

export function coverKeyForTitle(title: string): CoverKey {
  const t = title.trim();
  for (const [key, re] of RULES) if (re.test(t)) return key;
  return "general";
}

export const coverArtSrc = (key: CoverKey) => `/design/covers/${key}.png`;
