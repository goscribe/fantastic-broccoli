"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Settings, UserPlus, Bell, Palette, LogOut, Check, X, Menu, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScribeLogo } from "@/components/graphics/logo";
import { signOut, useAuthUser } from "@/lib/api/auth";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api/notifications";
import { inviteMember } from "@/lib/api/workspace";
import { formatRelativeDate } from "@/lib/utils";
import { useCredits } from "@/lib/credits";

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

  const sectionLabel = pathname.startsWith("/workspace")
    ? "Workspace"
    : pathname.startsWith("/folder")
      ? "Folders"
      : pathname === "/shared"
        ? "Shared with me"
        : pathname === "/settings"
          ? "Settings"
          : "Home";
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invited, setInvited] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

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

  const workspaceId = pathname.match(/^\/workspace\/([^/]+)/)?.[1];

  const sendInvite = async () => {
    const email = inviteEmail.trim();
    if (!email || !workspaceId || inviting) return;
    setInviting(true);
    setInviteError(null);
    try {
      await inviteMember(workspaceId, email);
      setInvited((prev) => [...prev, email]);
      setInviteEmail("");
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : "Failed to send invite.",
      );
    }
    setInviting(false);
  };

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur-md">
        <div className="px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onMenuClick && (
              <button
                type="button"
                aria-label="Open sidebar"
                onClick={onMenuClick}
                className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted md:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
            )}
            {showLogo && (
              <Link href="/">
                <ScribeLogo />
              </Link>
            )}
            <span className="hidden sm:flex items-center gap-2 text-[13px] text-muted-foreground">
              {showLogo && <span className="text-faint">/</span>}
              {sectionLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {pathname.startsWith("/workspace") && (
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Share
              </button>
            )}
            <span
              title="Credits — earned by completing study sessions"
              className="flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent tabular-nums"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {credits}
            </span>
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={openNotifications}
                className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
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
                            <span className="block text-xs text-muted-foreground line-clamp-2">
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
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Account menu"
                className="ml-1 h-7 w-7 rounded-full bg-accent-soft border border-accent/20 flex items-center justify-center text-xs font-bold text-accent hover:border-accent/50"
              >
                {(user?.name ?? "?").charAt(0).toUpperCase()}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card py-1.5 animate-fade-up">
                  <div className="px-3.5 py-2 border-b border-border mb-1.5">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-[11px] text-faint">
                      {user?.email ?? "Personal workspace"}
                    </p>
                  </div>
                  {workspaceId && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setInviteOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-muted text-left"
                    >
                      <UserPlus className="h-4 w-4 text-muted-foreground" />
                      Invite people
                    </button>
                  )}
                  <button
                    type="button"
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-muted text-left"
                  >
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    Appearance
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      router.push("/settings");
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-muted text-left"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    Settings
                  </button>
                  <div className="my-1.5 border-t border-border" />
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-muted text-left text-muted-foreground"
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

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 animate-fade-up">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold tracking-tight">
                Invite people
              </h2>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Invite classmates to study together and share materials.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void sendInvite()}
                placeholder="name@school.edu"
                className="flex-1 h-10 rounded-xl border border-border bg-background px-3.5 text-sm focus:outline-none focus:border-accent/50 placeholder:text-faint"
              />
              <Button
                size="md"
                onClick={() => void sendInvite()}
                disabled={!inviteEmail.trim() || !workspaceId || inviting}
              >
                {inviting ? "Inviting…" : "Invite"}
              </Button>
            </div>
            {inviteError && (
              <p className="mt-3 text-sm text-rose">{inviteError}</p>
            )}
            {invited.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {invited.map((email) => (
                  <div
                    key={email}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Check className="h-3.5 w-3.5 text-success" />
                    Invited {email}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
