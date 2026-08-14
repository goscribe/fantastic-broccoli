"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWorkspace } from "@/lib/api/workspace";
import { studySessionApi } from "@/lib/api/study-session";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import {
  BankContentPreview,
  bankItemSummary,
  deckEntries,
  DeckPreview,
  kindConfig,
} from "@/components/bank/bank-content";
import { DeckViewer } from "@/components/bank/deck-viewer";
import { Button } from "@/components/ui/button";
import { ListRowsSkeleton, Skeleton } from "@/components/ui/skeleton";
import { formatRelativeDate, cn } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  Layers,
  Loader2,
  Pencil,
  Printer,
  Trash2,
  X,
} from "lucide-react";

export default function BankItemPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;
  const itemId = params.itemId as string;
  const queryClient = useQueryClient();

  const { data: workspace, isLoading: workspaceLoading } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => fetchWorkspace(workspaceId),
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ["bank", workspaceId],
    queryFn: () => studySessionApi.listBank({ workspaceId }),
  });

  const item = (items ?? []).find((i) => i.id === itemId);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState(3);
  const [contentDraft, setContentDraft] = useState("");
  const [contentError, setContentError] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["bank", workspaceId] });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!item) throw new Error("Item not loaded");
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
    mutationFn: () => {
      if (!item) throw new Error("Item not loaded");
      return studySessionApi.deleteBankItem({ workspaceId, id: item.id });
    },
    onSuccess: () => {
      invalidate();
      router.push(`/workspace/${workspaceId}/bank`);
    },
  });

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

  if (!item) {
    return (
      <WorkspaceShell workspace={workspace}>
        <div className="rounded-3xl border border-dashed border-border-strong bg-card text-center py-14 px-6 animate-fade-up">
          <Layers className="h-10 w-10 mx-auto mb-3 text-faint" />
          <p className="text-sm font-semibold">Item not found</p>
          <p className="text-xs text-muted-foreground mt-1.5">
            This bank item may have been deleted.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            onClick={() => router.push(`/workspace/${workspaceId}/bank`)}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Back to bank
          </Button>
        </div>
      </WorkspaceShell>
    );
  }

  const config = kindConfig[item.kind];
  const Art = config.art;
  const deck = deckEntries(item);
  const summary = bankItemSummary(item);

  const startEditing = () => {
    setTitle(item.title);
    setTopic(item.topic ?? "");
    setDifficulty(item.difficulty);
    setContentDraft(JSON.stringify(item.content, null, 2));
    setContentError(null);
    setEditing(true);
  };

  return (
    <WorkspaceShell workspace={workspace}>
      <div className="space-y-5">
        <div className="animate-fade-up">
          <Link
            href={`/workspace/${workspaceId}/bank`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Artifact bank
          </Link>
        </div>

        <div className="flex items-start gap-3 animate-fade-up">
          <Art className="h-10 w-10 shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold leading-tight">
              {item.title}
            </h2>
            <p className="text-[11px] text-faint mt-1">
              {config.label}
              {item.topic && ` · ${item.topic}`}
              {" · "}difficulty {item.difficulty}/5
              {summary && ` · ${summary}`}
              {" · used "}
              {item.usedCount}× ·{" "}
              {formatRelativeDate(
                typeof item.updatedAt === "string"
                  ? item.updatedAt
                  : item.updatedAt.toISOString(),
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!editing && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.print()}
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                Print
              </Button>
            )}
            {!editing && (
              <Button size="sm" variant="outline" onClick={startEditing}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            )}
            <Button
              size="sm"
              variant="danger"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (confirm("Delete this bank item?")) deleteMutation.mutate();
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Delete
            </Button>
          </div>
        </div>

        {editing ? (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3 animate-fade-up">
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
                rows={16}
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
          </div>
        ) : deck && deck.entries.length > 0 ? (
          <div className="space-y-6 animate-fade-up">
            <DeckViewer
              entries={deck.entries}
              frontLabel={deck.frontLabel}
              backLabel={deck.backLabel}
            />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                All cards
              </p>
              <DeckPreview
                entries={deck.entries}
                frontLabel={deck.frontLabel}
                backLabel={deck.backLabel}
              />
            </div>
          </div>
        ) : (
          <div className="animate-fade-up">
            <BankContentPreview kind={item.kind} content={item.content} />
          </div>
        )}
      </div>

      {/* Print-only sheet (see globals.css @media print) with Scribe watermark. */}
      <div className="print-sheet hidden">
        <div className="print-watermark hidden">
          <span>Scribe · scribe.study</span>
        </div>
        <div className="mx-auto max-w-2xl space-y-4 p-8">
          <div className="border-b border-border pb-3">
            <h1 className="text-xl font-bold">{item.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {config.label}
              {item.topic && ` · ${item.topic}`}
              {summary && ` · ${summary}`}
              {" · Generated with Scribe — scribe.study"}
            </p>
          </div>
          <BankContentPreview kind={item.kind} content={item.content} />
        </div>
      </div>
    </WorkspaceShell>
  );
}
