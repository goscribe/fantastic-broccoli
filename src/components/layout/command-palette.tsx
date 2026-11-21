"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { Folder, Workspace } from "@/types";
import {
  findArtifacts,
  rpc,
  type ApiArtifactFinderResult,
} from "@/lib/api/study-session";
import { useDebounced } from "@/lib/use-debounced";
import { track } from "@/lib/funnel";
import {
  matchLocal,
  paletteRows,
  resultSubline,
  selectable,
  SEARCH_MIN_CHARS,
  type LocalItem,
  type PaletteRow,
  type SearchResponse,
} from "@/lib/search";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";
import "@/lib/i18n/purpose";
import "@/lib/i18n/mistakes";
import { Search, Loader2 } from "lucide-react";

function flatten(
  folders: Folder[],
  root: Workspace[],
  hints: { workspace: string; folder: string },
): LocalItem[] {
  const items: LocalItem[] = [];
  const walkWs = (ws: Workspace) =>
    items.push({ id: `ws-${ws.id}`, label: ws.title, hint: hints.workspace, href: `/workspace/${ws.id}`, kind: "subject" });
  const walk = (fs: Folder[]) => {
    for (const f of fs) {
      items.push({ id: `folder-${f.id}`, label: f.name, hint: hints.folder, href: `/folder/${f.id}`, kind: "folder" });
      f.workspaces.forEach(walkWs);
      if (f.folders) walk(f.folders);
    }
  };
  walk(folders);
  root.forEach(walkWs);
  return items;
}

function artifactHref(r: ApiArtifactFinderResult): string {
  return r.kind ? `/workspace/${r.workspaceId}/bank/${r.id}` : `/workspace/${r.workspaceId}`;
}

const GROUP_LABEL: Record<Extract<PaletteRow, { row: "heading" }>["group"], string> = {
  subjects: "purpose.groupSubjects",
  pages: "purpose.groupPages",
  session: "purpose.groupSession",
  material: "purpose.groupMaterial",
  mistake: "purpose.groupMistake",
  topic: "purpose.groupTopic",
  note: "purpose.groupNote",
};

export function CommandPalette({
  open,
  onClose,
  folders,
  rootWorkspaces,
}: {
  open: boolean;
  onClose: () => void;
  folders: Folder[];
  rootWorkspaces: Workspace[];
}) {
  if (!open) return null;
  return <PalettePanel onClose={onClose} folders={folders} rootWorkspaces={rootWorkspaces} />;
}

/**
 * Search (purpose audit, finding 18): subjects and pages matched as you
 * type, then your sessions, mistakes, topics, notes and materials from the
 * free local index, each with a one-line preview. Looking inside files with
 * AI is the last row.
 */
function PalettePanel({
  onClose,
  folders,
  rootWorkspaces,
}: {
  onClose: () => void;
  folders: Folder[];
  rootWorkspaces: Workspace[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<ApiArtifactFinderResult[] | null>(null);

  const local = useMemo(() => {
    const hint = t("misc.page");
    const pages: LocalItem[] = [
      { id: "page-home", label: t("misc.home"), hint, href: "/", kind: "page" },
      { id: "page-notes", label: t("purpose.pageNotes"), hint, href: "/library", kind: "page" },
      { id: "page-planner", label: t("purpose.pagePlanner"), hint, href: "/planner", kind: "page" },
      { id: "page-mistakes", label: t("purpose.pageMistakes"), hint, href: "/mistakes", kind: "page" },
      { id: "page-settings", label: t("misc.settings"), hint, href: "/settings", kind: "page" },
    ];
    return [...flatten(folders, rootWorkspaces, { workspace: t("misc.workspace"), folder: t("misc.folder") }), ...pages];
  }, [folders, rootWorkspaces, t]);

  const q = query.trim();
  const debounced = useDebounced(q, 180);
  const server = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => rpc<SearchResponse>("search.query", "query", { q: debounced }),
    enabled: debounced.length >= SEARCH_MIN_CHARS,
    staleTime: 30_000,
    retry: false,
  });
  const serverData = server.data && server.data.query === debounced ? server.data : null;

  // One event per settled query: did the free index find anything?
  const tracked = useRef<string | null>(null);
  useEffect(() => {
    if (!serverData || tracked.current === serverData.query) return;
    tracked.current = serverData.query;
    track("search.query", { hasLocalResults: serverData.hasLocalResults });
  }, [serverData]);

  const rows = useMemo(
    () => paletteRows({ query: q, local: matchLocal(local, q, q ? 6 : 8), server: q.length >= SEARCH_MIN_CHARS ? serverData : null }),
    [q, local, serverData],
  );
  const choices = useMemo(() => selectable(rows), [rows]);
  const current = Math.min(selected, Math.max(0, choices.length - 1));
  const searching = q.length >= SEARCH_MIN_CHARS && (debounced !== q || server.isFetching);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const runAiSearch = async () => {
    if (aiLoading || !q) return;
    setAiLoading(true);
    setAiError(null);
    setAiResults(null);
    try {
      setAiResults(await findArtifacts(q));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t("misc.searchFailed"));
    } finally {
      setAiLoading(false);
    }
  };

  const activate = (row: PaletteRow | undefined) => {
    if (!row) return;
    if (row.row === "ai") void runAiSearch();
    else if (row.row === "local") go(row.item.href);
    else if (row.row === "result") go(row.href);
  };

  const rowClass = (active: boolean) =>
    cn("flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm", active ? "bg-muted text-foreground" : "text-foreground/85");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-[12vh]" onClick={onClose}>
      <div
        role="dialog"
        aria-label={t("purpose.searchPlaceholder")}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 items-center gap-2.5 border-b border-border px-4">
          {searching ? <Loader2 className="h-4 w-4 animate-spin text-faint" /> : <Search className="h-4 w-4 text-faint" />}
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
              setAiResults(null);
              setAiError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected(Math.min(current + 1, choices.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected(Math.max(current - 1, 0));
              } else if (e.key === "Enter") {
                activate(choices[current]);
              }
            }}
            placeholder={t("purpose.searchPlaceholder")}
            aria-label={t("purpose.searchPlaceholder")}
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
          />
          <kbd className="rounded border border-border px-1 text-[10px] text-faint">esc</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          {rows.map((row) => {
            if (row.row === "heading") {
              return (
                <p key={row.key} className="px-3 pb-1 pt-3 text-[12px] font-bold text-muted-foreground first:pt-1.5">
                  {t(GROUP_LABEL[row.group])}
                </p>
              );
            }
            const index = choices.indexOf(row);
            const active = index === current;
            if (row.row === "local") {
              return (
                <button key={row.key} type="button" onClick={() => activate(row)} onMouseEnter={() => setSelected(index)} className={cn(rowClass(active), "items-center")}>
                  <span className="flex-1 truncate font-semibold">{row.item.label}</span>
                </button>
              );
            }
            if (row.row === "result") {
              const sub = resultSubline(row.result);
              return (
                <button key={row.key} type="button" onClick={() => activate(row)} onMouseEnter={() => setSelected(index)} className={rowClass(active)}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{row.result.title}</span>
                    {sub && <span className="block truncate text-[12.5px] text-muted-foreground">{sub}</span>}
                  </span>
                </button>
              );
            }
            return (
              <button
                key={row.key}
                type="button"
                onClick={() => activate(row)}
                onMouseEnter={() => setSelected(index)}
                disabled={aiLoading}
                className={cn(rowClass(active), "mt-1 items-center border-t border-border pt-2.5 text-muted-foreground")}
              >
                {aiLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span className="flex-1 truncate font-medium">
                  {aiLoading ? t("misc.findingInMaterials").replace("{query}", q) : t("purpose.aiSearch").replace("{query}", q)}
                </span>
              </button>
            );
          })}

          {q.length > 0 && q.length < SEARCH_MIN_CHARS && rows.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("misc.noResultsFor").replace("{query}", q)}</p>
          )}

          {aiError && <p className="px-3 py-2 text-xs text-rose">{aiError}</p>}

          {aiResults && (
            <div className="mt-1 space-y-px">
              <p className="px-3 pb-1 pt-2 text-[12px] font-bold text-muted-foreground">{t("misc.bestMatches")}</p>
              {aiResults.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">{t("misc.noMaterialMatches")}</p>
              ) : (
                aiResults.map((r) => (
                  <button key={r.id} type="button" onClick={() => go(artifactHref(r))} className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-muted">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{r.title}</span>
                      <span className="block truncate text-[12px] text-muted-foreground">{r.reason || r.snippet}</span>
                    </span>
                    <span className="shrink-0 pt-0.5 text-[11px] text-faint">{r.workspaceTitle}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
