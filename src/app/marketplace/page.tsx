"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  findArtifacts,
  marketplaceArtifacts,
  type ApiArtifactFinderResult,
  type ApiMarketplaceArtifact,
} from "@/lib/api/study-session";
import { BankDocThumb, kindConfig } from "@/components/bank/bank-content";
import { Button } from "@/components/ui/button";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Check,
  Globe,
  Loader2,
  Printer,
  Search,
  Sparkles,
  X,
} from "lucide-react";

type Filter = "all" | "mine" | "community";

function TileCheckbox({
  selected,
  onToggle,
}: {
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      title={selected ? "Remove from selection" : "Select for export"}
      aria-pressed={selected}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border shadow-sm transition-colors",
        selected
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-card text-transparent hover:border-accent",
      )}
    >
      <Check className="h-4 w-4" />
    </button>
  );
}

function ArtifactTile({
  artifact,
  reason,
  selected,
  onToggle,
}: {
  artifact: ApiMarketplaceArtifact;
  reason?: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const label = artifact.kind ? kindConfig[artifact.kind].label : artifact.type;
  return (
    <div className="group relative animate-fade-up">
      <TileCheckbox selected={selected} onToggle={onToggle} />
      <Link
        href={
          artifact.kind
            ? `/workspace/${artifact.workspaceId}/bank/${artifact.id}`
            : `/workspace/${artifact.workspaceId}`
        }
        className={cn(
          "block overflow-hidden rounded-2xl border bg-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md",
          selected ? "border-accent" : "border-border hover:border-border-strong",
        )}
      >
        {artifact.kind && artifact.content ? (
          <BankDocThumb
            kind={artifact.kind}
            content={artifact.content}
            className="aspect-square w-full rounded-none border-0 border-b border-border"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center border-b border-border bg-muted/30 text-faint">
            <Globe className="h-8 w-8" />
          </div>
        )}
        <div className="space-y-1 p-3">
          <p className="truncate text-[13px] font-semibold leading-tight">
            {artifact.title}
          </p>
          {reason ? (
            <p className="line-clamp-2 text-[11px] leading-4 text-accent-dim">
              <Sparkles className="mr-1 inline h-3 w-3" />
              {reason}
            </p>
          ) : (
            <p className="truncate text-[11px] text-faint">
              {artifact.topic ?? artifact.workspaceTitle}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1 pt-0.5">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {label}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                artifact.source === "community"
                  ? "bg-energy/10 text-energy"
                  : "bg-accent-soft text-accent-dim",
              )}
            >
              {artifact.source === "community"
                ? "Community"
                : artifact.workspaceTitle}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

/** Disabled while sharing permissions are being scoped. */
const MARKETPLACE_ENABLED = false;

export default function MarketplacePage() {
  const router = useRouter();
  useEffect(() => {
    if (!MARKETPLACE_ENABLED) router.replace("/");
  }, [router]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [aiResults, setAiResults] = useState<ApiArtifactFinderResult[] | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: browse, isLoading } = useQuery({
    queryKey: ["marketplace"],
    queryFn: () => marketplaceArtifacts(96),
    enabled: MARKETPLACE_ENABLED,
  });

  const search = useMutation({
    mutationFn: (q: string) => findArtifacts(q),
    onSuccess: (results) => setAiResults(results),
  });

  const toggleSelect = (id: string) =>
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );

  const byId = useMemo(
    () => new Map((browse ?? []).map((a) => [a.id, a])),
    [browse],
  );

  // AI results reuse browse-tile data when available; otherwise a light tile
  // is synthesized from the finder result (no content preview).
  const shown: { artifact: ApiMarketplaceArtifact; reason?: string }[] =
    aiResults !== null
      ? aiResults.map((r) => ({
          artifact:
            byId.get(r.id) ??
            ({
              id: r.id,
              workspaceId: r.workspaceId,
              workspaceTitle: r.workspaceTitle,
              title: r.title,
              type: r.type,
              kind: r.kind,
              topic: r.topic,
              content: null,
              visibility: "workspace",
              createdAt: "",
              source: r.source,
            } satisfies ApiMarketplaceArtifact),
          reason: r.reason || undefined,
        }))
      : (browse ?? []).map((artifact) => ({ artifact }));

  const filtered = shown.filter(
    ({ artifact }) => filter === "all" || artifact.source === filter,
  );

  const runSearch = () => {
    const q = query.trim();
    if (q.length < 2 || search.isPending) return;
    search.mutate(q);
  };

  if (!MARKETPLACE_ENABLED) return null;

  return (
    <main className="flex-1 px-6 py-6 md:px-10">
      <div className="mx-auto max-w-5xl">
        <div className="py-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            Search everything you and the community have generated — then pick
            what you need and export it with Scribe.
          </p>
          <form
            className="relative mx-auto mt-6 max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              runSearch();
            }}
          >
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!e.target.value.trim()) setAiResults(null);
              }}
              placeholder="i need to practice trigonometry…"
              className="h-12 w-full rounded-full border border-border bg-card pl-11 pr-32 text-sm shadow-sm outline-none transition-colors focus:border-accent"
            />
            <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
              {aiResults !== null && (
                <button
                  type="button"
                  title="Clear search"
                  onClick={() => {
                    setQuery("");
                    setAiResults(null);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={query.trim().length < 2 || search.isPending}
                className="rounded-full"
              >
                {search.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                )}
                AI search · 1 token
              </Button>
            </div>
          </form>
          {search.isError && (
            <p className="mt-2 text-xs text-rose">
              Search failed — check your token balance and try again.
            </p>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {(
              [
                ["all", "All"],
                ["mine", "My workspaces"],
                ["community", "Community"],
              ] as [Filter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold",
                  filter === value
                    ? "border-accent bg-accent-soft text-accent-dim"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {aiResults !== null && (
            <p className="text-xs text-muted-foreground">
              {aiResults.length} match{aiResults.length === 1 ? "" : "es"} for
              “{query.trim()}”
            </p>
          )}
        </div>

        {isLoading ? (
          <CardGridSkeleton count={8} />
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border-strong bg-card px-6 py-14 text-center">
            <Globe className="mx-auto mb-3 h-10 w-10 text-faint" />
            <p className="text-sm font-semibold">
              {aiResults !== null ? "No matches" : "Nothing here yet"}
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-xs text-muted-foreground">
              {aiResults !== null
                ? "Try describing what you want to study differently."
                : "Artifacts you generate — and anything the community shares publicly — show up here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map(({ artifact, reason }) => (
              <ArtifactTile
                key={artifact.id}
                artifact={artifact}
                reason={reason}
                selected={selectedIds.includes(artifact.id)}
                onToggle={() => toggleSelect(artifact.id)}
              />
            ))}
          </div>
        )}

        {selectedIds.length > 0 && (
          <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
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
    </main>
  );
}
