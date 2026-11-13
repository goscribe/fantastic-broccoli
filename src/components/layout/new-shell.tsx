"use client";

import { useEffect, useState, useMemo, useSyncExternalStore } from "react";
import Image from "next/image";
import { NotificationBell } from "@/components/layout/notification-bell";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Calendar, Folder as FolderIcon, House, LogOut, PanelLeft, PanelLeftClose, Plus, Search, Settings, Sparkles } from "lucide-react";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import { signOut, useAuthUser } from "@/lib/api/auth";
import { accentForId } from "@/lib/accent-palette";
import { useCredits } from "@/lib/credits";
import { onTreeChanged } from "@/lib/tree-events";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/layout/command-palette";
import { CreateResourceDialog } from "@/components/workspace/create-dialog";
import type { Folder, Workspace } from "@/types";
import "@/app/design/design.css";

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/planner", label: "Planner", icon: Calendar },
];

const RAIL_KEY = "scribe.sidebar.rail";
const NARROW = "(max-width: 1179px)";
const railListeners = new Set<() => void>();

function setRailPref(rail: boolean) {
  localStorage.setItem(RAIL_KEY, rail ? "1" : "0");
  railListeners.forEach((l) => l());
}

/** Icon-only rail on desktop: the learner's choice if they made one, otherwise automatic on narrow windows. */
function useRail(): boolean {
  const pref = useSyncExternalStore(
    (cb) => {
      railListeners.add(cb);
      return () => {
        railListeners.delete(cb);
      };
    },
    () => localStorage.getItem(RAIL_KEY),
    () => null,
  );
  const narrow = useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(NARROW);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
  return pref === null ? narrow : pref === "1";
}

/** Redesign app frame: left rail with nav + workspaces, slim top bar, page content. */
export function NewShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthUser();
  const credits = useCredits();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [rootWorkspaces, setRootWorkspaces] = useState<Workspace[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [creating, setCreating] = useState<"workspace" | "folder" | null>(null);
  /** Learners see one level: every workspace is a "folder" of materials. */
  const allWorkspaces = useMemo(() => {
    const out: Workspace[] = [...rootWorkspaces];
    const walk = (fs: Folder[]) => {
      for (const f of fs) {
        out.push(...f.workspaces);
        if (f.folders) walk(f.folders);
      }
    };
    walk(folders);
    return out;
  }, [folders, rootWorkspaces]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const rail = useRail();
  const [treeLoading, setTreeLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      fetchWorkspaceTree()
        .then((tree) => {
          setFolders(tree.folders);
          setRootWorkspaces(tree.rootWorkspaces);
        })
        .catch(() => {})
        .finally(() => setTreeLoading(false));
    load();
    return onTreeChanged(load);
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

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? "";

  return (
    <div className="design-root flex h-dvh overflow-hidden bg-white text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[256px] shrink-0 flex-col border-r border-border bg-white px-3.5 py-5 transition-transform md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          rail && "md:w-[68px] md:px-2.5",
        )}
      >
        <div className={cn("mb-6 flex items-center justify-between gap-2 pl-2", rail && "md:flex-col md:gap-3 md:pl-0")}>
          <Link href="/" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
            <Image src="/logo.png" alt="Scribe" width={28} height={28} />
            <span className={cn("text-[17px] font-bold tracking-tight", rail && "md:hidden")}>Scribe</span>
          </Link>
          <button
            type="button"
            onClick={() => setRailPref(!rail)}
            aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
            title={rail ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden size-8 place-items-center rounded-lg text-faint hover:bg-muted hover:text-foreground md:grid"
          >
            {rail ? <PanelLeft className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              title={rail ? label : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-foreground/80 hover:bg-muted",
                isActive(href) && "bg-muted font-semibold text-foreground",
                rail && "md:justify-center md:px-0",
              )}
            >
              <Icon className="size-[18px] shrink-0" strokeWidth={isActive(href) ? 2.2 : 1.8} />
              <span className={cn(rail && "md:hidden")}>{label}</span>
            </Link>
          ))}
        </nav>
        <div className={cn("mt-7 px-3 text-[11px] font-semibold text-faint", rail && "md:hidden")}>Subjects</div>
        <div className={cn("mx-2 mt-4 hidden border-t border-border", rail && "md:block")} />
        <div className={cn("mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto [scrollbar-width:thin]", rail && "md:mt-3")}>
          {treeLoading &&
            allWorkspaces.length === 0 &&
            [0, 1, 2].map((i) => <span key={i} className="mx-3 my-2 block h-4 animate-pulse rounded bg-muted" style={{ width: `${70 - i * 12}%` }} />)}
          {allWorkspaces.map((w) => {
            const on = pathname.startsWith(`/workspace/${w.id}`);
            return (
              <Link
                key={w.id}
                href={`/workspace/${w.id}`}
                onClick={() => setMobileOpen(false)}
                title={w.title}
                className={cn(
                  "flex min-h-10 shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium leading-snug hover:bg-muted",
                  on && "bg-accent-soft/70 text-accent-dim",
                  rail && "md:justify-center md:px-0",
                )}
              >
                <FolderIcon
                  className={cn("size-4 shrink-0", rail && "md:hidden")}
                  style={{ color: accentForId(w.id) }}
                  fill="currentColor"
                  strokeWidth={1.5}
                />
                <span
                  aria-hidden
                  className={cn("hidden size-7 place-items-center rounded-lg text-[12px] font-bold text-white", rail && "md:grid")}
                  style={{ backgroundColor: accentForId(w.id) }}
                >
                  {w.title.trim()[0]?.toUpperCase() ?? "?"}
                </span>
                <span className={cn("line-clamp-2 min-w-0 break-words", rail && "md:hidden")}>{w.title}</span>
              </Link>
            );
          })}
          <Link
            href="/new-subject"
            onClick={() => setMobileOpen(false)}
            title={rail ? "New subject" : undefined}
            className={cn(
              "flex h-10 shrink-0 items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium text-accent hover:bg-muted",
              rail && "md:justify-center md:px-0",
            )}
          >
            <Plus className="size-4 shrink-0" />
            <span className={cn(rail && "md:hidden")}>New subject</span>
          </Link>
        </div>
        <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3">
          <Link
            href="/settings"
            onClick={() => setMobileOpen(false)}
            title={rail ? "Settings" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-foreground/80 hover:bg-muted",
              isActive("/settings") && "bg-muted font-semibold text-foreground",
              rail && "md:justify-center md:px-0",
            )}
          >
            <Settings className="size-[18px] shrink-0" />
            <span className={cn(rail && "md:hidden")}>Settings</span>
          </Link>
          <div className={cn("flex items-center gap-2.5 px-3 pt-2", rail && "md:flex-col md:gap-1 md:px-0")}>
            {user?.profilePicture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.profilePicture} alt="" className="size-8 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-bold text-accent">{initial}</span>
            )}
            <span className={cn("min-w-0 flex-1 truncate text-[13px] font-semibold", rail && "md:hidden")}>{user?.name}</span>
            <button
              type="button"
              aria-label="Sign out"
              onClick={() => {
                void signOut().then(() => router.push("/login"));
              }}
              className="grid size-8 place-items-center rounded-lg text-faint hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
      {mobileOpen && (
        <button type="button" aria-label="Close sidebar" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-foreground/20 md:hidden" />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="flex h-[64px] shrink-0 items-center gap-2 px-4 sm:gap-3 sm:px-8">
          <button type="button" onClick={() => setMobileOpen(true)} className="grid size-10 place-items-center rounded-xl hover:bg-muted md:hidden" aria-label="Open sidebar">
            <Image src="/logo.png" alt="" width={24} height={24} />
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
            className="flex h-10 w-10 shrink-0 items-center justify-center gap-2.5 rounded-xl bg-muted text-[13.5px] text-faint hover:bg-accent-soft/50 sm:w-full sm:max-w-[320px] sm:justify-start sm:px-3.5"
          >
            <Search className="size-4" />
            <span className="hidden flex-1 truncate text-left sm:inline">Search notes, sessions, cards…</span>
            <kbd className="hidden rounded-md border border-border bg-white px-1.5 text-[11px] font-semibold text-faint sm:inline">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
            <NotificationBell />
            <span className="flex h-10 items-center gap-1.5 rounded-xl border border-border bg-white px-2.5 text-[14px] font-semibold sm:px-3">
              <Sparkles className="size-[18px] text-accent" fill="currentColor" />
              {credits.toLocaleString()}
              <span className="hidden font-medium text-faint sm:inline">pts</span>
            </span>
            <Link href="/settings" aria-label="Settings" className="block">
              {user?.profilePicture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.profilePicture} alt="" className="size-10 rounded-full object-cover" />
              ) : (
                <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-[14px] font-bold text-accent">{initial}</span>
              )}
            </Link>
          </div>
        </header>
        {children}
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} folders={folders} rootWorkspaces={rootWorkspaces} />
      {creating && (
        <CreateResourceDialog
          kind={creating}
          onClose={() => setCreating(null)}
          onCreated={(id) => {
            setCreating(null);
            if (id) router.push(`/workspace/${id}`);
          }}
        />
      )}
    </div>
  );
}
