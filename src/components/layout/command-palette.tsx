"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Folder, Workspace } from "@/types";
import {
  findArtifacts,
  type ApiArtifactFinderResult,
} from "@/lib/api/study-session";
import { WorkspaceIcon } from "@/components/graphics/workspace-icon";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";
import {
  Search,
  Folder as FolderIcon,
  Home,
  Users,
  Settings,
  Sparkles,
  Loader2,
  Layers,
  BookOpen,
  ClipboardList,
  Image as ImageIcon,
} from "lucide-react";

interface PaletteItem {
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: React.ReactNode;
}

function flatten(
  folders: Folder[],
  root: Workspace[],
  hints: { workspace: string; folder: string },
): PaletteItem[] {
  const items: PaletteItem[] = [];
  const walkWs = (ws: Workspace) =>
    items.push({
      id: `ws-${ws.id}`,
      label: ws.title,
      hint: hints.workspace,
      href: `/workspace/${ws.id}`,
      icon: <WorkspaceIcon icon={ws.icon} className="h-4 w-4" />,
    });
  const walk = (fs: Folder[]) => {
    for (const f of fs) {
      items.push({
        id: `folder-${f.id}`,
        label: f.name,
        hint: hints.folder,
        href: `/folder/${f.id}`,
        icon: <FolderIcon className="h-4 w-4" />,
      });
      f.workspaces.forEach(walkWs);
      if (f.folders) walk(f.folders);
    }
  };
  walk(folders);
  root.forEach(walkWs);
  return items;
}



function artifactIcon(kind: string | null) {
  switch (kind) {
    case "FLASHCARD_DECK":
    case "VOCAB_DECK":
      return <Layers className="h-4 w-4" />;
    case "WORKSHEET":
    case "MCQ_POOL":
      return <ClipboardList className="h-4 w-4" />;
    case "FIGURE":
      return <ImageIcon className="h-4 w-4" />;
    default:
      return <BookOpen className="h-4 w-4" />;
  }
}

function artifactHref(r: ApiArtifactFinderResult): string {
  return r.kind
    ? `/workspace/${r.workspaceId}/bank/${r.id}`
    : `/workspace/${r.workspaceId}`;
}

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
  return (
    <PalettePanel
      onClose={onClose}
      folders={folders}
      rootWorkspaces={rootWorkspaces}
    />
  );
}

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
  const [aiResults, setAiResults] = useState<ApiArtifactFinderResult[] | null>(
    null,
  );

  const items = useMemo(() => {
    const pageHint = t("misc.page");
    const pages: PaletteItem[] = [
      {
        id: "page-home",
        label: t("misc.home"),
        hint: pageHint,
        href: "/",
        icon: <Home className="h-4 w-4" />,
      },
      {
        id: "page-shared",
        label: t("misc.shared"),
        hint: pageHint,
        href: "/shared",
        icon: <Users className="h-4 w-4" />,
      },
      {
        id: "page-settings",
        label: t("misc.settings"),
        hint: pageHint,
        href: "/settings",
        icon: <Settings className="h-4 w-4" />,
      },
    ];
    return [
      ...flatten(folders, rootWorkspaces, {
        workspace: t("misc.workspace"),
        folder: t("misc.folder"),
      }),
      ...pages,
    ];
  }, [folders, rootWorkspaces, t]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 8);
    return items.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 6);
  }, [items, query]);

  // Row 0 is the AI-finder action whenever there's a query.
  const aiRowVisible = query.trim().length > 1;
  const totalRows = (aiRowVisible ? 1 : 0) + results.length;

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const runAiSearch = async () => {
    if (aiLoading || !query.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setAiResults(null);
    try {
      setAiResults(await findArtifacts(query.trim()));
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : t("misc.searchFailed"),
      );
    } finally {
      setAiLoading(false);
    }
  };

  const activate = (row: number) => {
    if (aiRowVisible && row === 0) void runAiSearch();
    else {
      const item = results[row - (aiRowVisible ? 1 : 0)];
      if (item) go(item.href);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4 h-12">
          <Search className="h-4 w-4 text-faint" />
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
                setSelected((s) => Math.min(s + 1, totalRows - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter") {
                activate(selected);
              }
            }}
            placeholder={t("misc.palettePlaceholder")}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
          <kbd className="rounded border border-border px-1 text-[10px] text-faint">
            esc
          </kbd>
        </div>
        <div className="max-h-96 overflow-y-auto p-1.5">
          {aiRowVisible && (
            <button
              type="button"
              onClick={() => void runAiSearch()}
              onMouseEnter={() => setSelected(0)}
              disabled={aiLoading}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm",
                selected === 0
                  ? "bg-accent-soft text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
              ) : (
                <Sparkles className="h-4 w-4 text-accent" />
              )}
              <span className="flex-1 truncate font-medium">
                {aiLoading ? (
                  <span className="animate-pulse">
                    {t("misc.findingInMaterials").replace(
                      "{query}",
                      query.trim(),
                    )}
                  </span>
                ) : (
                  <>{t("misc.findWithAi").replace("{query}", query.trim())}</>
                )}
              </span>
              <span className="shrink-0 rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent-dim">
                {t("misc.oneToken")}
              </span>
            </button>
          )}

          {aiError && (
            <p className="px-3 py-2 text-xs text-rose">{aiError}</p>
          )}

          {aiResults && (
            <div className="mt-1 space-y-px">
              <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-faint">
                <Sparkles className="h-3 w-3 text-accent" />
                {t("misc.bestMatches")}
              </p>
              {aiResults.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  {t("misc.noMaterialMatches")}
                </p>
              ) : (
                aiResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => go(artifactHref(r))}
                    className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-accent-soft"
                  >
                    <span className="mt-0.5 text-accent">
                      {artifactIcon(r.kind)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {r.title}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {r.reason || r.snippet}
                      </span>
                    </span>
                    <span className="shrink-0 pt-0.5 text-[10px] text-faint">
                      {r.workspaceTitle}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {results.length === 0 && !aiRowVisible ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("misc.noResultsFor").replace("{query}", query)}
            </p>
          ) : (
            results.map((item, i) => {
              const row = i + (aiRowVisible ? 1 : 0);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => go(item.href)}
                  onMouseEnter={() => setSelected(row)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm",
                    row === selected
                      ? "bg-accent-soft text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <span className="text-faint">{item.icon}</span>
                  <span className="flex-1 truncate font-medium">{item.label}</span>
                  <span className="text-[11px] text-faint">{item.hint}</span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
