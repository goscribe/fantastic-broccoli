"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchWorkspace } from "@/lib/api/workspace";
import {
  fetchStudyGuides,
  regenerateStudyGuides,
  StudyGuide,
} from "@/lib/api/podcast";
import { toastError } from "@/lib/toast";
import { toast } from "sonner";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { MarkdownText } from "@/components/ui/markdown-text";
import { ReadingBody } from "@/components/session/reading-activity";
import { normalizeActivityContent } from "@/lib/api/activity-content";
import type { McqContent, ReadingContent } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

interface EditorJsBlock {
  id?: string;
  type: string;
  data: { text?: string; level?: number; items?: unknown[] };
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}

function MiniQuiz({ questions }: { questions: McqContent["questions"] }) {
  const [picked, setPicked] = useState<Record<number, number>>({});
  return (
    <div className="mt-8 space-y-3 border-t border-border pt-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-dim">
        Check yourself
      </p>
      {questions.map((q, i) => {
        const chosen = picked[i];
        return (
          <div key={i} className="rounded-xl border border-border bg-muted/20 px-3.5 py-3">
            <p className="text-[13px] font-medium leading-5">
              <span className="mr-1.5 text-faint">{i + 1}.</span>
              <MarkdownText text={q.question} />
            </p>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {q.options.map((option, j) => {
                const isChosen = chosen === j;
                const isCorrect = j === q.correctIndex;
                return (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setPicked((p) => ({ ...p, [i]: j }))}
                    className={cn(
                      "flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs leading-5 transition",
                      chosen === undefined
                        ? "border-border bg-card hover:bg-muted/40"
                        : isCorrect
                          ? "border-energy/40 bg-energy/10 font-semibold"
                          : isChosen
                            ? "border-rose/40 bg-rose/10"
                            : "border-border text-muted-foreground",
                    )}
                  >
                    <span className="font-semibold">{String.fromCharCode(65 + j)}.</span>
                    <span className="min-w-0 flex-1">
                      <MarkdownText text={option} />
                    </span>
                    {chosen !== undefined && isCorrect && (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-energy" />
                    )}
                    {chosen !== undefined && isChosen && !isCorrect && (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose" />
                    )}
                  </button>
                );
              })}
            </div>
            {chosen !== undefined && q.explanation && (
              <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                <MarkdownText text={q.explanation} />
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GuideContent({ content }: { content: string }) {
  let parsedJson: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      parsedJson = parsed as Record<string, unknown>;
    }
  } catch {
    // plain markdown
  }

  if (!parsedJson) {
    const reading = normalizeActivityContent("reading", { text: content });
    return <ReadingBody content={reading as ReadingContent} />;
  }

  if (!Array.isArray(parsedJson.blocks)) {
    // Reading-shaped guide content: markdown text, embedded figures/widgets,
    // and an optional mini-quiz under `questions`.
    const reading = normalizeActivityContent(
      "reading",
      parsedJson,
    ) as ReadingContent;
    const quiz = Array.isArray(parsedJson.questions)
      ? (normalizeActivityContent("mcq", parsedJson) as McqContent)
      : null;
    return (
      <div>
        <ReadingBody content={reading} />
        {quiz && quiz.questions.length > 0 && (
          <MiniQuiz questions={quiz.questions} />
        )}
      </div>
    );
  }

  return <EditorJsContent blocks={parsedJson.blocks as EditorJsBlock[]} />;
}

function EditorJsContent({ blocks }: { blocks: EditorJsBlock[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        if (block.type === "header") {
          const level = block.data.level ?? 2;
          const text = stripHtml(block.data.text ?? "");
          if (level <= 2)
            return (
              <h2 key={block.id ?? i} className="text-lg font-semibold pt-2">
                {text}
              </h2>
            );
          return (
            <h3 key={block.id ?? i} className="text-base font-semibold pt-1">
              {text}
            </h3>
          );
        }
        if (block.type === "list" && Array.isArray(block.data.items)) {
          return (
            <ul key={block.id ?? i} className="list-disc pl-5 space-y-1">
              {block.data.items.map((item, j) => (
                <li key={j} className="text-sm leading-relaxed">
                  <MarkdownText
                    text={stripHtml(
                      typeof item === "string"
                        ? item
                        : ((item as { content?: string }).content ?? ""),
                    )}
                  />
                </li>
              ))}
            </ul>
          );
        }
        const text = stripHtml(block.data.text ?? "");
        if (!text) return null;
        return (
          <div key={block.id ?? i} className="text-sm leading-relaxed">
            <MarkdownText text={text} />
          </div>
        );
      })}
    </div>
  );
}

const SWIPE_THRESHOLD = 60;

function GuideDeck({
  guides,
  regenerating,
  onRegenerate,
}: {
  guides: StudyGuide[];
  regenerating: boolean;
  onRegenerate: (artifactId?: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<number | null>(null);

  const goTo = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(guides.length - 1, next)));
    },
    [guides.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goTo(index - 1);
      if (e.key === "ArrowRight") goTo(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, goTo]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragStart.current = e.clientX;
    setIsDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || dragStart.current === null) return;
    setDragX(e.clientX - dragStart.current);
  };
  const endDrag = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragX <= -SWIPE_THRESHOLD) goTo(index + 1);
    else if (dragX >= SWIPE_THRESHOLD) goTo(index - 1);
    setDragX(0);
    dragStart.current = null;
  };

  const guide = guides[index];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={regenerating}
            onClick={() => onRegenerate(guide.artifactId)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {regenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {regenerating ? "Regenerating…" : "Regenerate this guide"}
          </button>
          {guides.length > 1 && (
            <button
              type="button"
              disabled={regenerating}
              onClick={() => onRegenerate()}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              Regenerate all
            </button>
          )}
        </div>
        {guides.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous guide"
              disabled={index === 0}
              onClick={() => goTo(index - 1)}
              className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-14 text-center text-xs font-medium text-muted-foreground tabular-nums">
              {index + 1} / {guides.length}
            </span>
            <button
              type="button"
              aria-label="Next guide"
              disabled={index === guides.length - 1}
              onClick={() => goTo(index + 1)}
              className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="relative mx-auto w-full max-w-2xl pb-3">
        <article
          className={cn(
            "relative flex touch-pan-y select-none flex-col",
            guides.length > 1 && "cursor-grab active:cursor-grabbing",
            !isDragging && "transition-transform duration-200",
          )}
          style={{ transform: `translateX(${dragX}px)` }}
          onPointerDown={guides.length > 1 ? onPointerDown : undefined}
          onPointerMove={guides.length > 1 ? onPointerMove : undefined}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
        >
          <div className="flex-1 px-2 py-4 sm:px-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{guide.title}</h2>
                {guide.topic && (
                  <p className="mt-0.5 text-xs font-medium text-accent-dim">
                    {guide.topic}
                  </p>
                )}
              </div>
              {guides.length > 1 && (
                <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent-dim">
                  Page {index + 1}
                </span>
              )}
            </div>
            <div className="mt-5">
              <GuideContent content={guide.content ?? ""} />
            </div>
          </div>
        </article>
      </div>

      {guides.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {guides.map((g, i) => (
            <button
              key={g.artifactId}
              type="button"
              aria-label={`Go to guide ${i + 1}: ${g.title}`}
              onClick={() => goTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-6 bg-accent" : "w-1.5 bg-border-strong hover:bg-faint",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkspaceGuidePage() {
  const params = useParams();
  const workspaceId = params.id as string;

  const { data: workspace, isLoading: workspaceLoading } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => fetchWorkspace(workspaceId),
  });
  const [regenerating, setRegenerating] = useState(false);
  const baseline = useRef<string | null>(null);
  const {
    data: guides,
    isLoading: guidesLoading,
    error,
  } = useQuery({
    queryKey: ["study-guides", workspaceId],
    queryFn: () => fetchStudyGuides(workspaceId),
    refetchInterval: regenerating ? 5000 : false,
  });

  // Regeneration runs in the background — poll until the guide content changes.
  useEffect(() => {
    if (!regenerating || !guides || baseline.current === null) return;
    if (JSON.stringify(guides) !== baseline.current) {
      setRegenerating(false);
      baseline.current = null;
      toast.success("Study guide regenerated");
    }
  }, [guides, regenerating]);

  const onRegenerate = useCallback(
    async (artifactId?: string) => {
      try {
        baseline.current = JSON.stringify(guides ?? []);
        setRegenerating(true);
        await regenerateStudyGuides(workspaceId, artifactId);
        toast.info(
          artifactId
            ? "Regenerating this guide — it will refresh when ready."
            : "Regenerating all guides — they will refresh when ready.",
        );
      } catch (err) {
        setRegenerating(false);
        baseline.current = null;
        toastError(err, "Couldn't start regeneration");
      }
    },
    [workspaceId, guides],
  );

  if (workspaceLoading || guidesLoading) {
    return (
      <WorkspaceShell workspace={workspace} loading>
        <div className="space-y-4">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell workspace={workspace}>
      <div className="animate-fade-up -mx-4 -my-6 min-h-full bg-paper px-4 py-6 sm:-mx-8 sm:-my-8 sm:px-8 sm:py-8">
        {error || !guides || guides.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
            <BookOpen className="h-8 w-8 text-faint" />
            <p className="mt-3 text-sm font-medium">No study guides yet</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Upload materials in the Materials tab — Scribe builds study
              guides from them automatically.
            </p>
          </div>
        ) : (
          <GuideDeck
            guides={guides}
            regenerating={regenerating}
            onRegenerate={(artifactId) => void onRegenerate(artifactId)}
          />
        )}
      </div>
    </WorkspaceShell>
  );
}
