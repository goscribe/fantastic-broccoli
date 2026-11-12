"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api/notifications";
import { formatRelativeDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";

/** Bell + unread badge + popover, shared by the new shell header and the legacy top bar. */
export function NotificationBell() {
  const router = useRouter();
  const { t } = useI18n();
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
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
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    if (n.actionUrl) {
      setNotifOpen(false);
      router.push(n.actionUrl);
    }
  };

  return (
<div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={openNotifications}
                className="relative grid size-10 place-items-center rounded-xl border border-border bg-white text-foreground/70 hover:bg-muted"
                aria-label={t("misc.notifications")}
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[9px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-card py-1.5 animate-fade-up">
                  <div className="flex items-center justify-between border-b border-border px-3.5 py-2">
                    <p className="text-sm font-semibold">
                      {t("misc.notifications")}
                    </p>
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
                        {t("misc.markAllRead")}
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
                        {t("misc.allCaughtUp")}
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
  );
}
