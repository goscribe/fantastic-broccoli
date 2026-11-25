/**
 * Voice scribe: the learner talks, Scribe writes. This module is the core
 * that any page can use — no answer box knows about it. It finds the answer
 * boxes on the page by themselves (any text field inside the scope), reads
 * the question around the chosen one, and writes into it the same way typing
 * would, so each activity's own onChange, drafts and marking keep working.
 */

export type VoiceTarget = "notepad" | "answer";

/** What the server sends back for one phrase. */
export interface ScribeReply {
  text: string;
  kind: "math" | "prose";
  /** Another part the phrase clearly answers; "" to stay. */
  part?: string;
  fallback?: boolean;
}

/** Text fields a learner answers in. Choice buttons and sliders are not dictated into. */
export function isFillable(el: Element | null | undefined): el is HTMLTextAreaElement | HTMLInputElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.disabled && !el.readOnly;
  if (el instanceof HTMLInputElement) {
    const type = (el.getAttribute("type") ?? "text").toLowerCase();
    return ["text", "search", "number", ""].includes(type) && !el.disabled && !el.readOnly;
  }
  return false;
}

/** Answer boxes are the scope's text fields, minus anything opted out (search boxes, the notepad itself). */
export function answerFields(scope: HTMLElement | null): Array<HTMLTextAreaElement | HTMLInputElement> {
  if (!scope) return [];
  return Array.from(scope.querySelectorAll("textarea, input")).filter(
    (el): el is HTMLTextAreaElement | HTMLInputElement => isFillable(el) && !el.closest("[data-voice-ignore]"),
  );
}

/** The box words go to when the learner hasn't picked one: the first empty one, else the first. */
export function defaultAnswerField(scope: HTMLElement | null) {
  const fields = answerFields(scope);
  return fields.find((f) => !f.value.trim()) ?? fields[0] ?? null;
}

const BLOCK_TAGS = new Set(["P", "DIV", "LI", "TR", "H1", "H2", "H3", "H4", "SECTION", "UL", "OL", "TABLE", "FIGURE"]);

/**
 * An element's words as plain text with its maths as `$…$` LaTeX. KaTeX puts
 * a MathML copy and a visual copy of every formula in the page, so innerText
 * reads "P(X=0)=0.2" as one symbol per line followed by the same formula
 * again; this reads each formula's source from its TeX annotation instead.
 */
export function readableText(el: HTMLElement | null): string {
  if (!el) return "";
  const clone = el.cloneNode(true) as HTMLElement;
  const doc = clone.ownerDocument;
  // Outermost formulas first; a .katex inside a replaced .katex-display is gone with it.
  clone.querySelectorAll(".katex-display, .katex").forEach((k) => {
    if (!clone.contains(k)) return;
    const tex = k.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim();
    const display = k.classList.contains("katex-display");
    const text = tex ? (display ? `\n$${tex}$\n` : `$${tex}$`) : (k.querySelector(".katex-html")?.textContent ?? k.textContent ?? "");
    k.replaceWith(doc.createTextNode(text));
  });
  clone.querySelectorAll("br").forEach((b) => b.replaceWith(doc.createTextNode("\n")));
  clone.querySelectorAll("*").forEach((n) => {
    if (BLOCK_TAGS.has(n.tagName)) n.append(doc.createTextNode("\n"));
  });
  return (clone.textContent ?? "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const MAX_CONTEXT_CHARS = 4000;

/**
 * The question a box answers: the nearest `[data-dictation-context]` around
 * it when the activity marks one, otherwise everything the scope shows.
 */
export function questionContext(field: Element | null, scope: HTMLElement | null): string {
  const holder = (field?.closest("[data-dictation-context]") as HTMLElement | null) ?? scope;
  if (!holder) return "";
  // The question's words, not the page's buttons ("Add a drawing", "Skip this part").
  const controls = new Set(Array.from(holder.querySelectorAll("button")).map((b) => readableText(b)).filter(Boolean));
  const text = readableText(holder)
    .split("\n")
    .filter((line) => !controls.has(line.trim()))
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  // Which part of a several-part question the box answers ("b").
  const part = field?.closest("[data-dictation-label]")?.getAttribute("data-dictation-label");
  const note = part ? `\n\n(The student is answering part ${part}.)` : "";
  return text.slice(0, MAX_CONTEXT_CHARS - note.length) + note;
}

/**
 * Write into a React-controlled field the way typing does: the native value
 * setter, then an input event, so the field's own onChange runs.
 */
export function setFieldValue(el: HTMLTextAreaElement | HTMLInputElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Add a written phrase to what is there: each maths step on its own line
 * (working reads down the page), words carry on the sentence.
 */
export function appendWritten(existing: string, add: string, kind: ScribeReply["kind"], singleLine = false): string {
  const text = add.trim();
  if (!text) return existing;
  if (!existing.trim()) return text;
  if (existing.endsWith("\n")) return existing + text;
  // A maths step, or words after one, starts its own line.
  if ((kind === "math" || /\$\s*$/.test(existing)) && !singleLine) return `${existing}\n${text}`;
  return `${existing.replace(/\s+$/, "")} ${text}`;
}

/** Spoken commands that never go to the server. */
export function spokenCommand(transcript: string): "undo" | "newline" | null {
  const s = transcript.toLowerCase().replace(/[.,!?]/g, "").trim();
  if (/^(scratch that|undo( that)?|delete that|remove that|take that back)$/.test(s)) return "undo";
  if (/^(new line|next line)$/.test(s)) return "newline";
  return null;
}

/** BCP-47 tag for recognition: the device's own variant when it speaks the UI language (en-GB, not en-US). */
export function recognitionLang(locale: string, deviceLanguages: readonly string[] = []): string {
  const own = deviceLanguages.find((l) => l.toLowerCase().split("-")[0] === locale.toLowerCase());
  return own ?? locale;
}

/* ------------------------- speech recognition ------------------------- */

interface RecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: ArrayLike<RecognitionResultLike> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechSupported = () => recognitionCtor() !== null;

export interface Listener {
  stop: () => void;
}

/**
 * Listen until stopped. Each finished phrase goes to `onPhrase`; the words
 * still being heard go to `onInterim`. Browsers end recognition after a
 * silence, so it restarts itself until `stop()`.
 */
export function listen(opts: {
  lang: string;
  onPhrase: (text: string) => void;
  onInterim: (text: string) => void;
  onError: (reason: "denied" | "failed") => void;
  onEnd: () => void;
}): Listener | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  let stopped = false;
  let rec: RecognitionLike | null = null;
  let failures = 0;

  const start = () => {
    rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = opts.lang;
    rec.onresult = (event) => {
      failures = 0;
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          const text = r[0].transcript.trim();
          if (text) opts.onPhrase(text);
        } else {
          interim += r[0].transcript;
        }
      }
      opts.onInterim(interim.trim());
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        stopped = true;
        opts.onError("denied");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        failures += 1;
        if (failures >= 3) {
          stopped = true;
          opts.onError("failed");
        }
      }
    };
    rec.onend = () => {
      opts.onInterim("");
      if (stopped) {
        opts.onEnd();
        return;
      }
      try {
        start();
      } catch {
        stopped = true;
        opts.onEnd();
      }
    };
    rec.start();
  };

  try {
    start();
  } catch {
    return null;
  }
  return {
    stop: () => {
      stopped = true;
      rec?.stop();
    },
  };
}

/* ------------------------------- parts ------------------------------- */

/** One part of the question on screen and its answer box ("b", "How many…?"). */
export interface AnswerPart {
  label: string;
  prompt: string;
  field: HTMLTextAreaElement | HTMLInputElement;
}

/**
 * The parts on the page, in order. A box inside `[data-dictation-label]`
 * takes that label (and `data-dictation-prompt` as its question); any other
 * box is numbered. One box per part: the first.
 */
export function answerParts(scope: HTMLElement | null): AnswerPart[] {
  const seen = new Set<string>();
  const parts: AnswerPart[] = [];
  answerFields(scope).forEach((field, i) => {
    const holder = field.closest("[data-dictation-label]");
    const label = holder?.getAttribute("data-dictation-label")?.trim() || String(i + 1);
    if (seen.has(label.toLowerCase())) return;
    seen.add(label.toLowerCase());
    parts.push({ label, prompt: holder?.getAttribute("data-dictation-prompt")?.trim() ?? "", field });
  });
  return parts;
}

/** How speech recognition tends to write a spoken part name. */
const SPOKEN_TOKENS: Record<string, string> = {
  ay: "a", eh: "a", be: "b", bee: "b", see: "c", sea: "c", dee: "d", eff: "f", gee: "g", aitch: "h",
  one: "1", won: "1", two: "2", to: "2", too: "2", three: "3", four: "4", for: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  first: "1", second: "2", third: "3", fourth: "4", fifth: "5",
};

export type PartSwitch = { to: string; rest: string } | { step: 1 | -1; rest: string };

/**
 * "part b", "question 2", "go to part a", "next part", "for part b, add the
 * oranges…": which part the learner moves to, and what they said after it
 * (still to be written). Null when the phrase doesn't start with a switch.
 */
export function spokenSwitch(transcript: string, labels: string[]): PartSwitch | null {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const plain = words.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""));
  let i = 0;
  while (["ok", "okay", "now", "so", "and", "right", "um"].includes(plain[i])) i++;
  if (plain[i] === "go" || plain[i] === "move" || plain[i] === "switch") i++;
  if (["to", "for", "on", "in"].includes(plain[i])) i++;
  const rest = (n: number) => words.slice(n).join(" ").replace(/^[,.:;\-–—\s]+/, "");

  if (["next", "previous", "last"].includes(plain[i]) && ["part", "question", "one"].includes(plain[i + 1])) {
    return { step: plain[i] === "next" ? 1 : -1, rest: rest(i + 2) };
  }
  if (!["part", "question", "number"].includes(plain[i])) return null;
  const said = plain[i + 1];
  if (!said) return null;
  const token = SPOKEN_TOKENS[said] ?? said;
  const byName = labels.find((l) => l.toLowerCase() === token || l.toLowerCase() === said);
  if (byName) return { to: byName, rest: rest(i + 2) };
  // "question 2" on lettered parts: the second one.
  const n = Number(token);
  if (Number.isInteger(n) && n >= 1 && n <= labels.length) return { to: labels[n - 1], rest: rest(i + 2) };
  return null;
}

/* ---------------------------- filler & choices ---------------------------- */

const FILLER = new Set([
  "hello", "hi", "hey", "hiya", "um", "umm", "uh", "uhh", "er", "erm", "hmm", "hm", "mm", "okay", "ok", "so", "right",
  "yeah", "yes", "yep", "no", "wait", "oh", "ah", "alright", "test", "testing", "one", "two", "three", "well", "like",
  "and", "then", "can", "you", "hear", "me", "is", "this", "working", "on", "let", "see", "lets", "let's", "thing",
]);

/**
 * Throwaway speech that is not working: a greeting, a mic check, a false
 * start ("hello", "um okay", "testing one two", "can you hear me"). Dropped
 * before it becomes a numbered step.
 */
export function isFiller(transcript: string): boolean {
  const ws = transcript.toLowerCase().replace(/[^\p{L}\p{N}'\s]/gu, " ").split(/\s+/).filter(Boolean);
  if (!ws.length) return true;
  return ws.length <= 6 && ws.every((w) => FILLER.has(w));
}

const LETTER_SPOKEN: Record<string, string> = {
  a: "a", ay: "a", eh: "a", b: "b", be: "b", bee: "b", c: "c", see: "c", sea: "c", d: "d", dee: "d", e: "e", ee: "e",
  f: "f", eff: "f",
};
const ORDINALS: Record<string, number> = { first: 0, second: 1, third: 2, fourth: 3, fifth: 4, last: -1 };

const tokens = (s: string) =>
  s.toLowerCase().replace(/[’']/g, "").replace(/\$[^$]*\$/g, (m) => m.replace(/[{}\\]/g, " ")).replace(/[^\p{L}\p{N}.\s]/gu, " ").split(/\s+/).filter(Boolean);

/**
 * Which option a spoken answer picks on a multiple-choice question: a letter
 * ("B", "option bee", "I think it's C"), a position ("the second one"), or
 * the option read out. Options that share a long opening ("The reported
 * estimate of 1 …") are told apart by the words that differ. -1 when unsure.
 */
export function spokenChoice(transcript: string, options: string[]): number {
  const ws = tokens(transcript).filter((w) => !["um", "uh", "er", "erm", "okay", "ok", "so"].includes(w));
  if (!ws.length || !options.length) return -1;
  const letterAt = (w: string | undefined) => {
    const l = w ? LETTER_SPOKEN[w] : undefined;
    const i = l ? l.charCodeAt(0) - 97 : -1;
    return i >= 0 && i < options.length ? i : -1;
  };
  // Just a letter.
  if (ws.length === 1 && letterAt(ws[0]) >= 0) return letterAt(ws[0]);
  // "option b", "answer c", "letter d", "it's b", "go with a", "pick c".
  for (let i = 0; i < ws.length - 1; i++) {
    if (["option", "answer", "letter", "choice", "its", "it's", "with", "pick", "choose", "is"].includes(ws[i])) {
      const at = letterAt(ws[i + 1]);
      // "it's a …" reads on into a sentence; a letter counts only at the end or before a stop word.
      if (at >= 0 && (i + 2 === ws.length || ["option", "one", "please", "because", "since"].includes(ws[i + 2]) || ws[i] !== "its" && ws[i] !== "it's" && ws[i] !== "is")) return at;
    }
  }
  // "the second one", "the last option".
  for (let i = 0; i < ws.length - 1; i++) {
    if (ws[i] in ORDINALS && ["one", "option", "answer", "choice"].includes(ws[i + 1])) {
      const n = ORDINALS[ws[i]];
      return n === -1 ? options.length - 1 : n < options.length ? n : -1;
    }
  }
  // The option read out: compare only the words that tell the options apart.
  const sets = options.map((o) => new Set(tokens(o)));
  const shared = new Set([...sets[0]].filter((w) => sets.every((s) => s.has(w))));
  const said = new Set(ws.filter((w) => !shared.has(w)));
  if (said.size < 2) return -1;
  const scores = sets.map((s) => {
    const own = [...s].filter((w) => !shared.has(w));
    if (!own.length) return 0;
    const hit = own.filter((w) => said.has(w)).length;
    return hit / own.length;
  });
  const order = scores.map((s, i) => [s, i] as const).sort((x, y) => y[0] - x[0]);
  const [best, second] = order;
  return best[0] >= 0.6 && best[0] - (second?.[0] ?? 0) >= 0.25 ? best[1] : -1;
}

/** The multiple-choice options on the page: buttons marked `data-voice-choice`. */
export function choiceButtons(scope: HTMLElement | null): HTMLButtonElement[] {
  if (!scope) return [];
  return Array.from(scope.querySelectorAll<HTMLButtonElement>("button[data-voice-choice]")).filter((b) => !b.disabled);
}

/**
 * The question's main stem, the givens every part relies on: the nearest
 * `[data-dictation-stem]` around (or in) the scope.
 */
export function questionStem(field: Element | null, scope: HTMLElement | null): string {
  const holder = (field?.closest("[data-dictation-context]") as HTMLElement | null) ?? scope;
  const stem = holder?.querySelector<HTMLElement>("[data-dictation-stem]") ?? scope?.querySelector<HTMLElement>("[data-dictation-stem]");
  return readableText(stem ?? null);
}
