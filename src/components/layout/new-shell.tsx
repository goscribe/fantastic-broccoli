"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { House, Layers, LogOut, Plus, Search, Settings, Sparkles, Users } from "lucide-react";
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
  { href: "/", label: "Learn", icon: House },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/shared", label: "Shared", icon: Users },
];

function flatten(folders: Folder[], root: Workspace[]): Workspace[] {
  const all = [...root];
  const walk = (fs: Folder[]) => {
    for (const f of fs) {
      all.push(...f.workspaces);
      if (f.folders) walk(f.folders);
    }
  };
  walk(folders);
  return all;
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
  const [creating, setCreating] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const load = () =>
      fetchWorkspaceTree()
        .then((tree) => {
          setFolders(tree.folders);
          setRootWorkspaces(tree.rootWorkspaces);
        })
        .catch(() => {});
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

  const workspaces = flatten(folders, rootWorkspaces);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? "";

  return (
    <div className="design-root flex h-dvh overflow-hidden bg-white text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[232px] shrink-0 flex-col border-r border-border bg-white px-3 py-5 transition-transform md:static md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Link href="/" className="mb-5 flex items-center gap-2.5 px-2" onClick={() => setMobileOpen(false)}>
          <Image src="/logo.png" alt="Scribe" width={28} height={28} />
          <span className="text-[17px] font-bold tracking-tight">Scribe</span>
        </Link>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-foreground/80 hover:bg-muted",
                isActive(href) && "bg-muted font-semibold text-foreground",
              )}
            >
              <Icon className="size-[18px]" strokeWidth={isActive(href) ? 2.2 : 1.8} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 px-3 text-[11px] font-semibold text-faint">My workspaces</div>
        <div className="mt-1.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {workspaces.map((w) => {
            const on = pathname.startsWith(`/workspace/${w.id}`);
            return (
              <Link
                key={w.id}
                href={`/workspace/${w.id}`}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex h-9 items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium hover:bg-muted",
                  on && "bg-accent-soft/70 text-accent-dim",
                )}
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: accentForId(w.id) }} />
                <span className="truncate">{w.title}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex h-9 items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium text-accent hover:bg-muted"
          >
            <Plus className="size-4" />
            New workspace
          </button>
        </div>
        <div className="mt-auto flex flex-col gap-0.5 pt-3">
          <Link
            href="/settings"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium text-foreground/80 hover:bg-muted",
              isActive("/settings") && "bg-muted font-semibold text-foreground",
            )}
          >
            <Settings className="size-[18px]" />
            Settings
          </Link>
          <div className="flex items-center gap-2.5 px-3 pt-2">
            {user?.profilePicture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.profilePicture} alt="" className="size-8 rounded-full object-cover" />
            ) : (
              <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-[13px] font-bold text-accent">{initial}</span>
            )}
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{user?.name}</span>
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
        <header className="flex h-[64px] shrink-0 items-center gap-3 px-5 sm:px-8">
          <button type="button" onClick={() => setMobileOpen(true)} className="grid size-10 place-items-center rounded-xl hover:bg-muted md:hidden" aria-label="Open sidebar">
            <Image src="/logo.png" alt="" width={24} height={24} />
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-10 w-full max-w-[320px] items-center gap-2.5 rounded-xl bg-muted px-3.5 text-[13.5px] text-faint hover:bg-accent-soft/50"
          >
            <Search className="size-4" />
            <span className="flex-1 text-left">Search notes, sessions, cards…</span>
            <kbd className="hidden rounded-md border border-border bg-white px-1.5 text-[11px] font-semibold text-faint sm:inline">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2.5">
            <span className="flex h-10 items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-[14px] font-semibold">
              <Sparkles className="size-[18px] text-accent" fill="currentColor" />
              {credits.toLocaleString()}
              <span className="font-medium text-faint">pts</span>
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
          kind="workspace"
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            if (id) router.push(`/workspace/${id}`);
          }}
        />
      )}
    </div>
  );
}
