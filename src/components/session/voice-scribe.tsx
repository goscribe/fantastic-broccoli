"use client";

import { useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { Check, Loader2, Mic, Square, X } from "lucide-react";
import { Mascot } from "@/components/rewards/mascot";
import { interpretSpeech } from "@/lib/api/voice-scribe";
import {
  answerParts,
  appendWritten,
  isFillable,
  listen,
  questionContext,
  recognitionLang,
  setFieldValue,
  speechSupported,
  spokenCommand,
  spokenSwitch,
  type AnswerPart,
  type Listener,
} from "@/lib/voice-scribe";
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

/** Before the learner says anything: the cat explains the three steps in a speech bubble. */
function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    { n: 1, body: <>{t("voice.how1")} <span className="italic text-muted-foreground">{t("voice.how1Example")}</span></> },
    { n: 2, body: <>{t("voice.how2")} <span className="font-semibold"><MathText text="$2 + 2 = 4$" /></span></> },
    { n: 3, body: <>{t("voice.how3")}</> },
  ];
  return (
    <li className="flex items-start gap-3">
      <Mascot pose="think" className="mt-3 h-16 shrink-0" />
      <div className="relative min-w-0 flex-1 rounded-[22px] border border-border bg-card px-4 py-3.5 shadow-[0_8px_24px_-16px_rgba(17,17,20,.35)]">
        <span aria-hidden className="absolute -left-[7px] top-8 size-3 rotate-45 border-b border-l border-border bg-card" />
        <p className="text-ui font-extrabold text-foreground">{t("voice.howTitle")}</p>
        <ol className="mt-2 space-y-2">
          {steps.map((s) => (
            <li key={s.n} className="flex gap-2.5 text-ui leading-snug text-foreground">
              <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-extrabold text-accent">{s.n}</span>
              <span className="min-w-0">{s.body}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2.5 text-small text-muted-foreground">{t("voice.howUndo")}</p>
      </div>
    </li>
  );
}

/** What the page can ask of the voice scribe. */
export interface VoiceScribeHandle {
  /** Closed: open and start listening. Open: stop and write it in. */
  toggle: () => void;
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
  const [parts, setParts] = useState<AnswerPart[]>([]);
  const [current, setCurrentState] = useState("");

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
      const text = reply.text.trim();
      updateSteps((list) =>
        list.map((s) =>
          s.id !== id
            ? s
            : text
              ? { ...s, wrote: text, math: reply.kind === "math", part: moved || s.part, state: "done" }
              : { ...s, wrote: "", state: "note" },
        ),
      );
      if (moved) switchTo(moved, "heard");
    });
  };

  /** One finished phrase: switches and commands act at once; the rest is working. */
  const handlePhrase = (phrase: string) => {
    updateSteps((list) => list.filter((s) => s.state !== "live"));
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
      return text ? [...rest, { id: -1, said: text, wrote: "", math: false, part: currentRef.current, state: "live" }] : rest;
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
    setOpen(false);
  };

  /** Open on the part the learner is on: the box they last typed in, else the first one still empty. */
  const start = () => {
    const found = answerParts(scope.current);
    partsRef.current = found;
    setParts(found);
    const focused = found.find((p) => p.field === lastFocused.current && p.field.isConnected);
    setCurrent((focused ?? found.find((p) => !p.field.value.trim()) ?? found[0])?.label ?? "");
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
    toggle: () => (open ? void stopAndWrite() : start()),
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

  return (
    <div
      role="dialog"
      aria-label={t("voice.title")}
      data-voice-ignore
      className="life-rise fixed inset-x-0 bottom-0 top-[calc(max(0.5rem,env(safe-area-inset-top))+3rem)] z-50 flex flex-col bg-[color-mix(in_srgb,var(--card)_88%,transparent)] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:px-10"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        {/* The question being answered, up top; the parts to move between beside it. */}
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
          <p key={current} className="life-rise mt-1.5 flex gap-2.5 text-[17px] font-extrabold leading-snug text-foreground">
            {several && <span className="shrink-0 text-accent">{current}</span>}
            <span className="min-w-0 line-clamp-4">
              <MathText text={prompt} />
            </span>
          </p>
          {several && (
            <p className="mt-2 text-small text-muted-foreground">
              {t("voice.howToSwitch").replace("{part}", parts.find((p) => p.label !== current)?.label ?? "")}
            </p>
          )}
        </section>

        <p className="mt-4 flex items-center gap-2 text-ui font-extrabold" role="status">
          {writing ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <span className={cn("size-2.5 rounded-full", listening ? "bg-rose-500 animate-pulse-dot motion-reduce:animate-none" : "bg-faint")} aria-hidden />
          )}
          {t(writing ? "voice.writing" : hearing ? "voice.hearing" : listening ? "voice.listening" : "voice.paused")}
        </p>

        <ol className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto" aria-live="polite">
          {steps.length === 0 && <HowItWorks />}
          {steps.map((s, i) => (
            <li
              key={s.id}
              ref={i === steps.length - 1 ? chainEnd : undefined}
              className={cn("grid grid-cols-[22px_1fr] gap-x-2.5", s.state === "undone" && "opacity-45")}
            >
              <span className="row-span-2 mt-0.5 grid size-[22px] place-items-center rounded-full bg-muted text-[11px] font-extrabold tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              {s.said ? (
                <span className="text-small italic text-muted-foreground">
                  <Mic className="mr-1 inline size-3 -translate-y-px" aria-hidden />“{s.said}”
                </span>
              ) : (
                <span />
              )}
              {s.state === "live" ? (
                <span className="text-small text-faint">…</span>
              ) : s.state === "writing" ? (
                <span className="text-small font-semibold text-faint">{t("voice.writing")}</span>
              ) : s.state === "note" ? (
                s.wrote && <span className="text-small font-bold text-accent">{s.wrote}</span>
              ) : (
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className={cn("text-[17px] leading-snug text-foreground [&_p]:m-0", s.state === "undone" && "line-through")}>
                    <MarkdownText text={s.wrote} />
                  </span>
                  {several && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-extrabold text-accent">→ {s.part}</span>}
                </span>
              )}
            </li>
          ))}
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
          {steps.length === 0 ? "" : listening ? t("voice.tip") : hasDone ? t("voice.tipPaused") : t("voice.hint")}
        </p>
      </div>
    </div>
  );
}
