"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sparkles,
  Sun,
  UserPlus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ScribeLogo } from "@/components/graphics/logo";
import { WorkspaceIcon } from "@/components/graphics/workspace-icon";
import { WorkspaceMembersDialog } from "@/components/workspace/workspace-members-dialog";
import { fetchWorkspace } from "@/lib/api/workspace";
import { useCredits } from "@/lib/credits";
import { resendVerification, signOut, useAuthUser } from "@/lib/api/auth";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api/notifications";
import { formatRelativeDate } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

export function TopBar({
  showLogo = false,
  onMenuClick,
}: {
  showLogo?: boolean;
  onMenuClick?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthUser();
  const credits = useCredits();
  const { theme, toggleTheme } = useTheme();
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [unread, setUnread] = useState(0);

  const sectionLabel = pathname.startsWith("/workspace")
    ? "Workspace"
    : pathname.startsWith("/folder")
      ? "Folders"
      : pathname === "/shared"
        ? "Shared with me"
        : pathname === "/settings"
          ? "Settings"
          : pathname === "/pricing"
            ? "Pricing"
            : "Home";

  const emailVerified = user?.emailVerified ?? true;
  const workspaceId = pathname.match(/^\/workspace\/([^/]+)/)?.[1] ?? null;

  const { data: workspace } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => fetchWorkspace(workspaceId!),
    enabled: !!workspaceId,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    fetchUnreadCount().then(setUnread).catch(() => {});
  }, []);

  const openNotifications = () => {
    setNotifOpen((v) => !v);
    if (!notifOpen) {
      setNotifLoading(true);
      fetchNotifications()
        .then(setNotifications)
        .catch(() => {})
        .finally(() => setNotifLoading(false));
    }
  };

  const onNotificationClick = (n: AppNotification) => {
    if (!n.read) {
      markNotificationRead(n.id).catch(() => {});
      setUnread((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
      );
    }
    if (n.actionUrl) {
      setNotifOpen(false);
      router.push(n.actionUrl);
    }
  };

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-5">
          <div className="flex items-center gap-2">
            {onMenuClick && (
              <button
                type="button"
                aria-label="Open sidebar"
                onClick={onMenuClick}
                className="-ml-2 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
            )}
            {showLogo && (
              <Link href="/">
                <ScribeLogo />
              </Link>
            )}
            <span className="hidden items-center gap-2 text-[13px] text-muted-foreground sm:flex">
              {showLogo && <span className="text-faint">/</span>}
              {workspaceId ? (
                <>
                  <Link href="/" className="hover:text-foreground">
                    Workspaces
                  </Link>
                  {workspace && (
                    <>
                      <span className="text-faint">/</span>
                      <WorkspaceIcon
                        icon={workspace.icon}
                        className="h-4 w-4 shrink-0"
                      />
                      <Link
                        href={`/workspace/${workspaceId}`}
                        className="max-w-48 truncate font-medium text-foreground"
                      >
                        {workspace.title}
                      </Link>
                    </>
                  )}
                </>
              ) : (
                sectionLabel
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {pathname.startsWith("/workspace") && (
              <button
                type="button"
                onClick={() => setMembersOpen(true)}
                className="hidden items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:flex"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Members
              </button>
            )}
            <Link
              href="/pricing"
              title="Credits and pricing"
              className="flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent-soft px-2.5 py-1 text-[12px] font-semibold tabular-nums text-accent hover:border-accent/50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {credits > 0 ? `${credits} credits` : "Out of credits"}
            </Link>
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={openNotifications}
                className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[9px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card py-1.5 animate-fade-up">
                  <div className="flex items-center justify-between border-b border-border px-3.5 py-2">
                    <p className="text-sm font-semibold">Notifications</p>
                    {unread > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          markAllNotificationsRead().catch(() => {});
                          setUnread(0);
                          setNotifications((prev) =>
                            prev.map((n) => ({ ...n, read: true })),
                          );
                        }}
                        className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifLoading ? (
                      <div className="space-y-3 px-3.5 py-3">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted animate-pulse" />
                            <div className="flex-1 space-y-1.5">
                              <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
                              <div className="h-2.5 w-1/2 rounded bg-muted animate-pulse" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : notifications.length === 0 ? (
                      <p className="px-3.5 py-6 text-center text-sm text-muted-foreground">
                        You&apos;re all caught up.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => onNotificationClick(n)}
                          className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-muted"
                        >
                          <span
                            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                              n.read ? "bg-transparent" : "bg-accent"
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium">
                              {n.title}
                            </span>
                            <span className="block line-clamp-2 text-xs text-muted-foreground">
                              {n.body}
                            </span>
                            <span className="mt-0.5 block text-[10px] text-faint">
                              {formatRelativeDate(n.createdAt)}
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Account menu"
                className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-accent/20 bg-accent-soft text-xs font-bold text-accent hover:border-accent/50"
              >
                {(user?.name ?? "?").charAt(0).toUpperCase()}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card py-1.5 animate-fade-up">
                  <div className="mb-1.5 border-b border-border px-3.5 py-2">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-[11px] text-faint">{user?.email ?? "Personal workspace"}</p>
                  </div>
                  {workspaceId && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setMembersOpen(true);
                      }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-muted"
                    >
                      <UserPlus className="h-4 w-4 text-muted-foreground" />
                      Members
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-muted"
                  >
                    {theme === "dark" ? (
                      <Sun className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Moon className="h-4 w-4 text-muted-foreground" />
                    )}
                    {theme === "dark" ? "Light mode" : "Dark mode"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      router.push("/settings");
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm hover:bg-muted"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    Settings
                  </button>
                  <div className="my-1.5 border-t border-border" />
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {!emailVerified && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-5 py-2 text-[12px] text-amber-900 dark:text-amber-100">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <span className="font-medium">
              Verify your email to unlock study tools and billing actions.
            </span>
            <button
              type="button"
              onClick={() => void resendVerification()}
              className="rounded-full border border-amber-500/30 bg-card px-3 py-1 font-semibold text-foreground hover:bg-muted"
            >
              Resend verification
            </button>
          </div>
        </div>
      )}

      <WorkspaceMembersDialog
        workspaceId={workspaceId}
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
      />
    </>
  );
}
