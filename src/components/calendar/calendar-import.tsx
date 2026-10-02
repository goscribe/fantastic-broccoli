"use client";

import { useRef, useState } from "react";
import { AlertCircle, ChevronDown, FileUp, Loader2, Lock, Sparkles } from "lucide-react";
import { TrackedButton } from "@/components/ui/tracked-button";
import { screenProps } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/calendar";

function GoogleCalendarGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <rect x="3" y="4" width="18" height="17" rx="3" fill="#fff" stroke="#4285F4" strokeWidth="1.6" />
      <path d="M3 8.5h18" stroke="#4285F4" strokeWidth="1.6" />
      <path d="M8 2.5v3M16 2.5v3" stroke="#EA4335" strokeWidth="1.6" strokeLinecap="round" />
      <text x="12" y="17.6" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#34A853">
        31
      </text>
    </svg>
  );
}

const HELP = [
  ["cal.help.google", "cal.help.googleBody"],
  ["cal.help.apple", "cal.help.appleBody"],
  ["cal.help.outlook", "cal.help.outlookBody"],
  ["cal.help.school", "cal.help.schoolBody"],
] as const;

export function CalendarImport({
  busy,
  error,
  onFiles,
  onSample,
  compact = false,
}: {
  busy: boolean;
  error: string | null;
  onFiles: (files: File[]) => void;
  onSample: () => void;
  /** Re-import from the calendar view: just the drop zone. */
  compact?: boolean;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length > 0) onFiles(files);
  };

  const dropZone = (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!busy) pick(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 text-center transition-colors",
        compact ? "py-6" : "py-10",
        dragging ? "border-accent bg-accent-soft" : "border-border-strong bg-muted/30",
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-card text-accent shadow-sm">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
      </span>
      <p className="mt-3 text-sm font-semibold">
        {busy ? t("cal.import.reading") : t("cal.import.drop")}
      </p>
      {!busy && (
        <>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("cal.import.or")}</p>
          <TrackedButton
            ctaId="calendar_choose_file"
            ctaPosition="primary"
            size="sm"
            className="mt-2"
            onClick={() => input.current?.click()}
          >
            {t("cal.import.choose")}
          </TrackedButton>
          <p className="mt-2.5 text-[11px] text-faint">{t("cal.import.formats")}</p>
        </>
      )}
      <input
        ref={input}
        type="file"
        multiple
        accept=".ics,.ical,.ifb,.icalendar,.zip,text/calendar,application/zip"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );

  const errorBox = error && (
    <p
      role="alert"
      className="mt-3 flex items-start gap-2 rounded-xl border border-rose/40 bg-rose/10 px-3 py-2.5 text-sm"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose" />
      {error}
    </p>
  );

  if (compact) {
    return (
      <div {...screenProps("calendar_reimport")}>
        {dropZone}
        {errorBox}
      </div>
    );
  }

  return (
    <div {...screenProps("calendar_import")} className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-base font-semibold">{t("cal.import.title")}</h2>
        <div className="mt-4">{dropZone}</div>
        {errorBox}
        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          {t("cal.import.privacy")}
        </p>
      </section>

      <div className="space-y-4">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2.5">
            <GoogleCalendarGlyph />
            <p className="text-sm font-semibold">{t("cal.google.title")}</p>
            <span className="ml-auto shrink-0 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {t("cal.google.soon")}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("cal.google.body")}</p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <p className="text-sm font-semibold">{t("cal.import.sample")}</p>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            {t("cal.import.sampleHint")}
          </p>
          <TrackedButton
            ctaId="calendar_try_sample"
            ctaPosition="secondary"
            size="sm"
            variant="outline"
            className="mt-3"
            disabled={busy}
            onClick={onSample}
          >
            {t("cal.import.sample")}
          </TrackedButton>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
        <p className="text-sm font-semibold">{t("cal.help.title")}</p>
        <div className="mt-2 divide-y divide-border">
          {HELP.map(([title, body]) => (
            <details key={title} className="group py-2.5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-medium">
                {t(title)}
                <ChevronDown className="h-4 w-4 text-faint transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{t(body)}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
