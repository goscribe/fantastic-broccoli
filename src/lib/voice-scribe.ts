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

const MAX_CONTEXT_CHARS = 4000;

/**
 * The question a box answers: the nearest `[data-dictation-context]` around
 * it when the activity marks one, otherwise everything the scope shows.
 */
export function questionContext(field: Element | null, scope: HTMLElement | null): string {
  const holder = (field?.closest("[data-dictation-context]") as HTMLElement | null) ?? scope;
  if (!holder) return "";
  return (holder.innerText || holder.textContent || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_CONTEXT_CHARS);
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
  if (kind === "math" && !singleLine) return `${existing}\n${text}`;
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
