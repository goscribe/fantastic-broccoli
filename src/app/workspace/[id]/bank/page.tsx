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

const kinds = Object.keys(kindConfig) as ApiArtifactKind[];

function ContentPreview({ content }: { content: Record<string, unknown> }) {
  const text = JSON.stringify(content, null, 2);
  return (
    <pre className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground whitespace-pre-wrap max-h-72 overflow-y-auto">
      {text}
    </pre>
  );
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
            <>
              {typeof item.content.text === "string" ? (
                <MarkdownText text={item.content.text} />
              ) : null}
              <ContentPreview content={item.content} />
            </>
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
  const [kindFilter, setKindFilter] = useState<ApiArtifactKind | null>(null);

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

  const filtered = (items ?? []).filter(
    (item) => !kindFilter || item.kind === kindFilter,
  );
  const presentKinds = kinds.filter((k) =>
    (items ?? []).some((item) => item.kind === k),
  );

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

        {presentKinds.length > 1 && (
          <div className="flex flex-wrap gap-1.5 animate-fade-up">
            <button
              type="button"
              onClick={() => setKindFilter(null)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold border",
                !kindFilter
                  ? "border-accent bg-accent-soft text-accent-dim"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              All ({items?.length ?? 0})
            </button>
            {presentKinds.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKindFilter(kindFilter === k ? null : k)}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-semibold border",
                  kindFilter === k
                    ? "border-accent bg-accent-soft text-accent-dim"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {kindConfig[k].label} (
                {(items ?? []).filter((item) => item.kind === k).length})
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border-strong bg-card text-center py-14 px-6 animate-fade-up">
            <Layers className="h-10 w-10 mx-auto mb-3 text-faint" />
            <p className="text-sm font-semibold">Bank is empty</p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
              Upload and analyse materials — Scribe precomputes worksheets,
              flashcards, readings and more from them.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 animate-fade-up">
            {filtered.map((item) => (
              <BankItemCard
                key={item.id}
                workspaceId={workspaceId}
                item={item}
              />
            ))}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
