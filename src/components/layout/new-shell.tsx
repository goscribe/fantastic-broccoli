"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { NotificationBell } from "@/components/layout/notification-bell";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Calendar, House, LogOut, NotebookText, PanelLeft, PanelLeftClose, PlayCircle, RotateCcw, Search, Settings } from "lucide-react";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import { signOut, useAuthUser } from "@/lib/api/auth";
import { PointsPill, StreakButton } from "@/components/rewards/streak-button";
import { useStreak } from "@/lib/rewards";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/rewards";
import "@/lib/i18n/mistakes";
import "@/lib/i18n/today";
import { onTreeChanged } from "@/lib/tree-events";
import { cn } from "@/lib/utils";
import { AppTourHost, requestAppTour } from "@/components/onboarding/app-tour";
import { CommandPalette } from "@/components/layout/command-palette";
import type { Folder, Workspace } from "@/types";
import "@/app/design/design.css";

const NAV: { href: string; label: string; labelKey?: string; icon: typeof House }[] = [
  { href: "/", label: "Home", labelKey: "nav.home", icon: House },
  // Scribe's own notes, inside the app (the public pages are /notes).
  { href: "/library", label: "Notes", icon: NotebookText },
  { href: "/planner", label: "Planner", labelKey: "today.planner", icon: Calendar },
  { href: "/mistakes", label: "Mistakes", labelKey: "mistakes.nav", icon: RotateCcw },
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

/** Redesign app frame: left rail with nav (subjects live on home), slim top bar, page content. */
export function NewShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthUser();
  const { t } = useI18n();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [rootWorkspaces, setRootWorkspaces] = useState<Workspace[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
  const rail = useRail();
  const { data: streak } = useStreak();
  const started = !!streak && (streak.longest > 0 || streak.current > 0 || streak.todayDone);
  // Subjects live on home's tiles, not in the sidebar. The tree is only for
  // search, so it loads the first time search opens (not on every page load).
  const treeLoaded = useRef(false);
  const treeUnsub = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!paletteOpen || treeLoaded.current) return;
    treeLoaded.current = true;
    const load = () =>
      fetchWorkspaceTree()
        .then((tree) => {
          setFolders(tree.folders);
          setRootWorkspaces(tree.rootWorkspaces);
        })
        .catch(() => {});
    void load();
    treeUnsub.current = onTreeChanged(load);
  }, [paletteOpen]);
  useEffect(() => () => treeUnsub.current?.(), []);

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
    <div className="design-root app-brand flex h-dvh overflow-hidden bg-[var(--page)] text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[256px] shrink-0 flex-col border-r border-border bg-white px-3.5 py-5 transition-transform md:static md:translate-x-0 md:border-r-0 md:bg-transparent",
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
          {NAV.map(({ href, label: fallbackLabel, labelKey, icon: Icon }) => {
            const label = labelKey ? t(labelKey) : fallbackLabel;
            return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              title={rail ? label : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-[var(--r-control)] px-4 text-[14.5px] font-bold text-foreground/70 transition-colors hover:bg-muted/70",
                isActive(href) && "bg-[var(--accent-tint)] text-accent-dim hover:bg-[var(--accent-tint)]",
                rail && "md:justify-center md:px-0",
              )}
            >
              <Icon className="size-[18px] shrink-0" strokeWidth={isActive(href) ? 2.2 : 1.8} />
              <span className={cn(rail && "md:hidden")}>{label}</span>
            </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              requestAppTour();
            }}
            title={rail ? "How Scribe works" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-xl px-3 text-left text-[14px] font-medium text-foreground/80 hover:bg-muted",
              rail && "md:justify-center md:px-0",
            )}
          >
            <PlayCircle className="size-[18px] shrink-0" />
            <span className={cn(rail && "md:hidden")}>How Scribe works</span>
          </button>
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
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[13px] font-bold text-foreground">{initial}</span>
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

      {/* Room for the phone bottom nav (and the home indicator) under the last row. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto max-md:pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <header className="flex h-[64px] shrink-0 items-center gap-2 px-4 sm:gap-3 sm:px-8">
          <button type="button" onClick={() => setMobileOpen(true)} className="grid size-10 place-items-center rounded-xl hover:bg-muted md:hidden" aria-label="Open sidebar">
            <Image src="/logo.png" alt="" width={24} height={24} />
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
            className="flex h-10 w-10 shrink-0 items-center justify-center gap-2.5 rounded-xl bg-muted text-[13.5px] text-faint hover:bg-border sm:w-full sm:max-w-[320px] sm:justify-start sm:px-3.5"
          >
            <Search className="size-4" />
            <span className="hidden flex-1 truncate text-left sm:inline">Search notes, sessions, cards…</span>
            <kbd className="hidden rounded-md border border-border bg-white px-1.5 text-[11px] font-semibold text-faint sm:inline">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
            {/* First run (nothing finished yet): no streak, points or bell to explain. They appear with the first finished activity. */}
            {started && (
              <>
                <NotificationBell />
                <StreakButton />
                {/* The points pill is the way into the shop. */}
                <PointsPill />
              </>
            )}
            <Link href="/settings" aria-label="Settings" className="block">
              {user?.profilePicture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.profilePicture} alt="" className="size-10 rounded-full object-cover" />
              ) : (
                <span className="grid size-10 place-items-center rounded-full bg-muted text-[14px] font-bold text-foreground">{initial}</span>
              )}
            </Link>
          </div>
        </header>
        {children}
        <AppTourHost />
      </div>

      {/* Phones: the four places you go every day, one thumb away (the drawer holds settings; subjects are on home). */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV.map(({ href, label: fallbackLabel, labelKey, icon: Icon }) => {
          const label = labelKey ? t(labelKey) : fallbackLabel;
          const on = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "group flex h-16 flex-col items-center justify-center gap-0.5 text-[11.5px] font-bold",
                on ? "text-accent-dim" : "text-muted-foreground",
              )}
            >
              {/* Active tab: a soft pill behind a filled icon. */}
              <span
                className={cn(
                  "grid h-8 w-[52px] place-items-center rounded-[10px] transition-[background-color,transform] duration-200 group-active:scale-90 motion-reduce:transition-none",
                  on ? "bg-[var(--accent-tint)]" : "group-hover:bg-muted",
                )}
              >
                <Icon className="size-[22px]" strokeWidth={on ? 2.4 : 1.9} fill={on ? "currentColor" : "none"} fillOpacity={on ? 0.18 : 0} />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} folders={folders} rootWorkspaces={rootWorkspaces} />
    </div>
  );
}
