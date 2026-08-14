"use client";

import {
  type ApiArtifactBankItem,
  type ApiArtifactKind,
} from "@/lib/api/study-session";
import { normalizeActivityContent } from "@/lib/api/activity-content";
import type {
  ActivityType,
  ClozeContent,
  McqContent,
  ReadingContent,
  WorksheetContent,
} from "@/types";
import { ReadingBody } from "@/components/session/reading-activity";
import {
  MarkdownText,
  useResolvedFigureUrl,
} from "@/components/ui/markdown-text";
import { cn } from "@/lib/utils";
import {
  FigureArt,
  FlashcardsArt,
  GuideArt,
  WorksheetArt,
} from "@/components/graphics/bank-art";

export const kindConfig: Record<
  ApiArtifactKind,
  { label: string; art: React.ElementType }
> = {
  WORKSHEET: { label: "Worksheet", art: WorksheetArt },
  MCQ_POOL: { label: "MCQ pool", art: WorksheetArt },
  FLASHCARD_DECK: { label: "Flashcards", art: FlashcardsArt },
  VOCAB_DECK: { label: "Vocab", art: FlashcardsArt },
  CLOZE_PASSAGE: { label: "Cloze", art: GuideArt },
  READING_CHUNK: { label: "Reading", art: GuideArt },
  FIGURE: { label: "Figure", art: FigureArt },
};

export const activityTypeFromKind: Record<ApiArtifactKind, ActivityType> = {
  WORKSHEET: "worksheet",
  MCQ_POOL: "mcq",
  FLASHCARD_DECK: "flashcard_review",
  VOCAB_DECK: "vocab_recall",
  CLOZE_PASSAGE: "cloze",
  READING_CHUNK: "reading",
  FIGURE: "reading",
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");

function RawJson({ content }: { content: Record<string, unknown> }) {
  return (
    <details className="group">
      <summary className="cursor-pointer text-[11px] font-semibold text-faint hover:text-muted-foreground">
        Raw JSON
      </summary>
      <pre className="mt-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground whitespace-pre-wrap max-h-72 overflow-y-auto">
        {JSON.stringify(content, null, 2)}
      </pre>
    </details>
  );
}

function WorksheetPreview({ content }: { content: WorksheetContent }) {
  return (
    <div className="space-y-3">
      {content.steps.map((step, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-3.5 py-2">
            <p className="text-xs font-semibold truncate">
              {step.title || `Question ${i + 1}`}
            </p>
            <span className="shrink-0 text-[10px] font-semibold text-faint tabular-nums">
              {step.parts.reduce((s, p) => s + (p.marks ?? 1), 0)} marks
            </span>
          </div>
          <div className="px-3.5 py-3 space-y-3">
            {step.intro && (
              <p className="text-[13px] leading-5 text-muted-foreground">
                <MarkdownText text={step.intro} />
              </p>
            )}
            {step.parts.map((part, j) => (
              <div key={j} className="flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5 text-[11px] font-bold text-accent-dim">
                  {part.label || `(${String.fromCharCode(97 + j)})`}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-5">
                    <MarkdownText text={part.prompt} />
                  </p>
                  {part.answer && (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      <span className="font-semibold text-energy">Answer:</span>{" "}
                      <MarkdownText text={part.answer} />
                    </p>
                  )}
                </div>
                {typeof part.marks === "number" && (
                  <span className="shrink-0 text-[10px] text-faint tabular-nums">
                    [{part.marks}]
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function McqPreview({ content }: { content: McqContent }) {
  return (
    <div className="space-y-3">
      {content.questions.map((q, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card px-3.5 py-3"
        >
          <p className="text-[13px] font-medium leading-5">
            <span className="text-faint mr-1.5">{i + 1}.</span>
            <MarkdownText text={q.question} />
          </p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {q.options.map((option, j) => (
              <p
                key={j}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs leading-5",
                  j === q.correctIndex
                    ? "border-energy/40 bg-energy/10 font-semibold"
                    : "border-border text-muted-foreground",
                )}
              >
                <span className="mr-1 font-semibold">
                  {String.fromCharCode(65 + j)}.
                </span>
                <MarkdownText text={option} />
              </p>
            ))}
          </div>
          {q.explanation && (
            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
              <MarkdownText text={q.explanation} />
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function DeckPreview({
  entries,
  frontLabel = "Question",
  backLabel = "Answer",
}: {
  entries: { front: string; back: string }[];
  frontLabel?: string;
  backLabel?: string;
}) {
  return (
    <div className="space-y-2">
      {entries.map((card, i) => (
        <div
          key={i}
          className="group rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/30 transition-colors"
        >
          <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-6">
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-faint">
                {frontLabel}
              </span>
              <p className="mt-0.5 text-sm font-semibold leading-6">
                <MarkdownText text={card.front} />
              </p>
            </div>
            <div className="min-w-0 sm:border-l sm:border-border sm:pl-6">
              <span className="text-[11px] font-medium text-faint">
                {backLabel}
              </span>
              <p className="mt-0.5 text-[13px] leading-6 text-muted-foreground">
                <MarkdownText text={card.back} />
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Renders a cloze passage with its blanks filled in as answer chips. */
function ClozePreview({ content }: { content: ClozeContent }) {
  return (
    <div className="space-y-3">
      {content.passages.map((passage, i) => {
        const segments = passage.textWithBlanks.split(/_{2,}|\{\{blank\}\}/g);
        return (
          <div
            key={i}
            className="rounded-xl border border-border bg-card px-3.5 py-3"
          >
            <p className="text-[13px] leading-6">
              {segments.map((segment, j) => (
                <span key={j}>
                  <MarkdownText text={segment} />
                  {j < segments.length - 1 && (
                    <span className="mx-0.5 rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent-dim">
                      {passage.answers[j] ?? "…"}
                    </span>
                  )}
                </span>
              ))}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function ReadingPreview({ content }: { content: ReadingContent }) {
  if (!content.text) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5">
      <ReadingBody content={content} />
    </div>
  );
}

function FigurePreview({ content }: { content: Record<string, unknown> }) {
  const url = useResolvedFigureUrl(str(content.url));
  const caption = str(content.caption ?? content.title);
  if (!url) return null;
  return (
    <figure className="rounded-xl border border-border overflow-hidden bg-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={caption || "Figure"} className="w-full" />
      {caption && (
        <figcaption className="px-3 py-2 text-[11px] text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/** The rendered inner content for a bank item, without any chrome. */
export function bankPreviewNode(
  kind: ApiArtifactKind,
  content: Record<string, unknown>,
): React.ReactNode {
  let preview: React.ReactNode = null;
  if (kind === "FIGURE") {
    preview = <FigurePreview content={content} />;
  } else {
    const normalized = normalizeActivityContent(
      activityTypeFromKind[kind],
      content,
    );
    switch (normalized.type) {
      case "worksheet":
        preview = <WorksheetPreview content={normalized} />;
        break;
      case "mcq":
        preview = <McqPreview content={normalized} />;
        break;
      case "flashcard_review":
        preview = <DeckPreview entries={normalized.cards} />;
        break;
      case "vocab_recall":
        preview = (
          <DeckPreview
            frontLabel="Term"
            backLabel="Definition"
            entries={normalized.terms.map((t) => ({
              front: t.term,
              back: t.definition,
            }))}
          />
        );
        break;
      case "cloze":
        preview = <ClozePreview content={normalized} />;
        break;
      case "reading":
        preview = <ReadingPreview content={normalized} />;
        break;
      default:
        preview = null;
    }
  }
  return preview;
}

export function BankContentPreview({
  kind,
  content,
}: {
  kind: ApiArtifactKind;
  content: Record<string, unknown>;
}) {
  const preview = bankPreviewNode(kind, content);
  return (
    <div className="space-y-3">
      {preview ?? (
        <p className="text-xs text-faint">No preview available for this item.</p>
      )}
      <RawJson content={content} />
    </div>
  );
}

/**
 * Docs-style paper thumbnail: the item's real content rendered small inside
 * a fixed-height "sheet", like a Google Docs grid tile.
 */
export function BankDocThumb({
  kind,
  content,
  className,
}: {
  kind: ApiArtifactKind;
  content: Record<string, unknown>;
  className?: string;
}) {
  const preview = bankPreviewNode(kind, content);
  return (
    <div
      aria-hidden
      className={cn(
        "relative shrink-0 overflow-hidden rounded-lg border border-border bg-background shadow-sm",
        className,
      )}
    >
      <div className="pointer-events-none w-[250%] origin-top-left scale-[0.4] select-none p-3">
        {preview ?? (
          <p className="text-xs text-faint">No preview available.</p>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}

/** Front/back pairs for flashcard and vocab decks, null for other kinds. */
export function deckEntries(item: ApiArtifactBankItem): {
  entries: { front: string; back: string }[];
  frontLabel: string;
  backLabel: string;
} | null {
  if (item.kind !== "FLASHCARD_DECK" && item.kind !== "VOCAB_DECK") return null;
  const normalized = normalizeActivityContent(
    activityTypeFromKind[item.kind],
    item.content,
  );
  if (normalized.type === "flashcard_review") {
    return {
      entries: normalized.cards,
      frontLabel: "Question",
      backLabel: "Answer",
    };
  }
  if (normalized.type === "vocab_recall") {
    return {
      entries: normalized.terms.map((t) => ({
        front: t.term,
        back: t.definition,
      })),
      frontLabel: "Term",
      backLabel: "Definition",
    };
  }
  return null;
}

export function bankItemSummary(item: ApiArtifactBankItem): string | null {
  if (item.kind === "FIGURE") {
    return str(item.content.caption ?? item.content.title) || null;
  }
  const normalized = normalizeActivityContent(
    activityTypeFromKind[item.kind],
    item.content,
  );
  switch (normalized.type) {
    case "worksheet": {
      const parts = normalized.steps.reduce((s, st) => s + st.parts.length, 0);
      return parts > 0 ? `${parts} question${parts === 1 ? "" : "s"}` : null;
    }
    case "mcq": {
      const count = normalized.questions.length;
      return count > 0 ? `${count} MCQ${count === 1 ? "" : "s"}` : null;
    }
    case "flashcard_review": {
      const count = normalized.cards.length;
      return count > 0 ? `${count} card${count === 1 ? "" : "s"}` : null;
    }
    case "vocab_recall": {
      const count = normalized.terms.length;
      return count > 0 ? `${count} term${count === 1 ? "" : "s"}` : null;
    }
    case "cloze": {
      const count = normalized.passages.reduce(
        (s, p) => s + p.answers.length,
        0,
      );
      return count > 0 ? `${count} blank${count === 1 ? "" : "s"}` : null;
    }
    case "reading": {
      const words = normalized.text.split(/\s+/).filter(Boolean).length;
      return words > 0 ? `${words} words` : null;
    }
    default:
      return null;
  }
}
