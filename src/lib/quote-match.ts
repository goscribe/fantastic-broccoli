/**
 * Finding a quoted passage in a text by its words: lenient on punctuation,
 * case and line breaks, so a quote still matches after the text was pasted,
 * re-wrapped or re-punctuated, and stops matching when its words change.
 */

const ELLIPSIS = /\s*(?:\[\s*(?:\.\s*){3}\]|\[…\]|…|\.\s*\.\s*\.)\s*/g;

/** A character kept when matching: letters and digits only, lower-cased; everything else is a word break. */
function normChar(ch: string): string {
  const c = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return /^[a-z0-9]+$/.test(c) ? c : " ";
}

/** The text with punctuation, case and spacing flattened, and for each kept character where it came from. */
function normalizeWithMap(text: string): { norm: string; map: number[] } {
  let norm = "";
  const map: number[] = [];
  let space = true;
  for (let i = 0; i < text.length; i++) {
    const c = normChar(text[i]);
    if (c === " ") {
      if (!space) {
        norm += " ";
        map.push(i);
        space = true;
      }
      continue;
    }
    for (const ch of c) {
      norm += ch;
      map.push(i);
    }
    space = false;
  }
  return { norm, map };
}

export interface TextRange {
  start: number;
  end: number;
}

/**
 * Where a quote sits in `text` (character offsets), lenient on punctuation,
 * case and line breaks. A quote with an ellipsis is found part by part, in
 * order. Empty when any part is missing: the passage was edited.
 */
export function findQuote(text: string, quote: string): TextRange[] {
  const parts = quote
    .replace(/^[\s"“”'‘’]+|[\s"“”'‘’]+$/g, "")
    .split(ELLIPSIS)
    .map((p) => normalizeWithMap(p).norm.trim())
    .filter(Boolean);
  if (parts.length === 0) return [];
  const { norm, map } = normalizeWithMap(text);
  const hay = ` ${norm.trimEnd()} `;
  const ranges: TextRange[] = [];
  let from = 0;
  for (const part of parts) {
    const at = hay.indexOf(` ${part} `, from);
    if (at < 0) return [];
    // `hay` is `norm` shifted right by one (the leading space).
    const first = at; // index in norm of the part's first character
    const last = at + part.length - 1;
    const start = map[first];
    const end = (map[last] ?? text.length - 1) + 1;
    ranges.push({ start, end });
    from = at + part.length;
  }
  return ranges;
}

/** True when the quoted passage is no longer in the text: the student edited it since the review. */
export function quoteChanged(text: string, quote: string): boolean {
  return findQuote(text, quote).length === 0;
}

