// Kept in step with the server"s voice-literal-guard.ts (goscribe/server): the app runs the
// same check on every reply, so an older server can never put a result the learner did not say into the answer box.

/**
 * The voice scribe is a transcriber, not a solver. Whatever the model writes
 * for a spoken phrase, this guard keeps only what the learner actually said:
 *
 * - every number in the written line must have been spoken ("four over ten"
 *   counts as 4 and 10; "half" as 1 and 2; "squared" as 2);
 * - an "= result" the learner did not say is cut, and so is everything after
 *   it ("4/10 × 4/10 = 4/25" when they said "4/10 * 4/10" → "4/10 × 4/10");
 * - a label they did not say ("P(two green) =", "P(M) =") is dropped;
 * - a line built from earlier working ("2/15 + 6/10 × 5/9") is refused.
 *
 * When the model"s line cannot be trimmed back to what was said, the line is
 * rebuilt from the transcript alone (`literalMath`), or written as spoken.
 * Deterministic and cheap: it runs on every phrase, partial ones included.
 */

const UNITS: Record<string, number> = {
  zero: 0, nought: 0, nil: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, million: 1_000_000 };
/** Words that say a number without being one: "a half" is 1 and 2, "squared" is a power of 2. */
const IMPLIED: Record<string, number[]> = {
  half: [1, 2], halves: [2], third: [1, 3], thirds: [3], quarter: [1, 4], quarters: [4], fourth: [4], fourths: [4],
  fifth: [5], fifths: [5], sixth: [6], sixths: [6], seventh: [7], sevenths: [7], eighth: [8], eighths: [8],
  ninth: [9], ninths: [9], tenth: [10], tenths: [10], hundredth: [100], hundredths: [100],
  squared: [2], square: [2], cubed: [3], cube: [3], double: [2], twice: [2], triple: [3], percent: [100],
};
/** Spoken words that set something equal to a value. */
const EQUALS_WORDS = new Set(["equals", "equal", "is", "are", "makes", "gives", "get", "gets", "got", "was", "be"]);
/** Letters as speech recognition writes them. */
const LETTER_NAMES: Record<string, string> = {
  ex: "x", why: "y", zed: "z", zee: "z", bee: "b", see: "c", sea: "c", dee: "d", ee: "e", eff: "f", gee: "g",
  aitch: "h", jay: "j", kay: "k", el: "l", em: "m", en: "n", oh: "o", pee: "p", queue: "q", cue: "q", ar: "r",
  es: "s", tee: "t", you: "u", vee: "v",
};
/** Unit symbols and the spoken words that allow them. */
const UNIT_WORDS: Record<string, RegExp> = {
  cm: /centimet/, mm: /millimet/, km: /kilomet/, m: /\bmet(re|er)s?\b|\bm\b/, kg: /kilo/, g: /\bgrams?\b/,
  s: /\bseconds?\b|\bs\b/, ms: /millisecond|metres? per second|meters? per second/, n: /newton/, j: /joule/,
  w: /watt/, v: /volt/, a: /amp/, mol: /\bmol/, k: /kelvin/, l: /lit(re|er)/, ml: /millilit/, h: /hours?/,
  min: /minutes?/, deg: /degree/, hz: /hertz/, pa: /pascal/,
};

const norm = (n: number) => String(Number(n.toFixed(10)));

function words(transcript: string): string[] {
  return transcript
    .toLowerCase()
    .replace(/(\d),(\d{3})/g, "$1$2")
    // "3x" is 3 and x.
    .replace(/(\d)(\p{L})/gu, "$1 $2")
    .split(/[^\p{L}\p{N}.]+/u)
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
}

/** Every number the learner said, as digits ("four over ten" → 4, 10; "twenty five" → 25, 20, 5). */
export function spokenNumbers(transcript: string): Set<string> {
  const out = new Set<string>();
  const ws = words(transcript);
  let run: number | null = null;
  let total = 0;
  const flush = () => {
    if (run !== null || total) out.add(norm(total + (run ?? 0)));
    run = null;
    total = 0;
  };
  for (let i = 0; i < ws.length; i++) {
    const w = ws[i];
    if (/^\d+(\.\d+)?$/.test(w) || /^\.\d+$/.test(w)) {
      flush();
      out.add(norm(Number(w)));
      // "3 hundred"
      run = Number(w);
      continue;
    }
    const m = /^(\d+(?:\.\d+)?)(st|nd|rd|th|s)?$/.exec(w);
    if (m) {
      flush();
      out.add(norm(Number(m[1])));
      continue;
    }
    if (w in UNITS || w in TENS) {
      const v = UNITS[w] ?? TENS[w];
      out.add(norm(v));
      // "twenty five" and "a hundred and five" are one number; "ten twenty" is two.
      const prev: number | null = run;
      const joins: boolean = prev !== null && ((prev % 100 >= 20 && prev % 10 === 0 && v < 10) || (prev >= 100 && prev % 100 === 0 && v < 100));
      if (!joins) flush();
      run = (joins && prev !== null ? prev : 0) + v;
      continue;
    }
    if (w in SCALES && run === null && (ws[i - 1] === "a" || ws[i - 1] === "an")) {
      // "a hundred"
      out.add(norm(SCALES[w]));
      run = SCALES[w];
      continue;
    }
    if (w in SCALES && run !== null) {
      out.add(norm(SCALES[w]));
      if (SCALES[w] >= 1000) {
        total += run * SCALES[w];
        run = null;
      } else run *= SCALES[w];
      continue;
    }
    if (w === "point" && (run !== null || total) && i + 1 < ws.length) {
      // "two point five" → 2.5; the digits after "point" are said one by one.
      let digits = "";
      while (i + 1 < ws.length && (ws[i + 1] in UNITS && UNITS[ws[i + 1]] < 10 || /^\d$/.test(ws[i + 1]))) {
        i++;
        digits += /^\d$/.test(ws[i]) ? ws[i] : String(UNITS[ws[i]]);
      }
      if (digits) {
        const whole = total + (run ?? 0);
        out.add(norm(whole));
        out.add(norm(Number(`${whole}.${digits}`)));
        for (const d of digits) out.add(d);
        run = null;
        total = 0;
        continue;
      }
    }
    if (w === "and" && run !== null) continue; // "one hundred and five"
    flush();
    if (w in IMPLIED) IMPLIED[w].forEach((v) => out.add(norm(v)));
    if (w === "a" || w === "an") {
      const next = ws[i + 1];
      if (next && next in IMPLIED) out.add("1");
    }
  }
  flush();
  return out;
}

/** How many times the learner set something equal to something. */
function equalsBudget(transcript: string): number {
  const ws = words(transcript);
  return ws.filter((w) => EQUALS_WORDS.has(w)).length + (transcript.match(/=/g)?.length ?? 0);
}

/** The numbers a written line holds (LaTeX included: \frac{4}{10} holds 4 and 10). */
function writtenNumbers(text: string): string[] {
  return (text.replace(/\\[a-zA-Z]+/g, " ").match(/\d+(?:\.\d+)?|\.\d+/g) ?? []).map((n) => norm(Number(n)));
}

/** The words and letters a written line holds, LaTeX commands left out. */
function writtenWords(text: string): string[] {
  return text.replace(/\\[a-zA-Z]+/g, " ").match(/[A-Za-z]+/g) ?? [];
}

function wordAllowed(word: string, transcript: string, said: Set<string>): boolean {
  const w = word.toLowerCase();
  if (said.has(w)) return true;
  if (w.length === 1) {
    if ([...said].some((s) => LETTER_NAMES[s] === w)) return true;
    // "P(...)" when they talk about a probability.
    if (w === "p" && (said.has("probability") || said.has("chance"))) return true;
  }
  const unit = UNIT_WORDS[w];
  if (unit && unit.test(transcript.toLowerCase())) return true;
  // Plurals and the like: "fours" said, "four" written.
  return [...said].some((s) => s.length > 3 && (s.startsWith(w) || w.startsWith(s)) && Math.abs(s.length - w.length) <= 2);
}

function numbersOk(seg: string, spoken: Set<string>): boolean {
  return writtenNumbers(seg).every((n) => spoken.has(n));
}

function wordsOk(seg: string, transcript: string, said: Set<string>): boolean {
  return writtenWords(seg).every((w) => wordAllowed(w, transcript, said));
}

/** Split maths on its top-level "=" (and ≈), outside braces. */
function splitEquals(math: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < math.length; i++) {
    const c = math[i];
    if (c === "{") depth++;
    if (c === "}") depth--;
    if (depth === 0 && c === "=") {
      out.push(cur);
      cur = "";
      continue;
    }
    if (depth === 0 && math.startsWith("\\approx", i)) {
      out.push(cur);
      cur = "";
      i += "\\approx".length - 1;
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

interface Budget {
  equals: number;
}

/** One piece of maths, trimmed back to what was said, or null when it cannot be. */
function guardMath(math: string, transcript: string, spoken: Set<string>, said: Set<string>, budget: Budget): string | null {
  const segs = splitEquals(math);
  const kept: string[] = [];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const ok = numbersOk(seg, spoken) && wordsOk(seg, transcript, said);
    if (!ok) {
      // An unspoken label in front ("P(M) =") is dropped; the maths after it is judged on its own.
      if (i === 0 && segs.length > 1 && !/\d/.test(seg)) continue;
      break;
    }
    // A further "= …" needs a spoken "equals"/"is" for it.
    if (kept.length > 0) {
      if (budget.equals <= 0) break;
      budget.equals--;
    }
    kept.push(seg.trim());
  }
  if (!kept.length) return null;
  // Only a label left ("P(M)" with everything after it cut): nothing they said survives.
  if (kept.length === 1 && segs.length > 1 && !/\d/.test(kept[0]) && /\d/.test(math)) return null;
  return kept.join(" = ");
}

const NUMBER_WORD = `(?:${[...Object.keys(UNITS), ...Object.keys(TENS)].join("|")})`;

/** Spoken numbers as digits: "four over ten" → "4 over 10", "twenty five" → "25". */
function digitsFor(transcript: string): string {
  return transcript.replace(new RegExp(`\\b${NUMBER_WORD}(?:[\\s-]+${NUMBER_WORD})*\\b`, "gi"), (run) => {
    const parts = run.toLowerCase().split(/[\s-]+/);
    // "twenty five" is one number; "four four" is two.
    const out: number[] = [];
    for (const p of parts) {
      const v = UNITS[p] ?? TENS[p];
      const last = out.length - 1;
      if (last >= 0 && out[last] % 10 === 0 && out[last] >= 20 && v < 10) out[last] += v;
      else out.push(v);
    }
    return out.join(" ");
  });
}

const NUM = String.raw`\d+(?:\.\d+)?`;
const FRAC = String.raw`${NUM}(?:\s*(?:/|\bover\b|\bout of\b)\s*${NUM})?`;
const OP = String.raw`(?:\*|×|\+|-|−|÷|=|\^|\btimes\b|\bmultiplied by\b|\bplus\b|\bminus\b|\btake away\b|\bdivided by\b|\bequals\b|\bto the power of\b)`;
const EXPR = new RegExp(String.raw`${FRAC}(?:\s*${OP}\s*${FRAC})+(?:\s*\bsquared\b|\s*\bcubed\b)?|${FRAC}\s*\b(?:squared|cubed)\b`, "gi");

function latexFrac(s: string): string {
  const m = new RegExp(String.raw`^(${NUM})\s*(?:/|\bover\b|\bout of\b)\s*(${NUM})$`, "i").exec(s.trim());
  return m ? `\\frac{${m[1]}}{${m[2]}}` : s.trim();
}

/**
 * The maths in a phrase, written exactly as said and nothing more:
 * "6/10 * 5/9 and then yeah those two together" → "$\frac{6}{10} \times \frac{5}{9}$".
 * Empty when the phrase holds no calculation.
 */
export function literalMath(transcript: string): string {
  const text = digitsFor(transcript);
  const found = text.match(EXPR) ?? [];
  const pieces = found.map((expr) => {
    const tokens = expr.split(new RegExp(String.raw`\s*(${OP}|\bsquared\b|\bcubed\b)\s*`, "i")).filter((t) => t && t.trim());
    const out = tokens.map((t) => {
      const op = t.toLowerCase().trim();
      if (["*", "×", "times", "multiplied by"].includes(op)) return "\\times";
      if (["+", "plus"].includes(op)) return "+";
      if (["-", "−", "minus", "take away"].includes(op)) return "-";
      if (["÷", "divided by"].includes(op)) return "\\div";
      if (["=", "equals"].includes(op)) return "=";
      if (["^", "to the power of"].includes(op)) return "^";
      if (op === "squared") return "^2";
      if (op === "cubed") return "^3";
      return latexFrac(t);
    });
    return `$${out.join(" ").replace(/ \^/g, "^").replace(/\^ /g, "^")}$`;
  });
  return pieces.join(", ");
}

export interface GuardedLine {
  text: string;
  kind: "math" | "prose";
  /** True when the model"s line held something the learner did not say. */
  trimmed: boolean;
}

/**
 * Keep only what was said. `text` is what the model wrote for `transcript`;
 * works the same on a finished phrase and on one still being spoken.
 */
export function guardLiteral(text: string, kind: "math" | "prose", transcript: string): GuardedLine {
  const spoken = spokenNumbers(transcript);
  const said = new Set(words(transcript));
  const budget: Budget = { equals: equalsBudget(transcript) };
  const source = text.trim();
  if (!source) return { text: "", kind, trimmed: false };

  // Maths between $…$; a "math" line with no dollars is all maths.
  const chunks: Array<{ math: boolean; body: string }> = [];
  if (kind === "math" && !source.includes("$")) chunks.push({ math: true, body: source });
  else {
    source.split(/(\$[^$]+\$)/).forEach((c) => {
      if (!c) return;
      if (/^\$[^$]+\$$/.test(c)) chunks.push({ math: true, body: c.slice(1, -1) });
      else chunks.push({ math: false, body: c });
    });
  }

  let trimmed = false;
  let failed = false;
  const out = chunks.map((c) => {
    if (!c.math) {
      if (!numbersOk(c.body, spoken)) failed = true;
      return c.body;
    }
    const kept = guardMath(c.body, transcript, spoken, said, budget);
    if (kept === null) {
      failed = true;
      return "";
    }
    if (kept.replace(/\s+/g, "") !== c.body.replace(/\s+/g, "")) trimmed = true;
    return source.includes("$") ? `$${kept}$` : kept;
  });

  if (!failed) return { text: out.join("").replace(/\s+/g, " ").trim(), kind, trimmed };

  // The model"s line can"t be trimmed back: rebuild the maths from the words alone.
  const literal = literalMath(transcript);
  if (literal) return { text: literal, kind: "math", trimmed: true };
  return { text: transcript.replace(/\s+/g, " ").trim(), kind: "prose", trimmed: true };
}
