"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ScribeMark } from "@/components/graphics/logo";
import { accentForId } from "@/lib/accent-palette";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import { fetchStudySessions } from "@/lib/api/study";
import { onTreeChanged } from "@/lib/tree-events";
import { signOut, useAuthUser } from "@/lib/api/auth";
import { fetchAccountSummary, type AccountSummary } from "@/lib/api/account";
import { Folder as FolderType, StudySession, Workspace } from "@/types";
import { CreateResourceDialog } from "@/components/workspace/create-dialog";
import { CommandPalette } from "@/components/layout/command-palette";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";
import {
  Home,
  Layers,
  Users,
  ChevronRight,
  FolderPlus,
  Plus,
  Search,
  X,
  Settings,
  LogOut,
  Folder,
  Check,
  Loader2,
} from "lucide-react";

type RecentSession = { session: StudySession; workspace: Workspace };

const navRow =
  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-left transition-colors";
const navIdle = "text-foreground/80 hover:bg-muted hover:text-foreground";
const navActive = "bg-accent-soft text-accent font-medium";

function SectionLabel({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mt-4 mb-1 flex items-center px-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
        {children}
      </span>
      <div className="ml-auto flex items-center gap-0.5">{action}</div>
    </div>
  );
}

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
        className={cn("group", navRow, "py-1 pr-1", active ? navActive : navIdle)}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button
          type="button"
          aria-label={isOpen ? "Collapse folder" : "Expand folder"}
          onClick={() => toggle(folder.id)}
          className="-m-0.5 rounded p-0.5 hover:bg-border"
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
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <Folder
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: folder.color || accentForId(folder.id), fill: `${folder.color || accentForId(folder.id)}33` }}
          />
          <span className="truncate">{folder.name}</span>
        </button>
        <button
          type="button"
          aria-label={`New workspace in ${folder.name}`}
          onClick={() => onNewInFolder(folder.id)}
          className="ml-auto shrink-0 rounded p-0.5 text-faint opacity-0 hover:bg-border group-hover:opacity-100"
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
          {folder.workspaces.map((ws) => (
            <WorkspaceRow key={ws.id} ws={ws} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkspaceRow({ ws, depth }: { ws: Workspace; depth: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = pathname.startsWith(`/workspace/${ws.id}`);
  return (
    <button
      type="button"
      onClick={() => router.push(`/workspace/${ws.id}`)}
      className={cn(navRow, "py-1", active ? navActive : navIdle)}
      style={{ paddingLeft: `${depth * 12 + 22}px` }}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-sm"
        style={{ background: accentForId(ws.id) }}
      />
      <span className="truncate">{ws.title}</span>
    </button>
  );
}

function RecentSessionRow({
  item,
  statusLabel,
}: {
  item: RecentSession;
  statusLabel: string;
}) {
  const pathname = usePathname();
  const { session, workspace } = item;
  const href = `/workspace/${workspace.id}/session/${session.id}`;
  const active = pathname === href;
  const done = session.status === "completed";
  const generating = session.activities.length === 0 && session.status === "active";
  return (
    <Link
      href={href}
      className={cn(navRow, "items-start py-1.5", active ? navActive : navIdle)}
    >
      <span className="mt-[5px] flex h-3 w-3 shrink-0 items-center justify-center">
        {generating ? (
          <Loader2 className="h-3 w-3 animate-spin text-accent" />
        ) : done ? (
          <Check className="h-3 w-3 text-success" />
        ) : (
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: accentForId(workspace.id) }}
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-foreground/90">{session.title}</span>
        <span className="block truncate text-[11px] text-faint">{statusLabel}</span>
      </span>
    </Link>
  );
}

function flattenWorkspaces(folders: FolderType[], root: Workspace[]): Workspace[] {
  const out: Workspace[] = [...root];
  const walk = (f: FolderType) => {
    out.push(...f.workspaces);
    f.folders?.forEach(walk);
  };
  folders.forEach(walk);
  return out;
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
  const [recent, setRecent] = useState<RecentSession[] | null>(null);
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
      .then(async (tree) => {
        setFolders(tree.folders);
        setRootWorkspaces(tree.rootWorkspaces);
        const all = flattenWorkspaces(tree.folders, tree.rootWorkspaces);
        const lists = await Promise.all(
          all.slice(0, 12).map((w) =>
            fetchStudySessions(w.id)
              .then((sessions) => sessions.map((session) => ({ session, workspace: w })))
              .catch(() =>
                w.sessions.map((session) => ({ session, workspace: w })),
              ),
          ),
        );
        const items = lists
          .flat()
          .sort((a, b) => b.session.updatedAt.localeCompare(a.session.updatedAt))
          .slice(0, 8);
        setRecent(items);
      })
      .catch(() => setRecent([]))
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

  const statusFor = (item: RecentSession) => {
    const { session, workspace } = item;
    const total = session.activities.length;
    if (total === 0 && session.status === "active") return t("nav.generating");
    if (session.status === "completed") return `${t("nav.done")} · ${workspace.title}`;
    const doneCount = session.activities.filter((a) => a.status === "completed").length;
    return `${doneCount}/${total} · ${workspace.title}`;
  };

  const tokenPct = useMemo(() => {
    if (!summary || !summary.monthlyTokens) return 0;
    return Math.min(100, Math.round((summary.tokenBalance / summary.monthlyTokens) * 100));
  }, [summary]);

  const nav = [
    { href: "/", label: t("nav.home"), icon: Home, exact: true },
    { href: "/flashcards", label: t("nav.flashcards"), icon: Layers },
    { href: "/shared", label: t("nav.shared"), icon: Users },
  ];

  return (
    <aside
      className={cn(
        "w-64 shrink-0 flex-col border-r border-border bg-background",
        "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:transition-transform",
        "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
        mobileOpen ? "flex" : "max-md:-translate-x-full hidden md:flex",
      )}
    >
      <div className="flex h-12 items-center gap-2 px-3">
        <ScribeMark className="h-6 w-6" />
        <span className="text-[15px] font-bold tracking-tight">Scribe</span>
        <button
          type="button"
          aria-label="Search"
          data-tour="sidebar-search"
          onClick={() => setPaletteOpen(true)}
          className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Search className="h-4 w-4" />
        </button>
        {onMobileClose && (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={onMobileClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="px-2">
        <Link
          href="/study-bot"
          data-tour="new-workspace"
          className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium text-accent-foreground shadow-xs hover:bg-accent-dim"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("nav.newSession")}
        </Link>
      </div>

      <nav className="mt-2 flex flex-col gap-px px-2">
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={cn(navRow, active ? navActive : navIdle)}>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <SectionLabel>{t("nav.recent")}</SectionLabel>
        {recent === null ? (
          <div className="space-y-2 px-2 py-1">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ) : recent.length === 0 ? (
          <p className="px-2 py-1 text-[12px] text-faint">{t("nav.noRecent")}</p>
        ) : (
          <div className="flex flex-col gap-px">
            {recent.map((item) => (
              <RecentSessionRow
                key={item.session.id}
                item={item}
                statusLabel={statusFor(item)}
              />
            ))}
          </div>
        )}

        <SectionLabel
          action={
            <>
              <button
                type="button"
                aria-label={t("nav.newFolder")}
                title={t("nav.newFolder")}
                onClick={() => setCreating({ kind: "folder" })}
                className="rounded p-1 text-faint hover:bg-muted hover:text-foreground"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={t("nav.newWorkspace")}
                title={t("nav.newWorkspace")}
                onClick={() => setCreating({ kind: "workspace" })}
                className="rounded p-1 text-faint hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </>
          }
        >
          {t("nav.workspaces")}
        </SectionLabel>
        <div data-tour="workspace-tree">
          {treeLoading ? (
            <div className="space-y-2 px-2 py-1">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3.5 w-1/2" />
            </div>
          ) : (
            <>
              {folders.map((folder) => (
                <FolderNode
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  expanded={expanded}
                  toggle={toggle}
                  onNewInFolder={(parentId) => setCreating({ kind: "workspace", parentId })}
                />
              ))}
              {rootWorkspaces.map((ws) => (
                <WorkspaceRow key={ws.id} ws={ws} depth={0} />
              ))}
              {folders.length === 0 && rootWorkspaces.length === 0 && (
                <p className="px-2 py-1 text-[12px] text-faint">{t("nav.noWorkspaces")}</p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="border-t border-border px-2 py-2" data-tour="sidebar-footer">
        {summary && (
          <Link
            href="/settings/billing"
            className="mb-1 block rounded-md px-2 py-1.5 hover:bg-muted"
          >
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">{summary.planName}</span>
              <span>
                {summary.tokenBalance.toLocaleString()} {t("nav.tokens").toLowerCase()}
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${tokenPct}%` }}
              />
            </div>
          </Link>
        )}
        <Link
          href="/settings"
          className={cn(navRow, pathname.startsWith("/settings") ? navActive : navIdle)}
        >
          <Settings className="h-4 w-4" />
          {t("nav.settings")}
        </Link>
        <div className="mt-1 flex items-center gap-2 px-2 py-1">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground">
            {(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
            {user?.name || user?.email}
          </span>
          <button
            type="button"
            aria-label={t("nav.signOut")}
            onClick={() => signOut()}
            className="rounded-md p-1 text-faint hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
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
