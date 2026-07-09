"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWorkspace } from "@/lib/api/workspace";
import {
  studySessionApi,
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
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListRowsSkeleton, Skeleton } from "@/components/ui/skeleton";
import { MarkdownText } from "@/components/ui/markdown-text";
import { formatRelativeDate, cn } from "@/lib/utils";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  FileQuestion,
  Image as ImageIcon,
  Layers,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";

const kindConfig: Record<
  ApiArtifactKind,
  { label: string; icon: React.ElementType }
> = {
  WORKSHEET: { label: "Worksheet", icon: FileQuestion },
  MCQ_POOL: { label: "MCQ pool", icon: FileQuestion },
  FLASHCARD_DECK: { label: "Flashcards", icon: WalletCards },
  VOCAB_DECK: { label: "Vocab", icon: WalletCards },
  CLOZE_PASSAGE: { label: "Cloze", icon: BookOpen },
  READING_CHUNK: { label: "Reading", icon: BookOpen },
  FIGURE: { label: "Figure", icon: ImageIcon },
};

type BankFamily = "worksheets" | "flashcards" | "guides" | "figures";

const familyOfKind: Record<ApiArtifactKind, BankFamily> = {
  WORKSHEET: "worksheets",
  MCQ_POOL: "worksheets",
  FLASHCARD_DECK: "flashcards",
  VOCAB_DECK: "flashcards",
  CLOZE_PASSAGE: "guides",
  READING_CHUNK: "guides",
  FIGURE: "figures",
};

const familyConfig: Record<
  BankFamily,
  { label: string; icon: React.ElementType; blurb: string }
> = {
  worksheets: {
    label: "Worksheets & quizzes",
    icon: FileQuestion,
    blurb: "Exam-style worksheets and MCQ pools.",
  },
  flashcards: {
    label: "Flashcard sets",
    icon: WalletCards,
    blurb: "Flashcard and vocabulary decks.",
  },
  guides: {
    label: "Study guides",
    icon: BookOpen,
    blurb: "Readings and cloze passages.",
  },
  figures: {
    label: "Figures",
    icon: ImageIcon,
    blurb: "Diagrams and images from your materials.",
  },
};

const familyOrder: BankFamily[] = [
  "worksheets",
  "flashcards",
  "guides",
  "figures",
];

const UNTAGGED_TOPIC = "General";

const str = (v: unknown): string => (typeof v === "string" ? v : "");

const activityTypeFromKind: Record<ApiArtifactKind, ActivityType> = {
  WORKSHEET: "worksheet",
  MCQ_POOL: "mcq",
  FLASHCARD_DECK: "flashcard_review",
  VOCAB_DECK: "vocab_recall",
  CLOZE_PASSAGE: "cloze",
  READING_CHUNK: "reading",
  FIGURE: "reading",
};

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
          className="rounded-xl border border-border bg-background overflow-hidden"
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
                <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center">
                  {part.label || String.fromCharCode(97 + j)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] leading-5">
                    <MarkdownText text={part.prompt} />
                  </p>
                  {part.answer && (
                    <p className="mt-1 text-[11px] text-accent-dim">
                      Answer: {part.answer}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-[10px] font-semibold text-faint tabular-nums">
                  [{part.marks ?? 1}]
                </span>
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
      {content.questions.map((question, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-background px-3.5 py-3 space-y-2"
        >
          <p className="text-[13px] font-medium leading-5">
            <MarkdownText text={question.question} />
          </p>
          <ul className="space-y-1">
            {question.options.map((option, j) => {
              const correct = j === question.correctIndex;
              return (
                <li
                  key={j}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-xs leading-5",
                    correct
                      ? "border-accent/40 bg-accent-soft/60 font-medium text-accent-dim"
                      : "border-border/60 text-muted-foreground",
                  )}
                >
                  <span className="mt-0.5 shrink-0 text-[10px] font-bold">
                    {String.fromCharCode(65 + j)}
                  </span>
                  <span className="flex-1 min-w-0">{option}</span>
                  {correct && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                </li>
              );
            })}
          </ul>
          {question.explanation && (
            <p className="text-[11px] leading-4 text-faint">
              <MarkdownText text={question.explanation} />
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function DeckPreview({
  entries,
}: {
  entries: { front: string; back: string }[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {entries.map((card, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-background overflow-hidden"
        >
          <p className="px-3 py-2 text-[13px] font-semibold leading-5">
            <MarkdownText text={card.front} />
          </p>
          <p className="border-t border-dashed border-border px-3 py-2 text-xs leading-5 text-muted-foreground">
            <MarkdownText text={card.back} />
          </p>
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
            className="rounded-xl border border-border bg-background px-3.5 py-3"
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
    <div className="rounded-xl border border-border bg-background px-3.5 py-3">
      <p className="text-[13px] leading-6">
        <MarkdownText text={content.text} />
      </p>
    </div>
  );
}

function FigurePreview({ content }: { content: Record<string, unknown> }) {
  const url = str(content.url);
  const caption = str(content.caption ?? content.title);
  if (!url) return null;
  return (
    <figure className="rounded-xl border border-border overflow-hidden bg-background">
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

function BankContentPreview({
  kind,
  content,
}: {
  kind: ApiArtifactKind;
  content: Record<string, unknown>;
}) {
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
  return (
    <div className="space-y-3">
      {preview ?? (
        <p className="text-xs text-faint">No preview available for this item.</p>
      )}
      <RawJson content={content} />
    </div>
  );
}

function bankItemSummary(item: ApiArtifactBankItem): string | null {
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

function BankItemCard({
  workspaceId,
  item,
}: {
  workspaceId: string;
  item: ApiArtifactBankItem;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [topic, setTopic] = useState(item.topic ?? "");
  const [difficulty, setDifficulty] = useState(item.difficulty);
  const [contentDraft, setContentDraft] = useState("");
  const [contentError, setContentError] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["bank", workspaceId] });

  const updateMutation = useMutation({
    mutationFn: () => {
      let content: Record<string, unknown> | undefined;
      if (contentDraft.trim()) {
        content = JSON.parse(contentDraft) as Record<string, unknown>;
      }
      return studySessionApi.updateBankItem({
        workspaceId,
        id: item.id,
        title: title.trim() || item.title,
        topic: topic.trim() || null,
        difficulty,
        ...(content ? { content } : {}),
      });
    },
    onSuccess: () => {
      setEditing(false);
      setContentError(null);
      invalidate();
    },
    onError: (err) =>
      setContentError(
        err instanceof SyntaxError
          ? "Content must be valid JSON"
          : err instanceof Error
            ? err.message
            : "Update failed",
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      studySessionApi.deleteBankItem({ workspaceId, id: item.id }),
    onSuccess: invalidate,
  });

  const config = kindConfig[item.kind];
  const Icon = config.icon;

  const startEditing = () => {
    setTitle(item.title);
    setTopic(item.topic ?? "");
    setDifficulty(item.difficulty);
    setContentDraft(JSON.stringify(item.content, null, 2));
    setContentError(null);
    setEditing(true);
    setExpanded(true);
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold truncate">{item.title}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground shrink-0">
              {config.label}
            </span>
            <span className="text-[10px] text-faint shrink-0">
              {bankItemSummary(item) ? `${bankItemSummary(item)} · ` : ""}
              difficulty {item.difficulty}/5 · used {item.usedCount}×
            </span>
          </div>
          <p className="text-[11px] text-faint mt-1">
            {item.topic && `${item.topic} · `}
            {formatRelativeDate(
              typeof item.updatedAt === "string"
                ? item.updatedAt
                : item.updatedAt.toISOString(),
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            title="Edit"
            onClick={(e) => {
              e.stopPropagation();
              startEditing();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Delete"
            disabled={deleteMutation.isPending}
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Delete this bank item?")) deleteMutation.mutate();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-rose/10 hover:text-rose disabled:opacity-40"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-faint" />
          ) : (
            <ChevronRight className="h-4 w-4 text-faint" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-3">
          {editing ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Title
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-normal text-foreground"
                  />
                </label>
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Topic
                  <input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-normal text-foreground"
                  />
                </label>
              </div>
              <label className="block text-[11px] font-semibold text-muted-foreground">
                Difficulty
                <div className="mt-1 flex gap-1">
                  {[1, 2, 3, 4, 5].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={cn(
                        "h-7 w-7 rounded-md border text-xs font-semibold",
                        difficulty === d
                          ? "border-accent bg-accent-soft text-accent-dim"
                          : "border-border text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </label>
              <label className="block text-[11px] font-semibold text-muted-foreground">
                Content (JSON)
                <textarea
                  value={contentDraft}
                  onChange={(e) => setContentDraft(e.target.value)}
                  rows={12}
                  spellCheck={false}
                  className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-[11px] font-normal text-foreground"
                />
              </label>
              {contentError && (
                <p className="text-[11px] text-rose">{contentError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate()}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(false)}
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <BankContentPreview kind={item.kind} content={item.content} />
          )}
        </div>
      )}
    </Card>
  );
}

export default function WorkspaceBankPage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const queryClient = useQueryClient();
  const [familyFilter, setFamilyFilter] = useState<BankFamily | null>(null);

  const { data: workspace, isLoading: workspaceLoading } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => fetchWorkspace(workspaceId),
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ["bank", workspaceId],
    queryFn: () => studySessionApi.listBank({ workspaceId }),
  });

  const regenerate = useMutation({
    mutationFn: () => studySessionApi.generateBank({ workspaceId }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["bank", workspaceId] }),
  });

  const allItems = items ?? [];
  const presentFamilies = familyOrder.filter((f) =>
    allItems.some((item) => familyOfKind[item.kind] === f),
  );
  const filtered = allItems.filter(
    (item) => !familyFilter || familyOfKind[item.kind] === familyFilter,
  );

  // Group the visible items by family, then by topic within each family.
  const groups = familyOrder
    .map((family) => {
      const familyItems = filtered.filter(
        (item) => familyOfKind[item.kind] === family,
      );
      const topicMap = new Map<string, ApiArtifactBankItem[]>();
      for (const item of familyItems) {
        const topic = item.topic?.trim() || UNTAGGED_TOPIC;
        const bucket = topicMap.get(topic);
        if (bucket) bucket.push(item);
        else topicMap.set(topic, [item]);
      }
      // Topics sorted alphabetically, with the catch-all bucket last.
      const topics = [...topicMap.entries()].sort(([a], [b]) => {
        if (a === UNTAGGED_TOPIC) return 1;
        if (b === UNTAGGED_TOPIC) return -1;
        return a.localeCompare(b);
      });
      return { family, count: familyItems.length, topics };
    })
    .filter((group) => group.count > 0);

  if (workspaceLoading || isLoading) {
    return (
      <WorkspaceShell workspace={workspace} loading>
        <div className="space-y-4">
          <Skeleton className="h-4 w-40" />
          <ListRowsSkeleton count={5} />
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell workspace={workspace}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-up">
          <div>
            <h2 className="text-sm font-semibold">Artifact bank</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Precomputed study material pulled into your sessions. Edit or
              remove anything that looks off.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={regenerate.isPending}
            onClick={() => regenerate.mutate()}
          >
            {regenerate.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Regenerate from materials
          </Button>
        </div>

        {presentFamilies.length > 1 && (
          <div className="flex flex-wrap gap-1.5 animate-fade-up">
            <button
              type="button"
              onClick={() => setFamilyFilter(null)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold border",
                !familyFilter
                  ? "border-accent bg-accent-soft text-accent-dim"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              All ({allItems.length})
            </button>
            {presentFamilies.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFamilyFilter(familyFilter === f ? null : f)}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-semibold border",
                  familyFilter === f
                    ? "border-accent bg-accent-soft text-accent-dim"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {familyConfig[f].label} (
                {allItems.filter((item) => familyOfKind[item.kind] === f)
                  .length}
                )
              </button>
            ))}
          </div>
        )}

        {groups.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border-strong bg-card text-center py-14 px-6 animate-fade-up">
            <Layers className="h-10 w-10 mx-auto mb-3 text-faint" />
            <p className="text-sm font-semibold">Bank is empty</p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
              Upload and analyse materials — Scribe precomputes worksheets,
              flashcards, readings and more from them.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map(({ family, count, topics }) => {
              const fc = familyConfig[family];
              const FamilyIcon = fc.icon;
              return (
                <section key={family} className="space-y-3 animate-fade-up">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft shrink-0">
                      <FamilyIcon className="h-4 w-4 text-accent-dim" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold leading-tight">
                        {fc.label}
                        <span className="ml-1.5 text-[11px] font-medium text-faint">
                          {count}
                        </span>
                      </h3>
                      <p className="text-[11px] text-faint leading-tight">
                        {fc.blurb}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4 sm:pl-10">
                    {topics.map(([topic, topicItems]) => (
                      <div key={topic} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {topic}
                          </span>
                          <span className="text-[10px] text-faint tabular-nums">
                            {topicItems.length}
                          </span>
                          <span className="h-px flex-1 bg-border/70" />
                        </div>
                        <div className="grid gap-3">
                          {topicItems.map((item) => (
                            <BankItemCard
                              key={item.id}
                              workspaceId={workspaceId}
                              item={item}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
