"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/try";
import { cn } from "@/lib/utils";
import {
  fileToBase64,
  rememberPendingTry,
  startTry,
  type TryAttempt,
  type TrySource,
  type TryStartInput,
} from "@/lib/api/anon";
import {
  pasteReady,
  topicReady,
  TRY_PASTE_MAX,
  TRY_PASTE_MIN,
  TRY_PDF_MAX_BYTES,
  TRY_TOPIC_MAX,
  tryMessage,
  tryRefusalOf,
  tryResultsPath,
  type TryRefusal,
} from "@/lib/try";
import { Turnstile, TURNSTILE_SITE_KEY } from "./turnstile";

type Blocked = "limit" | "busy" | "captcha";

const EXAMPLES = ["try.example1", "try.example2", "try.example3"] as const;

function blockedFor(refusal: TryRefusal): Blocked {
  if (refusal === "anon_captcha_required") return TURNSTILE_SITE_KEY ? "captcha" : "busy";
  return refusal === "anon_browser_limit" || refusal === "anon_ip_limit" ? "limit" : "busy";
}

/**
 * "Try before signing up": type a topic, paste notes or (desktop) drop a
 * PDF, and get a real Quick 5 with no account. Lives in the landing hero and
 * on the ad/tool landing pages; opens the quiz at /try/<id>.
 */
export function TryBox({
  defaultMode = "topic",
  landing,
  className,
}: {
  defaultMode?: TrySource;
  /** Landing slug the visitor came in on (stored with the attempt for funnel reads). */
  landing?: string;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<TrySource>(defaultMode);
  const [topic, setTopic] = useState("");
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [dragging, setDragging] = useState(false);
  const pending = useRef<TryStartInput | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const topicRef = useRef<HTMLInputElement>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  // PDF drop is a desktop path; phones that land on a PDF page start on paste.
  useEffect(() => {
    if (defaultMode === "pdf" && typeof window.matchMedia === "function" && !window.matchMedia("(min-width: 640px)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off viewport adjustment after hydration
      setMode("paste");
    }
  }, [defaultMode]);

  const pickMode = (next: TrySource) => {
    setMode(next);
    setError(null);
    requestAnimationFrame(() => {
      if (next === "topic") topicRef.current?.focus();
      if (next === "paste") pasteRef.current?.focus();
    });
  };

  const submit = async (input: TryStartInput) => {
    if (busy) return;
    pending.current = input;
    setBusy(true);
    setError(null);
    try {
      const started = await startTry({ ...input, locale, ...(landing ? { landing } : {}) });
      const view: TryAttempt = {
        id: started.attemptId,
        title: started.title,
        source: input.source,
        questions: started.questions,
        answers: started.questions.map(() => null),
        correct: null,
        total: started.questions.length,
        finished: false,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
        claimed: null,
      };
      // The quiz page opens instantly from this; it refetches in the background.
      queryClient.setQueryData(["try", started.attemptId], view);
      rememberPendingTry(started.attemptId);
      router.push(tryResultsPath(started.attemptId));
    } catch (err) {
      setBusy(false);
      const message = err instanceof Error ? err.message : "";
      const refusal = tryRefusalOf(message);
      if (refusal) setBlocked(blockedFor(refusal));
      else setError(message ? tryMessage(message) : t("try.errorStart"));
    }
  };

  const startPdf = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      setError(t("try.pdfNotPdf"));
      return;
    }
    if (file.size > TRY_PDF_MAX_BYTES) {
      setError(t("try.pdfTooBig"));
      return;
    }
    const pdfBase64 = await fileToBase64(file).catch(() => null);
    if (!pdfBase64) {
      setError(t("try.pdfNotPdf"));
      return;
    }
    void submit({ source: "pdf", pdfBase64, fileName: file.name.slice(0, 200) });
  };

  const pastedLength = pasted.trim().length;
  // The one purple thing in the box: the same chunky button as the session player's.
  const primary =
    "btn-chunky inline-flex h-[52px] w-full touch-manipulation items-center justify-center rounded-[var(--r-button)] bg-accent px-6 text-[16px] font-extrabold text-white transition-colors hover:bg-accent-dim disabled:opacity-40 disabled:shadow-none";
  const quietLink =
    "inline-flex min-h-11 items-center text-[14px] font-bold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground";
  // A place to type: a soft fill, a ring once focused (as in the session player).
  const field =
    "w-full rounded-[20px] bg-muted px-4 text-[16px] text-foreground ring-inset transition-[background-color,box-shadow] duration-150 placeholder:text-faint focus:bg-card focus:outline-none focus:ring-2 focus:ring-accent motion-reduce:transition-none";

  const options: { id: TrySource; label: string; desktopOnly?: boolean }[] = [
    { id: "topic", label: t("try.optTopic") },
    { id: "paste", label: t("try.optPaste") },
    { id: "pdf", label: t("try.optPdf"), desktopOnly: true },
  ];

  if (blocked && blocked !== "captcha") {
    return (
      // The section's own cat sits right above the box, so the message needs no second one.
      <div className={cn("app-brand w-full border-t border-border pt-6 text-center text-foreground", className)} role="status">
        <h2 className="text-[22px] font-extrabold leading-tight tracking-tight">{t(blocked === "limit" ? "try.limitTitle" : "try.busyTitle")}</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-[15px] font-semibold leading-snug text-muted-foreground">{t(blocked === "limit" ? "try.limitBody" : "try.busyBody")}</p>
        <Link href="/signup" className={cn(primary, "mt-5")}>
          {t("try.createAccount")}
        </Link>
        <Link href="/login" className={cn(quietLink, "mt-2")}>
          {t("try.haveAccount")}
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("app-brand w-full text-left text-foreground", className)}>
      {busy ? (
        <div className="flex min-h-[176px] flex-col items-center justify-center text-center" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-[17px] font-extrabold">
            <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />
            {t("try.building")}
          </p>
          <p className="mt-1 text-[14px] font-semibold text-muted-foreground">{t("try.buildingHint")}</p>
        </div>
      ) : blocked === "captcha" ? (
        <div className="flex min-h-[208px] flex-col items-center justify-center text-center">
          <h2 className="text-[20px] font-extrabold tracking-tight">{t("try.captchaTitle")}</h2>
          <p className="mt-1 text-[14.5px] font-semibold text-muted-foreground">{t("try.captchaBody")}</p>
          <div className="mt-3">
            <Turnstile
              onToken={(captchaToken) => {
                setBlocked(null);
                if (pending.current) void submit({ ...pending.current, captchaToken });
              }}
              onError={() => setBlocked("busy")}
            />
          </div>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label={t("try.optionsLabel")} className="grid grid-cols-2 gap-1 rounded-[var(--r-button)] bg-muted p-1 sm:grid-cols-3">
            {options.map(({ id, label, desktopOnly }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => pickMode(id)}
                className={cn(
                  "min-h-11 touch-manipulation items-center justify-center rounded-[var(--r-control)] px-2 text-[14px] font-bold transition-colors",
                  desktopOnly ? "hidden sm:inline-flex" : "inline-flex",
                  mode === id ? "bg-card text-foreground shadow-[var(--card-shadow)]" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3">
            {mode === "topic" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (topicReady(topic)) void submit({ source: "topic", topic: topic.trim() });
                  else topicRef.current?.focus();
                }}
              >
                <label htmlFor="try-topic" className="sr-only">
                  {t("try.topicLabel")}
                </label>
                <input
                  ref={topicRef}
                  id="try-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  maxLength={TRY_TOPIC_MAX}
                  autoComplete="off"
                  enterKeyHint="go"
                  placeholder={t("try.topicPlaceholder")}
                  className={cn(field, "h-[52px]")}
                />
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-muted-foreground">{t("try.examplesLabel")}</span>
                  {EXAMPLES.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setTopic(t(key));
                        topicRef.current?.focus();
                      }}
                      className="inline-flex min-h-9 touch-manipulation items-center rounded-full bg-muted px-3 text-[13px] font-bold text-foreground transition-colors hover:bg-[var(--edge)]"
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
                <button type="submit" disabled={!topicReady(topic)} className={cn(primary, "mt-4")}>
                  {t("try.start")}
                </button>
              </form>
            )}

            {mode === "paste" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (pasteReady(pasted)) void submit({ source: "paste", text: pasted });
                  else pasteRef.current?.focus();
                }}
              >
                <label htmlFor="try-paste" className="sr-only">
                  {t("try.pasteLabel")}
                </label>
                <textarea
                  ref={pasteRef}
                  id="try-paste"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  rows={4}
                  placeholder={t("try.pastePlaceholder")}
                  className={cn(field, "max-h-[40dvh] min-h-[112px] resize-y py-3.5 leading-relaxed")}
                />
                <p className="min-h-[20px] px-1 text-[13px] font-semibold text-muted-foreground" aria-live="polite">
                  {pastedLength > TRY_PASTE_MAX
                    ? t("try.pasteTooLong")
                    : pastedLength > 0 && pastedLength < TRY_PASTE_MIN
                      ? t("try.pasteMore").replace("{count}", String(TRY_PASTE_MIN - pastedLength))
                      : ""}
                </p>
                <button type="submit" disabled={!pasteReady(pasted)} className={cn(primary, "mt-2")}>
                  {t("try.start")}
                </button>
              </form>
            )}

            {mode === "pdf" && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void startPdf(e.dataTransfer.files[0]);
                }}
                className={cn(
                  "flex min-h-[176px] flex-col items-center justify-center gap-3 rounded-[20px] px-6 py-6 text-center ring-inset transition-[background-color,box-shadow]",
                  dragging ? "bg-card ring-2 ring-accent" : "bg-muted",
                )}
              >
                <p className="text-[16px] font-extrabold">{t("try.pdfDrop")}</p>
                <button type="button" onClick={() => fileRef.current?.click()} className={cn(primary, "w-auto")}>
                  {t("try.pdfChoose")}
                </button>
                <p className="text-[13px] font-semibold text-muted-foreground">{t("try.pdfHint")}</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    void startPdf(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-3 text-center text-[13.5px] font-bold text-rose-800">
              {error}
            </p>
          )}
          <p className="mt-3 text-center text-[13px] font-semibold text-muted-foreground">{t("try.footnote")}</p>
        </>
      )}
    </div>
  );
}
