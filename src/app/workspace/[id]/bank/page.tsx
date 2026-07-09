"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWorkspace } from "@/lib/api/workspace";
import {
  studySessionApi,
  type ApiArtifactBankItem,
  type ApiArtifactKind,
} from "@/lib/api/study-session";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import {
  bankItemSummary,
  kindConfig,
} from "@/components/bank/bank-content";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListRowsSkeleton, Skeleton } from "@/components/ui/skeleton";
import { formatRelativeDate, cn } from "@/lib/utils";
import {
  BookOpen,
  ChevronRight,
  FileQuestion,
  Image as ImageIcon,
  Layers,
  Loader2,
  RefreshCw,
  Trash2,
  WalletCards,
} from "lucide-react";

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

function BankItemRow({
  workspaceId,
  item,
}: {
  workspaceId: string;
  item: ApiArtifactBankItem;
}) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () =>
      studySessionApi.deleteBankItem({ workspaceId, id: item.id }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["bank", workspaceId] }),
  });

  const config = kindConfig[item.kind];
  const Icon = config.icon;
  const summary = bankItemSummary(item);

  return (
    <Card className="p-0 overflow-hidden">
      <Link
        href={`/workspace/${workspaceId}/bank/${item.id}`}
        className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors"
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
              {summary ? `${summary} · ` : ""}
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
            title="Delete"
            disabled={deleteMutation.isPending}
            onClick={(e) => {
              e.preventDefault();
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
          <ChevronRight className="h-4 w-4 text-faint" />
        </div>
      </Link>
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
              Precomputed study material pulled into your sessions. Open an
              item to view or edit it.
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
                            <BankItemRow
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
