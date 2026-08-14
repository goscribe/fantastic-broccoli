"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  assistExport,
  getArtifactsForExport,
  type ExportDoc,
} from "@/lib/api/study-session";
import {
  buildExportDoc,
  exportThemeById,
  exportThemeIds,
  exportThemes,
  stripAnswerLines,
} from "@/lib/export-doc";
import { MarkdownText } from "@/components/ui/markdown-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Printer,
  Sparkles,
  Trash2,
} from "lucide-react";

export default function ExportPage() {
  return (
    <Suspense fallback={null}>
      <ExportEditor />
    </Suspense>
  );
}

function ExportEditor() {
  const ids = (useSearchParams().get("ids") ?? "")
    .split(",")
    .filter(Boolean);
  const [docState, setDoc] = useState<ExportDoc | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [instruction, setInstruction] = useState("");
  const [assistNote, setAssistNote] = useState("");
  const [showAnswers, setShowAnswers] = useState(true);

  const { data: artifacts, isLoading } = useQuery({
    queryKey: ["export", ids.join(",")],
    queryFn: () => getArtifactsForExport(ids),
    enabled: ids.length > 0,
  });

  // Until the teacher makes an edit, the doc is derived from the artifacts.
  const doc = docState ?? (artifacts ? buildExportDoc(artifacts) : null);

  const assist = useMutation({
    mutationFn: (input: { instruction: string; doc: ExportDoc }) =>
      assistExport({ ...input, themeIds: exportThemeIds }),
    onSuccess: (result) => {
      setDoc({
        title: result.title,
        themeId: result.themeId,
        sections: result.sections,
      });
      setAssistNote(result.note);
      setInstruction("");
    },
  });

  if (ids.length === 0) {
    return (
      <main className="flex-1 px-6 py-10 text-center text-sm text-muted-foreground">
        Nothing selected — pick artifacts in the{" "}
        <Link href="/marketplace" className="text-accent underline">
          marketplace
        </Link>{" "}
        or a workspace bank first.
      </main>
    );
  }

  if (isLoading || !doc) {
    return (
      <main className="flex-1 px-6 py-6 md:px-10 space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  const theme = exportThemeById(doc.themeId);

  const updateSection = (
    index: number,
    patch: Partial<{ heading: string; body: string }>,
  ) =>
    setDoc({
      ...doc,
      sections: doc.sections.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    });

  return (
    <main className="flex-1 px-6 py-6 md:px-10">
      <div className="mx-auto max-w-4xl space-y-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => history.back()}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
              title="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                Export with Scribe
              </h1>
              <p className="text-xs text-muted-foreground">
                Edit anything, pick a theme, then print — Scribe branding
                included.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAnswers((v) => !v)}
              title={
                showAnswers
                  ? "Hide answers (student copy)"
                  : "Show answers (teacher copy)"
              }
            >
              {showAnswers ? (
                <Eye className="h-3.5 w-3.5 mr-1.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 mr-1.5" />
              )}
              {showAnswers ? "Answers shown" : "Answers hidden"}
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Print / Save PDF
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {exportThemes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setDoc({ ...doc, themeId: t.id })}
              className={cn(
                "flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-[11px] font-semibold transition-colors",
                t.swatch,
                doc.themeId === t.id
                  ? "ring-2 ring-accent ring-offset-1"
                  : "opacity-70 hover:opacity-100",
                t.id === "space" || t.id === "chalkboard"
                  ? "text-white"
                  : "text-neutral-800",
              )}
            >
              <span>{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>

        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            const q = instruction.trim();
            if (!q || assist.isPending) return;
            assist.mutate({ instruction: q, doc });
          }}
        >
          <Sparkles className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-accent" />
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Ask AI: “make it space themed and more fun”, “simplify question 2”…"
            className="h-10 w-full rounded-full border border-border bg-card pl-10 pr-28 text-[13px] outline-none transition-colors focus:border-accent"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!instruction.trim() || assist.isPending}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full"
          >
            {assist.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            )}
            Apply · 2 tokens
          </Button>
        </form>
        {assist.isError && (
          <p className="text-xs text-rose">
            AI edit failed — check your token balance and try again.
          </p>
        )}
        {assistNote && !assist.isPending && (
          <p className="text-xs text-accent-dim">
            <Sparkles className="mr-1 inline h-3 w-3" />
            {assistNote}
          </p>
        )}
      </div>

      {/* Themed printable sheet */}
      <div
        className={cn(
          "print-sheet mx-auto mt-5 max-w-4xl rounded-2xl border border-border p-8 shadow-sm print:mt-0 print:rounded-none print:border-0 print:shadow-none",
          theme.page,
        )}
      >
        <div className="print-watermark hidden" aria-hidden>
          <span>Scribe · scribe.study</span>
        </div>

        {/* Document header */}
        <header className="mb-8">
          <div className="mb-4 flex items-center justify-between gap-4 text-[11px] font-bold uppercase tracking-[0.18em] opacity-60">
            <span>{theme.emoji} Scribe study pack</span>
            <span>
              {new Date().toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <input
            value={doc.title}
            onChange={(e) => setDoc({ ...doc, title: e.target.value })}
            className={cn(
              "w-full bg-transparent pb-2 text-center text-3xl font-bold tracking-tight outline-none",
              theme.heading,
            )}
            aria-label="Document title"
          />
          <p className="mt-1 text-center text-xs font-semibold opacity-60">
            {doc.sections.length}{" "}
            {doc.sections.length === 1 ? "section" : "sections"} · made with
            Scribe · scribe.study
          </p>
          <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-3 text-sm font-semibold">
            <span className="flex flex-1 min-w-40 items-baseline gap-2">
              Name
              <span className="flex-1 border-b border-current/40" />
            </span>
            <span className="flex flex-1 min-w-32 items-baseline gap-2">
              Class
              <span className="flex-1 border-b border-current/40" />
            </span>
            <span className="flex flex-1 min-w-32 items-baseline gap-2">
              Date
              <span className="flex-1 border-b border-current/40" />
            </span>
          </div>
        </header>

        <div className="space-y-5">
          {doc.sections.map((section, i) => (
            <section
              key={i}
              className={cn(
                "overflow-hidden break-inside-avoid",
                theme.section,
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-between gap-2 px-4 py-2",
                  theme.sectionHeading,
                )}
              >
                <span className="shrink-0 text-sm font-bold opacity-60">
                  {i + 1}.
                </span>
                <input
                  value={section.heading}
                  onChange={(e) =>
                    updateSection(i, { heading: e.target.value })
                  }
                  className="w-full bg-transparent text-sm font-bold outline-none"
                  aria-label={`Section ${i + 1} heading`}
                />
                <div className="flex items-center gap-1 print:hidden">
                  <button
                    type="button"
                    title={editing === i ? "Done editing" : "Edit content"}
                    onClick={() => setEditing(editing === i ? null : i)}
                    className="flex h-6 w-6 items-center justify-center rounded opacity-60 hover:opacity-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {doc.sections.length > 1 && (
                    <button
                      type="button"
                      title="Remove section"
                      onClick={() =>
                        setDoc({
                          ...doc,
                          sections: doc.sections.filter((_, j) => j !== i),
                        })
                      }
                      className="flex h-6 w-6 items-center justify-center rounded opacity-60 hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="px-4 py-3 text-sm leading-6">
                {editing === i ? (
                  <textarea
                    value={section.body}
                    onChange={(e) => updateSection(i, { body: e.target.value })}
                    rows={Math.min(
                      24,
                      Math.max(6, section.body.split("\n").length + 2),
                    )}
                    className="w-full resize-y rounded-lg border border-border bg-white/70 p-3 font-mono text-[12px] leading-5 text-neutral-900 outline-none focus:border-accent"
                    aria-label={`Section ${i + 1} content`}
                  />
                ) : (
                  <MarkdownText
                    text={
                      showAnswers
                        ? section.body
                        : stripAnswerLines(section.body)
                    }
                  />
                )}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-10 flex items-center justify-between border-t border-current/20 pt-3 text-[10px] font-semibold uppercase tracking-widest opacity-50">
          <span>{doc.title}</span>
          <span>Made with Scribe — scribe.study</span>
        </footer>
      </div>
    </main>
  );
}
