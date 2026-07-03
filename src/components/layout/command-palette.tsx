"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Folder, Workspace } from "@/types";
import { WorkspaceIcon } from "@/components/graphics/workspace-icon";
import { cn } from "@/lib/utils";
import { Search, Folder as FolderIcon, Home, Users, Settings } from "lucide-react";

interface PaletteItem {
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: React.ReactNode;
}

function flatten(folders: Folder[], root: Workspace[]): PaletteItem[] {
  const items: PaletteItem[] = [];
  const walkWs = (ws: Workspace) =>
    items.push({
      id: `ws-${ws.id}`,
      label: ws.title,
      hint: "Workspace",
      href: `/workspace/${ws.id}`,
      icon: <WorkspaceIcon icon={ws.icon} className="h-4 w-4" />,
    });
  const walk = (fs: Folder[]) => {
    for (const f of fs) {
      items.push({
        id: `folder-${f.id}`,
        label: f.name,
        hint: "Folder",
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

const pages: PaletteItem[] = [
  { id: "page-home", label: "Home", hint: "Page", href: "/", icon: <Home className="h-4 w-4" /> },
  { id: "page-shared", label: "Shared", hint: "Page", href: "/shared", icon: <Users className="h-4 w-4" /> },
  { id: "page-settings", label: "Settings", hint: "Page", href: "/settings", icon: <Settings className="h-4 w-4" /> },
];

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
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const items = useMemo(
    () => [...flatten(folders, rootWorkspaces), ...pages],
    [folders, rootWorkspaces],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 8);
    return items.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 8);
  }, [items, query]);

  const go = (item: PaletteItem) => {
    onClose();
    router.push(item.href);
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
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelected((s) => Math.min(s + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelected((s) => Math.max(s - 1, 0));
              } else if (e.key === "Enter" && results[selected]) {
                go(results[selected]);
              }
            }}
            placeholder="Search workspaces, folders, pages…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
          <kbd className="rounded border border-border px-1 text-[10px] text-faint">
            esc
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results for “{query}”
            </p>
          ) : (
            results.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item)}
                onMouseEnter={() => setSelected(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm",
                  i === selected
                    ? "bg-accent-soft text-foreground"
                    : "text-muted-foreground",
                )}
              >
                <span className="text-faint">{item.icon}</span>
                <span className="flex-1 truncate font-medium">{item.label}</span>
                <span className="text-[11px] text-faint">{item.hint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
