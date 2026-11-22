"use client";

import { useEffect, useImperativeHandle, useRef, useState, type RefObject } from "react";
import { Check, ChevronDown, Loader2, Mic, Square } from "lucide-react";
import { interpretSpeech } from "@/lib/api/voice-scribe";
import {
  answerFields,
  appendWritten,
  defaultAnswerField,
  isFillable,
  listen,
  questionContext,
  recognitionLang,
  setFieldValue,
  speechSupported,
  spokenCommand,
  type Listener,
} from "@/lib/voice-scribe";
import { playLink } from "@/components/session/play-ui";
import { toast } from "@/lib/toast";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/voice";
import { cn } from "@/lib/utils";

type Field = HTMLTextAreaElement | HTMLInputElement;

/**
 * One line of the chain: what the learner said and what Scribe will write.
 * "live" is still being heard, "writing" is with the server, "undone" is
 * crossed out (kept, so the chain stays whole), "note" records a command.
 */
interface Step {
  id: number;
  said: string;
  wrote: string;
  math: boolean;
  state: "live" | "writing" | "done" | "undone" | "note";
}

/** The top-bar button: opens the overlay, and while it is open, stops and writes. */
export function VoiceScribeTrigger({ active, onClick }: { active: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t(active ? "voice.stopAndWrite" : "voice.open")}
      title={t(active ? "voice.stopAndWrite" : "voice.open")}
      aria-pressed={active}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-full hover:bg-muted hover:text-foreground",
        active ? "bg-accent-soft text-accent" : "text-muted-foreground",
      )}
    >
      <Mic className="size-4" />
    </button>
  );
}

/** Which box this is, for the chip ("Answer b"): the box's part label when the activity marks one. */
function fieldLabel(field: Field | null, scope: HTMLElement | null): string {
  if (!field) return "";
  const marked = field.closest("[data-dictation-label]")?.getAttribute("data-dictation-label");
  if (marked) return marked;
  const i = answerFields(scope).indexOf(field);
  return i >= 0 ? String(i + 1) : "";
}

/** What the page can ask of the voice scribe. */
export interface VoiceScribeHandle {
  /** Closed: open and start listening. Open: stop and write it in. */
  toggle: () => void;
}

/**
 * Talk to write: one microphone for the whole page, not one per box. While
 * the learner talks, a see-through overlay over the bottom of the screen
 * shows the whole chain — what they said, then what Scribe will write, with
 * spoken maths turned into notation using the question's own numbers
 * ("add the oranges to the bananas" → 2 + 2 = 4). Stopping puts the lines
 * into the answer box, the way typing would.
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
  const [field, setField] = useState<Field | null>(null);

  const stepsRef = useRef<Step[]>([]);
  const fieldRef = useRef<Field | null>(null);
  const lastFocused = useRef<Field | null>(null);
  const listener = useRef<Listener | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const nextId = useRef(1);
  const chainEnd = useRef<HTMLLIElement>(null);

  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange(next);
  };

  const updateSteps = (fn: (s: Step[]) => Step[]) => {
    stepsRef.current = fn(stepsRef.current);
    setSteps(stepsRef.current);
  };

  // The box the learner last typed in is the one they mean.
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const el = e.target as Element | null;
      if (isFillable(el) && scope.current?.contains(el) && !el.closest("[data-voice-ignore]")) lastFocused.current = el;
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, [scope]);

  /** Mark a box as the one words go into, and bring it up above the overlay. */
  const chooseField = (next: Field | null) => {
    fieldRef.current?.removeAttribute("data-voice-target");
    fieldRef.current = next;
    setField(next);
    if (!next) return;
    next.setAttribute("data-voice-target", "");
    // After the page's bottom padding has grown, so there is room to scroll.
    window.setTimeout(() => {
      const box = next.getBoundingClientRect();
      // Its bottom edge just above the overlay (which covers the lower 58%).
      const goal = window.innerHeight * 0.42 - 12;
      const holder = next.closest("[data-voice-scroll]") ?? document.scrollingElement;
      holder?.scrollBy({ top: box.bottom - goal, behavior: "smooth" });
    }, 220);
  };

  const currentField = (): Field | null => {
    const kept = fieldRef.current;
    if (kept && kept.isConnected && isFillable(kept)) return kept;
    const focused = lastFocused.current;
    const next = focused && focused.isConnected && isFillable(focused) ? focused : defaultAnswerField(scope.current);
    chooseField(next);
    return next;
  };

  const cycleField = () => {
    const fields = answerFields(scope.current);
    if (fields.length < 2) return;
    const at = fieldRef.current ? fields.indexOf(fieldRef.current) : -1;
    chooseField(fields[(at + 1) % fields.length]);
  };

  /** Cross out the last step still standing. */
  const undo = (said?: string) => {
    updateSteps((list) => {
      const last = [...list].reverse().find((s) => s.state === "done");
      let next = last ? list.map((s) => (s === last ? { ...s, state: "undone" as const } : s)) : list;
      if (said) {
        const n = last ? list.indexOf(last) + 1 : 0;
        next = [...next, { id: nextId.current++, said, wrote: n ? t("voice.crossedOut").replace("{n}", String(n)) : "", math: false, state: "note" }];
      }
      return next;
    });
  };

  /** One finished phrase: commands act at once, words go to the server in order. */
  const handlePhrase = (phrase: string) => {
    const command = spokenCommand(phrase);
    updateSteps((list) => list.filter((s) => s.state !== "live"));
    if (command === "undo") {
      undo(phrase);
      return;
    }
    const id = nextId.current++;
    if (command === "newline") {
      updateSteps((list) => [...list, { id, said: phrase, wrote: "↵", math: false, state: "note" }]);
      return;
    }
    updateSteps((list) => [...list, { id, said: phrase, wrote: "", math: false, state: "writing" }]);
    queue.current = queue.current.then(async () => {
      const box = currentField();
      // What is written so far: the box, then the steps waiting to go in.
      const pendingLines = stepsRef.current.filter((s) => s.state === "done").map((s) => s.wrote);
      const written = [box?.value ?? "", ...pendingLines].filter(Boolean).join("\n");
      const reply = await interpretSpeech({
        transcript: phrase,
        target: "answer",
        question: questionContext(box, scope.current),
        written,
      }).catch(() => ({ text: phrase, kind: "prose" as const, fallback: true }));
      if (reply.fallback) toast(t("voice.asSpoken"), { id: "voice-as-spoken" });
      const text = reply.text.trim();
      updateSteps((list) =>
        list.map((s) =>
          s.id !== id ? s : text ? { ...s, wrote: text, math: reply.kind === "math", state: "done" } : { ...s, wrote: "", state: "note" },
        ),
      );
    });
  };

  const onInterim = (text: string) => {
    updateSteps((list) => {
      const rest = list.filter((s) => s.state !== "live");
      return text ? [...rest, { id: -1, said: text, wrote: "", math: false, state: "live" }] : rest;
    });
  };

  // Recognition outlives renders; its callbacks reach the latest handlers through here.
  const handlers = useRef({ handlePhrase, onInterim, choose: chooseField });
  useEffect(() => {
    handlers.current = { handlePhrase, onInterim, choose: chooseField };
  });

  const stopListening = () => {
    listener.current?.stop();
    listener.current = null;
    setListening(false);
  };

  const startListening = () => {
    if (!speechSupported()) {
      toast.error(t("voice.unsupported"), { id: "voice-unsupported" });
      return false;
    }
    const l = listen({
      lang: recognitionLang(locale, typeof navigator === "undefined" ? [] : (navigator.languages ?? [])),
      onPhrase: (text) => handlers.current.handlePhrase(text),
      onInterim: (text) => handlers.current.onInterim(text),
      onError: (reason) => toast.error(t(reason === "denied" ? "voice.denied" : "voice.failed"), { id: "voice-error" }),
      onEnd: () => {
        listener.current = null;
        setListening(false);
      },
    });
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
    fieldRef.current?.removeAttribute("data-voice-target");
    fieldRef.current = null;
    setField(null);
    setOpen(false);
  };

  /** Open, pick the box, and listen: the learner tapped the mic to talk. */
  const start = () => {
    if (!startListening()) return;
    setOpen(true);
    currentField();
  };

  /** Stop: wait for the phrases still being written, then put the lines into the box. */
  const stopAndWrite = async () => {
    stopListening();
    await queue.current;
    const lines = stepsRef.current.filter((s) => s.state === "done");
    const box = currentField();
    if (lines.length && box) {
      let value = box.value;
      for (const s of lines) value = appendWritten(value, s.wrote, s.math ? "math" : "prose", box instanceof HTMLInputElement);
      setFieldValue(box, value);
      // A short box grows to show every line that went in.
      if (box instanceof HTMLTextAreaElement && box.scrollHeight > box.clientHeight) box.style.height = `${box.scrollHeight + 2}px`;
      box.removeAttribute("data-voice-flash");
      void box.offsetWidth;
      box.setAttribute("data-voice-flash", "");
      window.setTimeout(() => box.removeAttribute("data-voice-flash"), 1000);
      window.setTimeout(() => box.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
      const label = fieldLabel(box, scope.current);
      toast.success(
        t(lines.length === 1 ? "voice.addedOne" : "voice.addedMany").replace("{n}", String(lines.length)).replace("{box}", label),
        { id: "voice-added" },
      );
    } else if (lines.length) {
      // No box on this question: the working is not lost.
      void navigator.clipboard?.writeText(lines.map((s) => s.wrote).join("\n")).catch(() => {});
      toast(t("voice.copiedNoBox"), { id: "voice-added" });
    }
    close();
  };

  useImperativeHandle(ref, () => ({
    toggle: () => (open ? void stopAndWrite() : start()),
  }));

  // Phones: tapping a box picks it without opening the keyboard.
  useEffect(() => {
    if (!open) return;
    const root = scope.current;
    if (!root || !window.matchMedia("(pointer: coarse)").matches) return;
    const pick = (e: Event) => {
      const el = (e.target as Element | null)?.closest("textarea, input") ?? null;
      if (!isFillable(el) || !answerFields(root).includes(el)) return;
      e.preventDefault();
      lastFocused.current = el;
      handlers.current.choose(el);
    };
    root.addEventListener("touchend", pick, { passive: false });
    return () => root.removeEventListener("touchend", pick);
  }, [open, scope]);

  // Leaving the page stops the microphone.
  useEffect(() => () => listener.current?.stop(), []);

  useEffect(() => {
    chainEnd.current?.scrollIntoView({ block: "nearest" });
  }, [steps]);

  if (!open) return null;

  const writing = steps.some((s) => s.state === "writing");
  const hearing = steps.some((s) => s.state === "live");
  const label = fieldLabel(field, scope.current);
  const boxes = answerFields(scope.current).length;

  return (
    <div
      role="dialog"
      aria-label={t("voice.title")}
      data-voice-ignore
      className="life-rise fixed inset-x-0 bottom-0 z-50 flex h-[58dvh] flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 backdrop-blur-[2px] [background:linear-gradient(to_bottom,transparent,color-mix(in_srgb,var(--card)_80%,transparent)_16%,color-mix(in_srgb,var(--card)_86%,transparent)_70%,color-mix(in_srgb,var(--card)_94%,transparent))]"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
        <div className="mt-6 flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-ui font-extrabold" role="status">
            {writing ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <span className={cn("size-2.5 rounded-full", listening ? "bg-rose-500 animate-pulse-dot motion-reduce:animate-none" : "bg-faint")} aria-hidden />
            )}
            {t(writing ? "voice.writing" : hearing ? "voice.hearing" : listening ? "voice.listening" : "voice.paused")}
          </p>
          {field ? (
            <button
              type="button"
              onClick={cycleField}
              disabled={boxes < 2}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-[12px] font-extrabold text-foreground disabled:cursor-default"
            >
              {t("voice.into").replace("{box}", label)}
              {boxes > 1 && <ChevronDown className="size-3.5" aria-hidden />}
            </button>
          ) : (
            <span className="text-small font-semibold text-muted-foreground">{t("voice.noAnswerBox")}</span>
          )}
        </div>

        <ol className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto" aria-live="polite">
          {steps.length === 0 && <li className="text-ui text-muted-foreground">{t("voice.hint")}</li>}
          {steps.map((s, i) => (
            <li
              key={s.id}
              ref={i === steps.length - 1 ? chainEnd : undefined}
              className={cn("grid grid-cols-[22px_1fr] gap-x-2.5", s.state === "undone" && "opacity-45")}
            >
              <span className="row-span-2 mt-0.5 grid size-[22px] place-items-center rounded-full bg-muted text-[11px] font-extrabold tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <span className="text-small italic text-muted-foreground">
                <Mic className="mr-1 inline size-3 -translate-y-px not-italic" aria-hidden />“{s.said}”
              </span>
              {s.state === "live" ? (
                <span className="text-small text-faint">…</span>
              ) : s.state === "writing" ? (
                <span className="text-small font-semibold text-faint">{t("voice.writing")}</span>
              ) : s.state === "note" ? (
                s.wrote && <span className="text-small font-bold text-muted-foreground">{s.wrote}</span>
              ) : (
                <span className={cn("font-mono text-[16px] font-bold leading-snug text-foreground", s.state === "undone" && "line-through")}>
                  {s.wrote}
                </span>
              )}
            </li>
          ))}
        </ol>

        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center">
          <button type="button" onClick={close} className={cn(playLink, "justify-self-start no-underline")}>
            {t("voice.cancel")}
          </button>
          {listening || steps.some((s) => s.state === "done") ? (
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
            disabled={!steps.some((s) => s.state === "done")}
            className={cn(playLink, "justify-self-end no-underline disabled:opacity-40")}
          >
            {t("voice.undo")}
          </button>
        </div>
        <p className="mt-1.5 text-center text-small text-muted-foreground">
          {listening ? t("voice.tip") : steps.some((s) => s.state === "done") ? t("voice.tipPaused") : t("voice.hint")}
        </p>
      </div>
    </div>
  );
}
