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
  BankDocThumb,
  bankItemSummary,
  kindConfig,
} from "@/components/bank/bank-content";
import { Button } from "@/components/ui/button";
import { ListRowsSkeleton, Skeleton } from "@/components/ui/skeleton";
import { formatRelativeDate, cn } from "@/lib/utils";
import {
  Check,
  Layers,
  Loader2,
  Printer,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  FigureArt,
  FlashcardsArt,
  GuideArt,
  WorksheetArt,
} from "@/components/graphics/bank-art";

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
  { label: string; art: React.ElementType; blurb: string }
> = {
  worksheets: {
    label: "Worksheets & quizzes",
    art: WorksheetArt,
    blurb: "Exam-style worksheets and MCQ pools.",
  },
  flashcards: {
    label: "Flashcard sets",
    art: FlashcardsArt,
    blurb: "Flashcard and vocabulary decks.",
  },
  guides: {
    label: "Study guides",
    art: GuideArt,
    blurb: "Readings and cloze passages.",
  },
  figures: {
    label: "Figures",
    art: FigureArt,
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

function BankItemTile({
  workspaceId,
  item,
  selected,
  onToggleSelect,
}: {
  workspaceId: string;
  item: ApiArtifactBankItem;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () =>
      studySessionApi.deleteBankItem({ workspaceId, id: item.id }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["bank", workspaceId] }),
  });

  const config = kindConfig[item.kind];
  const summary = bankItemSummary(item);

  return (
    <div className="group relative">
      <Link
        href={`/workspace/${workspaceId}/bank/${item.id}`}
        className={cn(
          "block overflow-hidden rounded-2xl border bg-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md",
          selected
            ? "border-accent"
            : "border-border hover:border-border-strong",
        )}
      >
        <BankDocThumb
          kind={item.kind}
          content={item.content}
          className="aspect-square w-full rounded-none border-0 border-b border-border"
        />
        <div className="space-y-1 p-3">
          <p className="truncate text-[13px] font-semibold leading-tight group-hover:text-accent transition-colors">
            {item.title}
          </p>
          <p className="truncate text-[11px] text-faint">
            {summary ? `${summary} · ` : ""}
            {formatRelativeDate(
              typeof item.updatedAt === "string"
                ? item.updatedAt
                : item.updatedAt.toISOString(),
            )}
          </p>
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {config.label}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              difficulty {item.difficulty}/5
            </span>
          </div>
        </div>
      </Link>
      <div className="absolute right-2 top-2 flex items-center gap-1.5">
        <button
          type="button"
          title={selected ? "Remove from selection" : "Select for export"}
          aria-pressed={selected}
          onClick={onToggleSelect}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md border shadow-sm transition-colors",
            selected
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border-strong bg-card text-transparent hover:border-accent",
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Delete"
          disabled={deleteMutation.isPending}
          onClick={() => {
            if (confirm("Delete this bank item?")) deleteMutation.mutate();
          }}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border-strong bg-card text-muted-foreground shadow-sm opacity-0 transition-opacity group-hover:opacity-100 hover:text-rose hover:border-rose/50 disabled:opacity-40"
        >
          {deleteMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

export default function WorkspaceBankPage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const queryClient = useQueryClient();
  const router = useRouter();
  const [familyFilter, setFamilyFilter] = useState<BankFamily | null>(null);
  const [sharePromptOpen, setSharePromptOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = (id: string) =>
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );

  const { data: workspace, isLoading: workspaceLoading } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => fetchWorkspace(workspaceId),
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ["bank", workspaceId],
    queryFn: () => studySessionApi.listBank({ workspaceId }),
  });

  const regenerate = useMutation({
    mutationFn: (visibility: "workspace" | "private" | "public") =>
      studySessionApi.generateBank({ workspaceId, visibility }),
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
            onClick={() => setSharePromptOpen(true)}
          >
            {regenerate.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Regenerate from materials
          </Button>
        </div>

        {sharePromptOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
            onClick={() => setSharePromptOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-accent" />
                <p className="text-sm font-semibold">
                  Share what you generate?
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                New study materials can be visible to everyone in this
                workspace, or kept just for you.
              </p>
              <div className="grid gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => {
                    setSharePromptOpen(false);
                    regenerate.mutate("workspace");
                  }}
                >
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  Share with workspace
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSharePromptOpen(false);
                    regenerate.mutate("private");
                  }}
                >
                  Keep private
                </Button>
              </div>
            </div>
          </div>
        )}

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
              const FamilyArt = fc.art;
              return (
                <section key={family} className="space-y-3 animate-fade-up">
                  <div className="flex items-center gap-2.5">
                    <FamilyArt className="h-8 w-8 shrink-0" />
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
                          <span className="text-xs font-semibold text-muted-foreground">
                            {topic}
                          </span>
                          <span className="text-[10px] text-faint tabular-nums">
                            {topicItems.length}
                          </span>
                          <span className="h-px flex-1 bg-border/70" />
                        </div>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                          {topicItems.map((item) => (
                            <BankItemTile
                              key={item.id}
                              workspaceId={workspaceId}
                              item={item}
                              selected={selectedIds.includes(item.id)}
                              onToggleSelect={() => toggleSelect(item.id)}
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

        {selectedIds.length > 0 && (
          <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 print:hidden">
            <div className="flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2 shadow-lg animate-fade-up">
              <span className="text-xs font-semibold">
                {selectedIds.length} selected
              </span>
              <Button
                size="sm"
                onClick={() =>
                  router.push(`/export?ids=${selectedIds.join(",")}`)
                }
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                Export with Scribe
              </Button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
