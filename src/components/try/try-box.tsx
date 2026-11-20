"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ClipboardPaste, FileText, Loader2, PenLine, Upload } from "lucide-react";
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
  const primary =
    "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[15px] font-semibold text-white transition-colors hover:bg-accent-dim disabled:opacity-50";

  const options: { id: TrySource; label: string; icon: typeof Upload; desktopOnly?: boolean }[] = [
    { id: "topic", label: t("try.optTopic"), icon: PenLine },
    { id: "paste", label: t("try.optPaste"), icon: ClipboardPaste },
    { id: "pdf", label: t("try.optPdf"), icon: FileText, desktopOnly: true },
  ];

  if (blocked && blocked !== "captcha") {
    return (
      <div className={cn("w-full rounded-[22px] border border-border bg-white p-5 text-center shadow-[0_20px_50px_-30px_rgba(76,29,149,.35)] sm:p-6", className)} role="status">
        <Image src="/design/cat2-sleep.png" alt="" width={88} height={88} unoptimized className="mx-auto h-[76px] w-auto" />
        <h2 className="mt-2 text-[18px] font-bold tracking-tight">{t(blocked === "limit" ? "try.limitTitle" : "try.busyTitle")}</h2>
        <p className="mx-auto mt-1 max-w-sm text-[14px] leading-snug text-muted-foreground">{t(blocked === "limit" ? "try.limitBody" : "try.busyBody")}</p>
        <Link href="/signup" className={cn(primary, "mt-4")}>
          {t("try.createAccount")}
          <ArrowRight className="size-4" />
        </Link>
        <Link href="/login" className="mt-2 inline-flex min-h-10 items-center text-[13px] font-semibold text-accent-dim hover:underline">
          {t("try.haveAccount")}
        </Link>
      </div>
    );
  }

  return (
    <div className={cn("w-full rounded-[22px] border border-border bg-white p-4 text-left text-foreground shadow-[0_20px_50px_-30px_rgba(76,29,149,.35)] sm:p-5", className)}>
      {busy ? (
        <div className="flex min-h-[208px] flex-col items-center justify-center text-center" role="status" aria-live="polite">
          <Image src="/design/cat2-pencil.png" alt="" width={88} height={88} unoptimized className="cat-bob h-[76px] w-auto" />
          <p className="mt-3 flex items-center gap-2 text-[15px] font-semibold">
            <Loader2 className="size-4 animate-spin text-accent" />
            {t("try.building")}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("try.buildingHint")}</p>
        </div>
      ) : blocked === "captcha" ? (
        <div className="flex min-h-[208px] flex-col items-center justify-center text-center">
          <h2 className="text-[17px] font-bold">{t("try.captchaTitle")}</h2>
          <p className="mt-1 text-[13.5px] text-muted-foreground">{t("try.captchaBody")}</p>
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
          <div role="tablist" aria-label={t("try.optionsLabel")} className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1 sm:grid-cols-3">
            {options.map(({ id, label, icon: Icon, desktopOnly }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={mode === id}
                onClick={() => pickMode(id)}
                className={cn(
                  "min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-[13.5px] font-semibold transition-colors",
                  desktopOnly ? "hidden sm:inline-flex" : "inline-flex",
                  mode === id ? "bg-white text-accent shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
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
                  className="h-12 w-full rounded-xl border border-border bg-card px-3.5 text-[16px] text-foreground placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[12.5px] text-faint">{t("try.examplesLabel")}</span>
                  {EXAMPLES.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setTopic(t(key));
                        topicRef.current?.focus();
                      }}
                      className="inline-flex min-h-8 items-center rounded-full border border-border px-2.5 text-[12.5px] font-semibold text-muted-foreground hover:border-border-strong hover:text-foreground"
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
                <button type="submit" disabled={!topicReady(topic)} className={cn(primary, "mt-3")}>
                  {t("try.start")}
                  <ArrowRight className="size-4" />
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
                  className="max-h-[40dvh] min-h-[104px] w-full resize-y rounded-xl border border-border bg-card px-3.5 py-3 text-[16px] leading-relaxed text-foreground placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                />
                <p className="min-h-[18px] text-[12.5px] text-faint" aria-live="polite">
                  {pastedLength > TRY_PASTE_MAX
                    ? t("try.pasteTooLong")
                    : pastedLength > 0 && pastedLength < TRY_PASTE_MIN
                      ? t("try.pasteMore").replace("{count}", String(TRY_PASTE_MIN - pastedLength))
                      : ""}
                </p>
                <button type="submit" disabled={!pasteReady(pasted)} className={cn(primary, "mt-1")}>
                  {t("try.start")}
                  <ArrowRight className="size-4" />
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
                  "flex min-h-[168px] flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed px-6 py-6 text-center transition-colors",
                  dragging ? "border-accent bg-accent-soft/50" : "border-border",
                )}
              >
                <p className="text-[15px] font-semibold">{t("try.pdfDrop")}</p>
                <button type="button" onClick={() => fileRef.current?.click()} className={cn(primary, "h-11 w-auto")}>
                  <Upload className="size-4" />
                  {t("try.pdfChoose")}
                </button>
                <p className="text-[12.5px] text-faint">{t("try.pdfHint")}</p>
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
            <p role="alert" className="mt-2 text-center text-[13px] text-rose">
              {error}
            </p>
          )}
          <p className="mt-3 text-center text-[12.5px] text-faint">{t("try.footnote")}</p>
        </>
      )}
    </div>
  );
}
