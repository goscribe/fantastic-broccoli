"use client";

import { createContext, useContext, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { ArrowUp, Check, ChevronDown, Eye, Loader2, Mic, Pencil, Square, X } from "lucide-react";
import { Mascot } from "@/components/rewards/mascot";
import { interpretSpeech } from "@/lib/api/voice-scribe";
import {
  answerParts,
  appendWritten,
  choiceButtons,
  isFiller,
  isFillable,
  listen,
  questionContext,
  questionStem,
  recognitionLang,
  setFieldValue,
  speechSupported,
  spokenChoice,
  spokenCommand,
  spokenSwitch,
  type AnswerPart,
  type Listener,
} from "@/lib/voice-scribe";
import { guardLiteral } from "@/lib/voice-literal";
import { MarkdownText, MathText } from "@/components/ui/markdown-text";
import { playLink } from "@/components/session/play-ui";
import { toast } from "@/lib/toast";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/voice";
import { cn } from "@/lib/utils";

type Field = HTMLTextAreaElement | HTMLInputElement;

/**
 * One line of the chain: what the learner said and what Scribe will write,
 * and the part it goes into. "live" is still being heard, "writing" is with
 * the server, "undone" is crossed out (kept, so the chain stays whole),
 * "note" records a switch or a command.
 */
interface Step {
  id: number;
  said: string;
  wrote: string;
  math: boolean;
  part: string;
  state: "live" | "writing" | "done" | "undone" | "note";
}

const INTRO_KEY = "scribe.voiceIntroSeen";
const introListeners = new Set<() => void>();

function introSeen(): boolean {
  try {
    return window.localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return true;
  }
}

function markIntroSeen() {
  try {
    window.localStorage.setItem(INTRO_KEY, "1");
  } catch {
    /* private mode: it shows again next visit */
  }
  introListeners.forEach((fn) => fn());
}

/** Whether this device has had the cat's "talk to write" intro. Server render: yes (nothing to flash). */
function useIntroSeen(): boolean {
  return useSyncExternalStore(
    (fn) => {
      introListeners.add(fn);
      return () => introListeners.delete(fn);
    },
    introSeen,
    () => true,
  );
}

/**
 * The top-bar button: opens the overlay, and while it is open, stops and
 * writes. With `intro`, the first time on this device the cat points at it
 * in a speech bubble and says what it does.
 */
export function VoiceScribeTrigger({ active, onClick, intro = false }: { active: boolean; onClick: () => void; intro?: boolean }) {
  const { t } = useI18n();
  const seen = useIntroSeen();
  const showIntro = intro && !seen && !active;
  return (
    <span className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          if (!seen) markIntroSeen();
          onClick();
        }}
        aria-label={t(active ? "voice.stopAndWrite" : "voice.open")}
        title={t(active ? "voice.stopAndWrite" : "voice.open")}
        aria-pressed={active}
        className={cn(
          "grid size-11 place-items-center rounded-full hover:bg-muted hover:text-foreground",
          active || showIntro ? "bg-accent-soft text-accent" : "text-muted-foreground",
        )}
      >
        <Mic className="size-4" />
      </button>
      {showIntro && (
        // The cat, pointing up at the mic. Its right edge lines up with the top bar's.
        <div
          role="note"
          className="animate-bubble-in absolute right-[-76px] top-full z-40 mt-2.5 w-[min(320px,calc(100vw-32px))] rounded-[22px] border border-border bg-card p-3.5 shadow-[0_14px_34px_-18px_rgba(0,0,0,0.35)]"
        >
          <span aria-hidden className="absolute -top-[7px] right-[92px] size-3 rotate-45 border-l border-t border-border bg-card" />
          <div className="flex gap-3">
            <Mascot pose="pencil" className="h-14 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-ui font-extrabold leading-snug text-foreground">{t("voice.introTitle")}</p>
              <p className="mt-1 text-small leading-snug text-muted-foreground">{t("voice.introBody")}</p>
            </div>
            <button
              type="button"
              onClick={markIntroSeen}
              aria-label={t("voice.introDismiss")}
              className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-faint hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="mt-2.5 flex justify-end">
            <button
              type="button"
              onClick={() => {
                markIntroSeen();
                onClick();
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-[14px] font-extrabold text-white"
            >
              <Mic className="size-4" />
              {t("voice.introTry")}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

/**
 * The player's one microphone, for buttons beside the answer: "Answer out
 * loud" next to an answer box, or next to Check answer on a multiple-choice
 * question. Outside the player (no provider) the button is not shown.
 */
export const VoiceAnswerContext = createContext<{ toggle: (anchor?: HTMLElement | null) => void; active: boolean } | null>(null);

/**
 * "Answer out loud": a soft accent pill with the mic, beside the answer
 * controls. While listening, the overlay puts its stop button where this one
 * is, so the control stays under the learner's finger.
 */
export function VoiceAnswerButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { t } = useI18n();
  const voice = useContext(VoiceAnswerContext);
  const ref = useRef<HTMLButtonElement>(null);
  if (!voice) return null;
  return (
    <button
      ref={ref}
      type="button"
      data-voice-answer
      onClick={() => {
        markIntroSeen();
        voice.toggle(ref.current);
      }}
      aria-pressed={voice.active}
      title={t("voice.answerOutLoudTip")}
      aria-label={compact ? t("voice.answerOutLoud") : undefined}
      className={cn(
        "inline-flex h-11 shrink-0 touch-manipulation items-center justify-center gap-2 rounded-full bg-accent-soft px-4 text-[14.5px] font-extrabold text-accent ring-inset transition-[background-color,transform] duration-150 hover:ring-2 hover:ring-accent/40 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
        compact && "w-11 px-0",
        className,
      )}
    >
      <Mic className="size-[18px]" aria-hidden />
      {!compact && t("voice.answerOutLoud")}
    </button>
  );
}

/** Before the learner says anything: the cat explains the three steps in a speech bubble. */
function HowItWorks({ choice = false }: { choice?: boolean }) {
  const { t } = useI18n();
  const steps = choice
    ? [
        { n: 1, body: <>{t("voice.choice1")} <span className="font-semibold">“B”</span></> },
        { n: 2, body: <>{t("voice.choice2")}</> },
        { n: 3, body: <>{t("voice.choice3")}</> },
      ]
    : [
    { n: 1, body: <>{t("voice.how1")} <span className="italic text-muted-foreground">{t("voice.how1Example")}</span></> },
    { n: 2, body: <>{t("voice.how2")} <span className="font-semibold"><MathText text="$\\frac{4}{10} \\times \\frac{3}{9}$" /></span></> },
    { n: 3, body: <>{t("voice.how3")}</> },
      ];
  return (
    <li className="flex items-start gap-3">
      <Mascot pose="think" className="mt-3 h-16 shrink-0" />
      <div className="relative min-w-0 flex-1 rounded-[22px] border border-border bg-card px-4 py-3.5 shadow-[0_8px_24px_-16px_rgba(17,17,20,.35)]">
        <span aria-hidden className="absolute -left-[7px] top-8 size-3 rotate-45 border-b border-l border-border bg-card" />
        <p className="text-ui font-extrabold text-foreground">{t(choice ? "voice.choiceTitle" : "voice.howTitle")}</p>
        <ol className="mt-2 space-y-2">
          {steps.map((s) => (
            <li key={s.n} className="flex gap-2.5 text-ui leading-snug text-foreground">
              <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-extrabold text-accent">{s.n}</span>
              <span className="min-w-0">{s.body}</span>
            </li>
          ))}
        </ol>
        {!choice && <p className="mt-2.5 text-small text-muted-foreground">{t("voice.howUndo")}</p>}
      </div>
    </li>
  );
}

/** What the page can ask of the voice scribe. */
export interface VoiceScribeHandle {
  /**
   * Closed: open and start listening. Open: stop and write it in. `anchor` is
   * the button that was tapped: its part is the one answered, and the stop
   * button is drawn in its place.
   */
  toggle: (anchor?: HTMLElement | null) => void;
}

/** A box just written into: grown to show every line, and flashed. */
function showWritten(box: Field) {
  if (box instanceof HTMLTextAreaElement && box.scrollHeight > box.clientHeight) box.style.height = `${box.scrollHeight + 2}px`;
  box.removeAttribute("data-voice-flash");
  void box.offsetWidth;
  box.setAttribute("data-voice-flash", "");
  window.setTimeout(() => box.removeAttribute("data-voice-flash"), 1000);
}

/** "a and b", for the toast after writing into several boxes. */
function joinLabels(labels: string[], and: string): string {
  return labels.length < 2 ? (labels[0] ?? "") : `${labels.slice(0, -1).join(", ")} ${and} ${labels[labels.length - 1]}`;
}

/**
 * Talk to write: one microphone for the whole page, not one per box. While
 * the learner talks, a see-through overlay shows the question they are
 * answering at the top and the whole chain under it — what they said, then
 * what Scribe will write, with spoken maths turned into notation using the
 * question's own numbers ("add the oranges to the bananas" → 2 + 2 = 4).
 * Scribe follows them between parts: "part b" or "next part" moves on, and a
 * phrase that clearly answers another part moves there by itself. Stopping
 * puts each part's lines into its own answer box, the way typing would.
 *
 * `scope` is the content the answer boxes and the question live in. The page
 * opens and stops it through `ref` and hears about it through `onOpenChange`.
 */
export function VoiceScribe({
  ref,
  scope,
  onOpenChange,
}: {
  ref: RefObject<VoiceScribeHandle | null>;
  scope: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const [open, setOpenState] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [listening, setListening] = useState(false);
  /** The overlay is lowered so the page (its tables, graphs and figures) can be read; listening carries on. */
  const [peek, setPeek] = useState(false);
  const [parts, setParts] = useState<AnswerPart[]>([]);
  const [current, setCurrentState] = useState("");
  /** A multiple-choice question: speech picks an option instead of writing. */
  const [choices, setChoices] = useState<string[]>([]);
  const choicesRef = useRef<HTMLButtonElement[]>([]);
  const [picked, setPicked] = useState(-1);
  /** The main stem, with the givens every part relies on. */
  const [stem, setStem] = useState("");
  const [stemOpen, setStemOpen] = useState(false);
  /** Where the tapped "Answer out loud" button sits: the stop button goes there. */
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  /** Lines written so far can be corrected by hand. */
  const [editing, setEditing] = useState(false);

  const stepsRef = useRef<Step[]>([]);
  const partsRef = useRef<AnswerPart[]>([]);
  const currentRef = useRef("");
  const lastFocused = useRef<Field | null>(null);
  const listener = useRef<Listener | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const nextId = useRef(1);
  const chainEnd = useRef<HTMLLIElement>(null);

  const setOpen = (next: boolean) => {
    setOpenState(next);
    // Each opening starts on the overlay, not lowered.
    setPeek(false);
    onOpenChange(next);
  };
  const setCurrent = (label: string) => {
    currentRef.current = label;
    setCurrentState(label);
  };
  const updateSteps = (fn: (s: Step[]) => Step[]) => {
    stepsRef.current = fn(stepsRef.current);
    setSteps(stepsRef.current);
  };
  const note = (text: string, said = "") =>
    updateSteps((list) => [...list, { id: nextId.current++, said, wrote: text, math: false, part: currentRef.current, state: "note" }]);

  // The box the learner last typed in is the part they mean.
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      // A rich answer box is edited in its editor; its text lives in its textarea.
      const target = e.target as Element | null;
      const el = target?.closest("[data-rich-answer]")?.querySelector("textarea") ?? target;
      if (isFillable(el) && scope.current?.contains(el) && !el.closest("[data-voice-ignore]")) lastFocused.current = el;
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, [scope]);

  const partFor = (label: string) => partsRef.current.find((p) => p.label === label);

  /** Move to a part; `why` says how, as a line in the chain. */
  const switchTo = (label: string, why: "said" | "heard" | "tapped", said = "") => {
    if (!partFor(label) || label === currentRef.current) return;
    setCurrent(label);
    if (why !== "tapped") note(t(why === "said" ? "voice.switched" : "voice.autoSwitched").replace("{part}", label), said);
  };

  const step = (by: 1 | -1, said: string) => {
    const labels = partsRef.current.map((p) => p.label);
    const next = labels[labels.indexOf(currentRef.current) + by];
    if (next) switchTo(next, "said", said);
    else note(t(by === 1 ? "voice.noNext" : "voice.noPrevious"), said);
  };

  /** Cross out the last step still standing. */
  const undo = (said?: string) => {
    updateSteps((list) => {
      const last = [...list].reverse().find((s) => s.state === "done");
      let next = last ? list.map((s) => (s === last ? { ...s, state: "undone" as const } : s)) : list;
      if (said) {
        const n = last ? list.indexOf(last) + 1 : 0;
        next = [...next, { id: nextId.current++, said, wrote: n ? t("voice.crossedOut").replace("{n}", String(n)) : "", math: false, part: currentRef.current, state: "note" }];
      }
      return next;
    });
  };

  /** One phrase of working: to the server, in order, so each step sees the one before. */
  const write = (phrase: string, said = phrase) => {
    const id = nextId.current++;
    const part = currentRef.current;
    updateSteps((list) => [...list, { id, said, wrote: "", math: false, part, state: "writing" }]);
    queue.current = queue.current.then(async () => {
      const box = partFor(part)?.field ?? null;
      const doneHere = stepsRef.current.filter((s) => s.state === "done" && s.part === part).map((s) => s.wrote);
      const reply = await interpretSpeech({
        transcript: phrase,
        target: "answer",
        question: questionContext(box, scope.current),
        written: [box?.value ?? "", ...doneHere].filter(Boolean).join("\n"),
        parts: partsRef.current.map((p) => ({ label: p.label, prompt: p.prompt })),
        currentPart: part,
      }).catch(() => ({ text: phrase, kind: "prose" as const, part: "", fallback: true }));
      if (reply.fallback) toast(t("voice.asSpoken"), { id: "voice-as-spoken" });
      // It answers another part: it goes there, and so does the learner.
      const moved = reply.part && partFor(reply.part) ? reply.part : "";
      // Only what was said: a result, label or value the learner did not say never reaches the box.
      const kept = guardLiteral(reply.text, reply.kind, phrase);
      const text = kept.text.trim();
      // Nothing to write (filler, a false start): the line goes, it is not a numbered step.
      updateSteps((list) =>
        text
          ? list.map((s) => (s.id !== id ? s : { ...s, wrote: text, math: kept.kind === "math", part: moved || s.part, state: "done" }))
          : list.filter((s) => s.id !== id),
      );
      if (moved) switchTo(moved, "heard");
    });
  };

  /** One finished phrase: switches and commands act at once; the rest is working. */
  const handlePhrase = (phrase: string) => {
    updateSteps((list) => list.filter((s) => s.state !== "live"));
    // "hello", "um okay", "testing one two": not working, not a step.
    if (isFiller(phrase)) return;
    if (choicesRef.current.length) {
      const buttons = choicesRef.current.filter((b) => b.isConnected && !b.disabled);
      const pick = spokenChoice(phrase, buttons.map((b) => b.getAttribute("data-voice-choice-text") ?? b.innerText));
      if (pick >= 0) {
        // The same as tapping it; Check answer stays the learner's.
        buttons[pick].click();
        setPicked(pick);
        note(t("voice.picked").replace("{letter}", String.fromCharCode(65 + pick)), phrase);
      } else note(t("voice.sayALetter"), phrase);
      return;
    }
    const move = spokenSwitch(phrase, partsRef.current.map((p) => p.label));
    if (move) {
      if ("to" in move) switchTo(move.to, "said", move.rest ? "" : phrase);
      else step(move.step, move.rest ? "" : phrase);
      if (move.rest) write(move.rest, phrase);
      return;
    }
    const command = spokenCommand(phrase);
    if (command === "undo") undo(phrase);
    else if (command === "newline") note("↵", phrase);
    else write(phrase);
  };

  const onInterim = (text: string) => {
    updateSteps((list) => {
      const rest = list.filter((s) => s.state !== "live");
      return text && !isFiller(text) ? [...rest, { id: -1, said: text, wrote: "", math: false, part: currentRef.current, state: "live" }] : rest;
    });
  };

  // Recognition outlives renders; its callbacks reach the latest handlers through here.
  const handlers = useRef({ handlePhrase, onInterim });
  useEffect(() => {
    handlers.current = { handlePhrase, onInterim };
  });

  const stopListening = () => {
    listener.current?.stop();
    listener.current = null;
    setListening(false);
  };

  const startListening = () => {
    const l = speechSupported()
      ? listen({
          lang: recognitionLang(locale, typeof navigator === "undefined" ? [] : (navigator.languages ?? [])),
          onPhrase: (text) => handlers.current.handlePhrase(text),
          onInterim: (text) => handlers.current.onInterim(text),
          onError: (reason) => toast.error(t(reason === "denied" ? "voice.denied" : "voice.failed"), { id: "voice-error" }),
          onEnd: () => {
            listener.current = null;
            setListening(false);
          },
        })
      : null;
    if (!l) {
      toast.error(t("voice.unsupported"), { id: "voice-unsupported" });
      return false;
    }
    listener.current = l;
    setListening(true);
    return true;
  };

  const close = () => {
    stopListening();
    stepsRef.current = [];
    setSteps([]);
    setEditing(false);
    setAnchor(null);
    choicesRef.current = [];
    setChoices([]);
    setOpen(false);
  };

  /** Open on the part the learner is on: the box they last typed in, else the first one still empty. */
  const start = (from?: HTMLElement | null) => {
    const found = answerParts(scope.current);
    partsRef.current = found;
    setParts(found);
    // No answer box but options to pick: a multiple-choice question.
    const buttons = found.length ? [] : choiceButtons(scope.current);
    choicesRef.current = buttons;
    setPicked(buttons.findIndex((b) => b.getAttribute("aria-pressed") === "true"));
    setChoices(buttons.map((b) => b.getAttribute("data-voice-choice-text") ?? b.innerText));
    // The part whose "Answer out loud" was tapped, else the box last typed in, else the first empty one.
    const tapped = from?.closest("[data-dictation-label]")?.getAttribute("data-dictation-label") ?? "";
    const focused = found.find((p) => p.field === lastFocused.current && p.field.isConnected);
    setCurrent(found.find((p) => p.label === tapped)?.label ?? (focused ?? found.find((p) => !p.field.value.trim()) ?? found[0])?.label ?? "");
    setStem(questionStem(found[0]?.field ?? null, scope.current));
    setStemOpen(false);
    const r = from?.getBoundingClientRect();
    // A round mic beside a box keeps its row but sits at the column's right edge, where the lines below leave room for it.
    const edge = scope.current?.getBoundingClientRect().right ?? 0;
    const left = r && r.width < 80 && edge > r.right ? edge - r.width : r?.left ?? 0;
    setAnchor(r && r.width ? { top: r.top, left, width: r.width, height: r.height } : null);
    if (!startListening()) return;
    setOpen(true);
  };

  /** Stop: wait for the phrases still being written, then put each part's lines into its box. */
  const stopAndWrite = async () => {
    stopListening();
    await queue.current;
    const done = stepsRef.current.filter((s) => s.state === "done");
    const filled: string[] = [];
    for (const part of partsRef.current) {
      const lines = done.filter((s) => s.part === part.label);
      const box = part.field;
      if (!lines.length || !box.isConnected) continue;
      let value = box.value;
      for (const s of lines) value = appendWritten(value, s.wrote, s.math ? "math" : "prose", box instanceof HTMLInputElement);
      setFieldValue(box, value);
      showWritten(box);
      filled.push(part.label);
    }
    if (filled.length) {
      const last = partFor(filled[filled.length - 1])?.field;
      window.setTimeout(() => last?.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
      toast.success(t(filled.length > 1 ? "voice.addedMany" : "voice.added").replace("{parts}", joinLabels(filled, t("voice.and"))), { id: "voice-added" });
    } else if (done.length) {
      // No box on this question: the working is not lost.
      void navigator.clipboard?.writeText(done.map((s) => s.wrote).join("\n")).catch(() => {});
      toast(t("voice.copiedNoBox"), { id: "voice-added" });
    }
    close();
  };

  useImperativeHandle(ref, () => ({
    toggle: (from) => (open ? void stopAndWrite() : start(from)),
  }));

  // Leaving the page stops the microphone.
  useEffect(() => () => listener.current?.stop(), []);

  useEffect(() => {
    chainEnd.current?.scrollIntoView({ block: "nearest" });
  }, [steps]);

  if (!open) return null;

  const writing = steps.some((s) => s.state === "writing");
  const hearing = steps.some((s) => s.state === "live");
  const hasDone = steps.some((s) => s.state === "done");
  const several = parts.length > 1;
  const part = parts.find((p) => p.label === current);
  // A question without marked parts: its own words, from the page.
  const prompt = part?.prompt || questionContext(part?.field ?? null, scope.current).split("\n").find((l) => l.trim().length > 12) || "";

  /** Lower the overlay and bring the question's figure (or the question) into view. */
  const lookAtQuestion = () => {
    setPeek(true);
    const holder = (part?.field?.closest("[data-dictation-context]") as HTMLElement | null) ?? scope.current;
    const visual = holder?.querySelector<HTMLElement>("figure, table, img, svg, iframe, canvas, [data-figure]");
    (visual ?? holder)?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  if (peek) {
    // The page stays readable and scrollable; a small bar keeps the session in reach.
    return (
      <div
        role="dialog"
        aria-label={t("voice.title")}
        data-voice-ignore
        className="life-rise fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center gap-2 rounded-full bg-card py-2 pl-4 pr-2 shadow-[0_10px_30px_-12px_rgba(17,17,20,.45)] ring-1 ring-border">
          <span className={cn("size-2.5 shrink-0 rounded-full", listening ? "bg-rose-500 animate-pulse-dot motion-reduce:animate-none" : "bg-faint")} aria-hidden />
          <span className="text-ui font-extrabold" role="status">
            {t(writing ? "voice.writing" : hearing ? "voice.hearing" : listening ? "voice.listening" : "voice.paused")}
          </span>
          <button type="button" onClick={() => setPeek(false)} className="ml-1 flex h-10 items-center gap-1.5 rounded-full bg-muted px-3.5 text-[13.5px] font-bold hover:bg-[var(--edge)]">
            <ArrowUp className="size-4" aria-hidden />
            {t("voice.peekBack")}
          </button>
          {listening && (
            <button
              type="button"
              onClick={() => {
                setPeek(false);
                void stopAndWrite();
              }}
              aria-label={t("voice.stopAndWrite")}
              className="grid size-10 place-items-center rounded-full bg-rose-500 text-white"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const status = t(writing ? "voice.writing" : hearing ? "voice.hearing" : listening ? "voice.listening" : "voice.paused");
  const stemLong = stem.length > 260;
  // The part's own words, unless it is the whole question (one part, no separate stem).
  const partPrompt = !choices.length && prompt && prompt.replace(/\s+/g, " ").trim() !== stem ? prompt : "";
  /** Working lines are numbered; notes ("Now on part b", "Picked B") are not. */
  let n = 0;

  return (
    <>
    <div
      role="dialog"
      aria-label={t("voice.title")}
      data-voice-ignore
      className="life-rise fixed inset-x-0 bottom-0 top-[calc(max(0.5rem,env(safe-area-inset-top))+3rem)] z-50 flex flex-col bg-[color-mix(in_srgb,var(--card)_94%,transparent)] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:px-10"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        {/* The question being answered: the main stem with its givens first, the part being answered under it. */}
        <section aria-label={t("voice.answering")} className="rounded-[22px] bg-card px-4 py-3.5 shadow-[0_8px_24px_-16px_rgba(17,17,20,.35)] ring-1 ring-border">
          <div className="flex items-center gap-2">
            <p className="text-small font-bold text-muted-foreground">{t("voice.answering")}</p>
            {several && (
              <div className="ml-auto flex gap-1.5" role="radiogroup" aria-label={t("voice.parts")}>
                {parts.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    role="radio"
                    aria-checked={p.label === current}
                    onClick={() => switchTo(p.label, "tapped")}
                    className={cn(
                      "grid size-8 place-items-center rounded-full text-[13.5px] font-extrabold transition-colors",
                      p.label === current ? "bg-accent text-white" : "bg-muted text-foreground hover:bg-[var(--edge)]",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {stem && (
            <div className="mt-1.5">
              <div data-testid="voice-stem" className={cn("text-[15.5px] leading-snug text-foreground", stemLong && !stemOpen && "line-clamp-5")}>
                <MathText text={stem} />
              </div>
              {stemLong && (
                <button type="button" onClick={() => setStemOpen((o) => !o)} className={cn(playLink, "min-h-8 gap-1 text-[13px] no-underline text-muted-foreground")}>
                  <ChevronDown className={cn("size-3.5 transition-transform", stemOpen && "rotate-180")} aria-hidden />
                  {t(stemOpen ? "voice.showLess" : "voice.showMore")}
                </button>
              )}
            </div>
          )}
          {(partPrompt || (!stem && prompt)) && (
            <p
              key={current}
              data-testid="voice-part"
              className={cn(
                "life-rise flex gap-2.5 text-[17px] font-extrabold leading-snug text-foreground",
                stem ? "mt-2.5 rounded-2xl bg-accent-soft px-3.5 py-2.5 ring-1 ring-inset ring-accent/25" : "mt-1.5",
              )}
            >
              {several && <span className="shrink-0 text-accent">{current}</span>}
              <span className="min-w-0 line-clamp-4">
                <MathText text={partPrompt || prompt} />
              </span>
            </p>
          )}
          {choices.length > 0 && (
            // The options stay readable while the overlay is up: they are what the learner reads out.
            <ol className="mt-2.5 space-y-1.5" aria-label={t("voice.options")}>
              {choices.map((c, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-start gap-2.5 rounded-2xl px-2.5 py-1.5 text-[14.5px] leading-snug text-foreground",
                    picked === i ? "bg-accent-soft ring-2 ring-inset ring-accent" : "bg-muted",
                  )}
                >
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-extrabold", picked === i ? "bg-accent text-white" : "bg-card")}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="min-w-0 pt-0.5">
                    <MathText text={c} />
                  </span>
                </li>
              ))}
            </ol>
          )}
          {choices.length > 0 && <p className="mt-2 text-small font-semibold text-muted-foreground">{t("voice.choiceHow")}</p>}
          <button type="button" onClick={lookAtQuestion} className={cn(playLink, "mt-1 inline-flex min-h-9 items-center gap-1.5 text-[13.5px] no-underline")}>
            <Eye className="size-4" aria-hidden />
            {t("voice.peek")}
          </button>
          {several && (
            <p className="mt-1 text-small text-muted-foreground">
              {t("voice.howToSwitch").replace("{part}", parts.find((p) => p.label !== current)?.label ?? "")}
            </p>
          )}
        </section>

        {/* Listening, with Done and Edit right beside it. */}
        <div className="mt-3 flex min-h-11 items-center gap-2">
          <p className="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap text-ui font-extrabold" role="status">
            {writing ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <span className={cn("size-2.5 shrink-0 rounded-full", listening ? "bg-rose-500 animate-pulse-dot motion-reduce:animate-none" : "bg-faint")} aria-hidden />
            )}
            {status}
          </p>
          {hasDone && (
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              aria-pressed={editing}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-muted px-3.5 text-[13.5px] font-extrabold text-foreground hover:bg-[var(--edge)]"
            >
              {editing ? <Check className="size-4" aria-hidden /> : <Pencil className="size-3.5" aria-hidden />}
              {t(editing ? "voice.editDone" : "voice.edit")}
            </button>
          )}
          <button
            type="button"
            onClick={() => void stopAndWrite()}
            data-testid="voice-done"
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-extrabold text-white",
              listening ? "bg-rose-500" : "bg-accent",
            )}
          >
            {listening ? <Square className="size-3 fill-current" aria-hidden /> : <Check className="size-4" strokeWidth={3} aria-hidden />}
            {choices.length || !hasDone ? (
              t("voice.done")
            ) : (
              <>
                <span className="sm:hidden">{t("voice.done")}</span>
                <span className="max-sm:hidden">{t("voice.doneWrite")}</span>
              </>
            )}
          </button>
        </div>

        {/* A stop button kept beside a box on the right: the lines keep clear of it. */}
        <ol className={cn("mt-2 min-h-0 flex-1 space-y-3.5 overflow-y-auto", anchor && anchor.width < 80 && "pr-14")} aria-live="polite">
          {steps.length === 0 && <HowItWorks choice={choices.length > 0} />}
          {steps.map((s, i) => {
            const numbered = s.state !== "note";
            if (numbered) n++;
            return (
              <li
                key={s.id}
                ref={i === steps.length - 1 ? chainEnd : undefined}
                className={cn("grid grid-cols-[24px_1fr] gap-x-2.5", s.state === "undone" && "opacity-45")}
              >
                {numbered ? (
                  <span className="row-span-2 mt-0.5 grid size-6 place-items-center rounded-full bg-muted text-[12px] font-extrabold tabular-nums text-foreground">
                    {n}
                  </span>
                ) : (
                  <span className="row-span-2" />
                )}
                {s.said ? (
                  <span className="text-ui leading-snug text-foreground">
                    <Mic className="mr-1.5 inline size-3.5 -translate-y-px text-muted-foreground" aria-hidden />
                    {s.said}
                  </span>
                ) : (
                  <span />
                )}
                {s.state === "live" ? (
                  <span className="text-small text-muted-foreground">…</span>
                ) : s.state === "writing" ? (
                  <span className="text-small font-semibold text-muted-foreground">{t("voice.writing")}</span>
                ) : s.state === "note" ? (
                  s.wrote && <span className="text-small font-bold text-accent">{s.wrote}</span>
                ) : editing && s.state === "done" ? (
                  <input
                    aria-label={t("voice.editLine").replace("{n}", String(n))}
                    value={s.wrote}
                    onChange={(e) => updateSteps((list) => list.map((x) => (x.id === s.id ? { ...x, wrote: e.target.value } : x)))}
                    className="mt-1 h-11 w-full rounded-xl bg-muted px-3 text-[15px] text-foreground ring-inset focus:bg-card focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                ) : (
                  // What Scribe wrote is its reading of the words: labelled, and editable.
                  <span className="mt-1 flex flex-wrap items-baseline gap-x-2 border-l-2 border-accent/40 pl-2.5">
                    <span className="text-[11.5px] font-extrabold uppercase tracking-wide text-muted-foreground">{t("voice.writtenAs")}</span>
                    <span className={cn("text-[17px] leading-snug text-foreground [&_p]:m-0", s.state === "undone" && "line-through")}>
                      <MarkdownText text={s.wrote} />
                    </span>
                    {several && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-extrabold text-accent">→ {s.part}</span>}
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center">
          <button type="button" onClick={close} className={cn(playLink, "justify-self-start no-underline")}>
            {t("voice.cancel")}
          </button>
          {listening || hasDone ? (
            <button
              type="button"
              onClick={() => void stopAndWrite()}
              aria-label={t("voice.stopAndWrite")}
              className={cn(
                "grid size-[68px] place-items-center rounded-full text-white transition-transform active:translate-y-0.5 motion-reduce:transition-none",
                listening ? "bg-rose-500 shadow-[0_3px_0_#be123c]" : "bg-accent shadow-[0_3px_0_var(--accent-dim)]",
              )}
            >
              {listening ? <Square className="size-5 fill-current" /> : <Check className="size-7" strokeWidth={3} />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => startListening()}
              aria-label={t("voice.resume")}
              className="grid size-[68px] place-items-center rounded-full bg-accent text-white shadow-[0_3px_0_var(--accent-dim)]"
            >
              <Mic className="size-6" />
            </button>
          )}
          <button
            type="button"
            onClick={() => undo()}
            disabled={!hasDone}
            className={cn(playLink, "justify-self-end no-underline disabled:opacity-40")}
          >
            {t("voice.undo")}
          </button>
        </div>
        <p className="mt-1.5 text-center text-small text-muted-foreground">
          {steps.length === 0 || choices.length ? "" : listening ? t("voice.tip") : hasDone ? t("voice.tipPaused") : t("voice.hint")}
        </p>
      </div>
    </div>

      {/* The mic stays where it was tapped: the "Answer out loud" button becomes the stop button, in place (outside the rising overlay, so its position is the page's). */}
      {anchor && (
        <button
          type="button"
          onClick={() => void stopAndWrite()}
          data-testid="voice-anchor-stop"
          aria-label={t("voice.stopAndWrite")}
          style={{ top: anchor.top - 0, left: anchor.left, minWidth: anchor.width, height: anchor.height }}
          className={cn(
            "fixed z-[51] inline-flex items-center justify-center gap-2 rounded-full px-4 text-[14.5px] font-extrabold text-white shadow-[0_8px_20px_-8px_rgba(17,17,20,.5)]",
            listening ? "bg-rose-500" : "bg-accent",
          )}
        >
          {listening ? <Square className="size-3.5 fill-current" aria-hidden /> : <Check className="size-4" strokeWidth={3} aria-hidden />}
          {anchor.width > 60 && t(listening ? "voice.stop" : "voice.done")}
        </button>
      )}
    </>
  );
}
