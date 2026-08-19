"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ScribeLogo } from "@/components/graphics/logo";
import { WorkspaceIcon } from "@/components/graphics/workspace-icon";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import { onTreeChanged } from "@/lib/tree-events";
import { signOut, useAuthUser } from "@/lib/api/auth";
import {
  fetchAccountSummary,
  formatBytes,
  type AccountSummary,
} from "@/lib/api/account";
import { Folder as FolderType, Workspace } from "@/types";
import { CreateResourceDialog } from "@/components/workspace/create-dialog";
import { CommandPalette } from "@/components/layout/command-palette";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import {
  Home,
  Layers,
  ChevronRight,
  FilePlus2,
  FolderPlus,
  Plus,
  Search,
  X,
  Users,
  Settings,
  LogOut,
} from "lucide-react";

function FolderNode({
  folder,
  depth,
  expanded,
  toggle,
  onNewInFolder,
}: {
  folder: FolderType;
  depth: number;
  expanded: Record<string, boolean>;
  toggle: (id: string) => void;
  onNewInFolder: (folderId: string) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isOpen = expanded[folder.id] ?? true;
  const active = pathname === `/folder/${folder.id}`;

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md py-1 pr-2 text-[13px] font-medium",
          active
            ? "bg-accent-soft text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
      >
        <button
          type="button"
          aria-label={isOpen ? "Collapse folder" : "Expand folder"}
          onClick={() => toggle(folder.id)}
          className="p-0.5 -m-0.5 rounded hover:bg-border"
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-faint transition-transform",
              isOpen && "rotate-90",
            )}
          />
        </button>
        <button
          type="button"
          onClick={() => router.push(`/folder/${folder.id}`)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4 shrink-0"
            fill={folder.color}
            aria-hidden
          >
            <path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3.2c.4 0 .8.16 1.06.44l.9.92c.19.19.45.3.72.3H13A1.5 1.5 0 0 1 14.5 5.7v6.3A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12V4z" />
          </svg>
          <span className="truncate">{folder.name}</span>
        </button>
        <button
          type="button"
          aria-label={`New workspace in ${folder.name}`}
          onClick={() => onNewInFolder(folder.id)}
          className="ml-auto shrink-0 rounded p-0.5 -m-0.5 text-faint opacity-0 hover:bg-border group-hover:opacity-100"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {isOpen && (
        <div>
          {folder.folders?.map((sub) => (
            <FolderNode
              key={sub.id}
              folder={sub}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              onNewInFolder={onNewInFolder}
            />
          ))}
          {folder.workspaces.map((ws) => {
            const active = pathname.startsWith(`/workspace/${ws.id}`);
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => router.push(`/workspace/${ws.id}`)}
                className={cn(
                  "w-full flex items-center gap-1.5 rounded-md py-1 pr-2 text-[13px] text-left",
                  active
                    ? "bg-accent-soft text-accent font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                style={{ paddingLeft: `${(depth + 1) * 14 + 24}px` }}
              >
                <WorkspaceIcon icon={ws.icon} className="h-4 w-4 shrink-0" />
                <span className="truncate">{ws.title}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  mobileOpen = false,
  onMobileClose,
}: {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const { user } = useAuthUser();
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [rootWorkspaces, setRootWorkspaces] = useState<Workspace[]>([]);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [treeLoading, setTreeLoading] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [creating, setCreating] = useState<{
    kind: "folder" | "workspace";
    parentId?: string;
  } | null>(null);
  const router = useRouter();
  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));

  const loadTree = () =>
    fetchWorkspaceTree()
      .then((tree) => {
        setFolders(tree.folders);
        setRootWorkspaces(tree.rootWorkspaces);
      })
      .catch(() => {})
      .finally(() => setTreeLoading(false));

  useEffect(() => {
    loadTree();
    fetchAccountSummary()
      .then(setSummary)
      .catch(() => {});
    return onTreeChanged(loadTree);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    onMobileClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <aside
      className={cn(
        "w-72 shrink-0 flex-col bg-card border-r border-border",
        "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:transition-transform",
        mobileOpen ? "flex" : "max-md:-translate-x-full hidden md:flex",
      )}
    >
      <div className="flex items-center px-4 h-14">
        <ScribeLogo />
        {onMobileClose && (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={onMobileClose}
            className="ml-auto p-1.5 rounded-md text-muted-foreground hover:bg-muted md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="px-3">
        <button
          type="button"
          data-tour="sidebar-search"
          onClick={() => setPaletteOpen(true)}
          className="w-full flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-[13px] text-faint hover:border-border-strong"
        >
          <Search className="h-3.5 w-3.5" />
          Search…
          <kbd className="ml-auto text-[10px] text-faint border border-border rounded px-1">
            ⌘K
          </kbd>
        </button>
      </div>

      <nav
        className="flex-1 overflow-y-auto px-3 py-3 space-y-4"
        data-tour="workspace-tree"
      >
        <div className="space-y-px">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] font-medium",
              pathname === "/"
                ? "bg-accent-soft text-accent"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Home className="h-4 w-4" />
            {t("nav.home")}
          </Link>
          <Link
            href="/flashcards"
            className={cn(
              "flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] font-medium",
              pathname.startsWith("/flashcards")
                ? "bg-accent-soft text-accent"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Layers className="h-4 w-4" />
            {t("nav.flashcards")}
          </Link>
          <Link
            href="/shared"
            className={cn(
              "flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] font-medium",
              pathname.startsWith("/shared")
                ? "bg-accent-soft text-accent"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Users className="h-4 w-4" />
            {t("nav.shared")}
          </Link>
        </div>

        <div>
            <div className="flex items-center justify-between px-1.5 pb-1">
              <span className="text-xs font-semibold text-faint">{t("nav.folders")}</span>
              <div className="flex items-center gap-0.5" data-tour="new-workspace">
                <button
                  type="button"
                  aria-label={t("nav.newWorkspace")}
                  title={t("nav.newWorkspace")}
                  onClick={() => setCreating({ kind: "workspace" })}
                  className="p-0.5 rounded text-faint hover:text-foreground hover:bg-muted"
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={t("nav.newFolder")}
                  title={t("nav.newFolder")}
                  onClick={() => setCreating({ kind: "folder" })}
                  className="p-0.5 rounded text-faint hover:text-foreground hover:bg-muted"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="space-y-px">
              {treeLoading &&
                Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-1.5 py-1">
                    <Skeleton className="h-4 w-4 rounded shrink-0" />
                    <Skeleton
                      className="h-3.5 rounded"
                      style={{ width: `${55 + ((i * 17) % 30)}%` }}
                    />
                  </div>
                ))}
              {folders.map((folder) => (
                <FolderNode
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  expanded={expanded}
                  toggle={toggle}
                  onNewInFolder={(folderId) =>
                    setCreating({ kind: "workspace", parentId: folderId })
                  }
                />
              ))}
              {rootWorkspaces.map((ws) => {
                const active = pathname.startsWith(`/workspace/${ws.id}`);
                return (
                  <Link
                    key={ws.id}
                    href={`/workspace/${ws.id}`}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md py-1 px-1.5 text-[13px]",
                      active
                        ? "bg-accent-soft text-accent font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <WorkspaceIcon icon={ws.icon} className="h-4 w-4 shrink-0" />
                    <span className="truncate">{ws.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
      </nav>

      <div
        className="shrink-0 border-t border-border px-3 py-3 space-y-2"
        data-tour="sidebar-footer"
      >
        {summary && (
          <div className="rounded-md border border-border bg-muted/40 px-2.5 py-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-muted-foreground">
                {summary.planName} plan
              </span>
              <span className="text-faint">
                {summary.tokenBalance} / {summary.monthlyTokens} tokens
              </span>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full bg-accent"
                style={{
                  width: `${
                    summary.monthlyTokens > 0
                      ? Math.min(100, (summary.tokenBalance / summary.monthlyTokens) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-faint">{t("nav.storage")}</span>
              <span className="text-faint">
                {formatBytes(summary.storageUsedBytes)} /{" "}
                {formatBytes(summary.storageLimitBytes)}
              </span>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full bg-accent"
                style={{
                  width: `${Math.min(100, (summary.storageUsedBytes / summary.storageLimitBytes) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] font-medium",
            pathname.startsWith("/settings")
              ? "bg-accent-soft text-accent"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Settings className="h-4 w-4" />
          {t("nav.settings")}
        </Link>
        {user && (
          <div className="flex items-center gap-2 px-1.5 pt-1">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-[12px] font-semibold text-accent">
              {user.profilePicture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.profilePicture}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-medium">{user.name}</p>
              <p className="truncate text-[11px] text-faint">
                {user.email ?? "Personal workspace"}
              </p>
            </div>
            <button
              type="button"
              aria-label={t("nav.signOut")}
              onClick={() => signOut()}
              className="p-1.5 rounded-md text-faint hover:text-foreground hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        folders={folders}
        rootWorkspaces={rootWorkspaces}
      />

      {creating && (
        <CreateResourceDialog
          kind={creating.kind}
          parentId={creating.parentId}
          onClose={() => setCreating(null)}
          onCreated={(workspaceId) => {
            if (workspaceId) router.push(`/workspace/${workspaceId}`);
            else loadTree();
          }}
        />
      )}
    </aside>
  );
}
