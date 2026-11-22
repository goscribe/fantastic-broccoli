"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Loader2, Mic, Square, X } from "lucide-react";
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
  type VoiceTarget,
} from "@/lib/voice-scribe";
import { PlayPrimary, playField, playLink } from "@/components/session/play-ui";
import { toast } from "@/lib/toast";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/voice";
import { cn } from "@/lib/utils";

type Field = HTMLTextAreaElement | HTMLInputElement;

/** One write, so "scratch that" can put back what was there before it. */
type Step = { target: "notepad"; before: string } | { target: "answer"; field: Field; before: string };

const notepadKey = (id: string) => `scribe.voiceNotepad.${id}`;

function readNotepad(id: string): string {
  try {
    return window.localStorage.getItem(notepadKey(id)) ?? "";
  } catch {
    return "";
  }
}

/** The top-bar button that opens the voice scribe: the same round icon button as the bar's others. */
export function VoiceScribeTrigger({ active, onClick }: { active: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("voice.open")}
      title={t("voice.open")}
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

/**
 * Talk to write: one microphone for the whole page, not one per box. What
 * the learner says is written — as working in the notepad, or straight into
 * an answer box — with spoken maths turned into notation using the
 * question's own numbers ("add the oranges to the bananas" → 2 + 2 = 4).
 *
 * `scope` is the content the answer boxes and the question live in; the
 * notepad is kept per `storageId` on this device.
 */
export function VoiceScribe({
  open,
  onClose,
  scope,
  storageId,
}: {
  open: boolean;
  onClose: () => void;
  scope: RefObject<HTMLElement | null>;
  storageId: string;
}) {
  const { t, locale } = useI18n();
  const [target, setTarget] = useState<VoiceTarget>("notepad");
  const [notepad, setNotepadState] = useState("");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [pending, setPending] = useState(0);
  const [answerField, setAnswerField] = useState<Field | null>(null);
  // Re-render when the chosen box's text changes (it is shown in the sheet).
  const [, setAnswerTick] = useState(0);
  const [history, setHistory] = useState<Step[]>([]);

  const notepadRef = useRef(notepad);
  const targetRef = useRef(target);
  const answerRef = useRef<Field | null>(null);
  const lastFocused = useRef<Field | null>(null);
  const listener = useRef<Listener | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  // The notepad is per session, kept on this device.
  useEffect(() => {
    const saved = readNotepad(storageId);
    notepadRef.current = saved;
    setNotepadState(saved);
  }, [storageId]);
  const setNotepad = useCallback(
    (value: string) => {
      notepadRef.current = value;
      setNotepadState(value);
      try {
        if (value) window.localStorage.setItem(notepadKey(storageId), value);
        else window.localStorage.removeItem(notepadKey(storageId));
      } catch {
        /* private mode: the notepad lives for this visit only */
      }
    },
    [storageId],
  );

  // The box the learner last typed in is the one they mean, even with the sheet closed.
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const el = e.target as Element | null;
      if (isFillable(el) && scope.current?.contains(el) && !el.closest("[data-voice-ignore]")) lastFocused.current = el;
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, [scope]);

  const chooseAnswerField = useCallback((field: Field | null) => {
    answerRef.current?.removeAttribute("data-voice-target");
    answerRef.current = field;
    setAnswerField(field);
    if (field && targetRef.current === "answer") {
      field.setAttribute("data-voice-target", "");
      field.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, []);

  /** The chosen box, or a fresh pick when it left the page (the learner moved to the next question). */
  const currentAnswerField = useCallback((): Field | null => {
    const kept = answerRef.current;
    if (kept && kept.isConnected && isFillable(kept)) return kept;
    const focused = lastFocused.current;
    const next = focused && focused.isConnected && isFillable(focused) ? focused : defaultAnswerField(scope.current);
    chooseAnswerField(next);
    return next;
  }, [chooseAnswerField, scope]);

  // Opening, switching target, or the question changing under the sheet re-picks the box.
  useEffect(() => {
    if (!open) {
      answerRef.current?.removeAttribute("data-voice-target");
      return;
    }
    if (target !== "answer") {
      answerRef.current?.removeAttribute("data-voice-target");
      return;
    }
    const pick = () => {
      const field = currentAnswerField();
      if (field && !field.hasAttribute("data-voice-target")) field.setAttribute("data-voice-target", "");
    };
    pick();
    const root = scope.current;
    if (!root) return;
    const observer = new MutationObserver(() => {
      if (answerRef.current && !answerRef.current.isConnected) pick();
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [open, target, currentAnswerField, scope]);

  // The chosen box's text, kept in view when the learner types into it too.
  useEffect(() => {
    if (!answerField) return;
    const bump = () => setAnswerTick((n) => n + 1);
    answerField.addEventListener("input", bump);
    return () => answerField.removeEventListener("input", bump);
  }, [answerField]);

  // Phones: while writing into a box, tapping another box picks it without opening the keyboard.
  useEffect(() => {
    if (!open || target !== "answer") return;
    const root = scope.current;
    if (!root || !window.matchMedia("(pointer: coarse)").matches) return;
    const pick = (e: Event) => {
      const el = (e.target as Element | null)?.closest("textarea, input") ?? null;
      if (!isFillable(el) || el.closest("[data-voice-ignore]") || !answerFields(root).includes(el)) return;
      e.preventDefault();
      lastFocused.current = el;
      chooseAnswerField(el);
    };
    root.addEventListener("touchend", pick, { passive: false });
    return () => root.removeEventListener("touchend", pick);
  }, [open, target, scope, chooseAnswerField]);

  /** Write one phrase where it is going. Phrases run one after another so each sees the one before. */
  const handlePhrase = useCallback(
    (phrase: string) => {
      queue.current = queue.current.then(async () => {
        const into = targetRef.current;
        const field = into === "answer" ? currentAnswerField() : null;
        const writingTo = into === "answer" && field ? "answer" : "notepad";
        const before = writingTo === "answer" && field ? field.value : notepadRef.current;
        const write = (value: string) => {
          if (writingTo === "answer" && field) {
            setFieldValue(field, value);
            setHistory((h) => [...h, { target: "answer", field, before }]);
          } else {
            setNotepad(value);
            setHistory((h) => [...h, { target: "notepad", before }]);
          }
        };

        const command = spokenCommand(phrase);
        if (command === "undo") {
          undoRef.current();
          return;
        }
        if (command === "newline") {
          if (before && !before.endsWith("\n")) write(`${before}\n`);
          return;
        }

        setPending((n) => n + 1);
        try {
          const reply = await interpretSpeech({
            transcript: phrase,
            target: writingTo,
            question: questionContext(field ?? lastFocused.current ?? defaultAnswerField(scope.current), scope.current),
            written: writingTo === "answer" ? before : notepadRef.current,
          }).catch(() => ({ text: phrase, kind: "prose" as const, fallback: true }));
          if (reply.fallback) toast(t("voice.asSpoken"), { id: "voice-as-spoken" });
          // Re-read: the learner may have typed while the phrase was on its way.
          const now = writingTo === "answer" && field ? field.value : notepadRef.current;
          const singleLine = field instanceof HTMLInputElement;
          const next = appendWritten(now, reply.text, reply.kind, singleLine);
          if (next !== now) write(next);
        } finally {
          setPending((n) => n - 1);
        }
      });
    },
    [currentAnswerField, scope, setNotepad, t],
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      const last = h[h.length - 1];
      if (!last) return h;
      if (last.target === "answer") {
        if (last.field.isConnected) setFieldValue(last.field, last.before);
      } else {
        setNotepad(last.before);
      }
      return h.slice(0, -1);
    });
  }, [setNotepad]);
  const undoRef = useRef(undo);
  useEffect(() => {
    undoRef.current = undo;
  }, [undo]);

  const stop = useCallback(() => {
    listener.current?.stop();
    listener.current = null;
    setListening(false);
    setInterim("");
  }, []);

  const start = () => {
    if (!speechSupported()) {
      toast.error(t("voice.unsupported"), { id: "voice-unsupported" });
      return;
    }
    const l = listen({
      lang: recognitionLang(locale, typeof navigator === "undefined" ? [] : navigator.languages ?? []),
      onPhrase: handlePhrase,
      onInterim: setInterim,
      onError: (reason) => toast.error(t(reason === "denied" ? "voice.denied" : "voice.failed"), { id: "voice-error" }),
      onEnd: () => {
        listener.current = null;
        setListening(false);
        setInterim("");
      },
    });
    if (!l) {
      toast.error(t("voice.unsupported"), { id: "voice-unsupported" });
      return;
    }
    listener.current = l;
    setListening(true);
  };

  // Closing the sheet or leaving the page stops the microphone.
  useEffect(() => {
    if (!open) stop();
  }, [open, stop]);
  useEffect(() => () => listener.current?.stop(), []);

  const putInAnswerBox = () => {
    const field = currentAnswerField();
    const text = notepadRef.current.trim();
    if (!field || !text) return;
    const before = field.value;
    setFieldValue(field, before.trim() ? `${before.replace(/\s+$/, "")}\n${text}` : text);
    setHistory((h) => [...h, { target: "answer", field, before }]);
    toast.success(t("voice.copied"), { id: "voice-copied" });
  };

  if (!open) return null;

  const hasAnswerBox = answerFields(scope.current).length > 0;
  const writingToAnswer = target === "answer" && hasAnswerBox;

  return (
    <div
      role="dialog"
      aria-label={t("voice.title")}
      data-voice-ignore
      className="life-rise fixed inset-x-0 bottom-0 z-50 flex max-h-[60dvh] flex-col rounded-t-[22px] border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-18px_40px_-20px_rgba(0,0,0,0.35)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[400px] sm:rounded-[22px] sm:border"
    >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <p className="shrink-0 text-sm font-semibold">{t("voice.title")}</p>
        <div className="ml-1 flex flex-1 items-center gap-1" role="radiogroup">
          {(["notepad", "answer"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={target === id}
              onClick={() => setTarget(id)}
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                target === id ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {t(id === "notepad" ? "voice.toNotepad" : "voice.toAnswer")}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("voice.close")}
          className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {target === "answer" && !hasAnswerBox && <p className="text-ui text-muted-foreground">{t("voice.noAnswerBox")}</p>}

        {writingToAnswer ? (
          <>
            <p className="text-small font-semibold text-muted-foreground">{t("voice.answerHint")}</p>
            <p className="whitespace-pre-wrap rounded-[20px] bg-muted px-4 py-3.5 text-[16px] leading-relaxed text-foreground" aria-live="polite">
              {answerField?.value.trim() ? answerField.value : <span className="text-faint">{t("voice.answerEmpty")}</span>}
            </p>
          </>
        ) : (
          <label className="block">
            <span className="sr-only">{t("voice.notepadLabel")}</span>
            <textarea
              value={notepad}
              rows={5}
              onChange={(e) => setNotepad(e.target.value)}
              placeholder={t("voice.notepadPlaceholder")}
              className={cn(playField, "font-mono text-[15.5px]")}
            />
          </label>
        )}

        {listening || pending > 0 ? (
          <p className="flex min-h-6 items-center gap-2 text-ui font-semibold" role="status">
            {pending > 0 ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <span className="size-2.5 rounded-full bg-rose-500 animate-pulse-dot motion-reduce:animate-none" aria-hidden />
            )}
            <span className="min-w-0 flex-1 truncate">
              {interim ? <span className="italic text-muted-foreground">{interim}</span> : t(pending > 0 ? "voice.writing" : "voice.listening")}
            </span>
          </p>
        ) : (
          <div className="space-y-1">
            <p className="text-ui text-muted-foreground">{t("voice.hint")}</p>
            <p className="text-small text-faint">{t("voice.commands")}</p>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3">
        {listening ? (
          <PlayPrimary onClick={stop} className="sm:min-w-0">
            <Square className="mr-1.5 size-3.5 fill-current" />
            {t("voice.stop")}
          </PlayPrimary>
        ) : (
          <PlayPrimary onClick={start} className="sm:min-w-0">
            <Mic className="mr-1.5 size-4" />
            {t("voice.start")}
          </PlayPrimary>
        )}
        <div className="flex flex-wrap items-center gap-x-4">
          <button type="button" onClick={undo} disabled={history.length === 0} className={cn(playLink, "disabled:opacity-40")}>
            {t("voice.undo")}
          </button>
          {!writingToAnswer && (
            <button type="button" onClick={() => setNotepad("")} disabled={!notepad} className={cn(playLink, "disabled:opacity-40")}>
              {t("voice.clear")}
            </button>
          )}
          {!writingToAnswer && hasAnswerBox && (
            <button type="button" onClick={putInAnswerBox} disabled={!notepad.trim()} className={cn(playLink, "disabled:opacity-40")}>
              {t("voice.toAnswerBox")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
