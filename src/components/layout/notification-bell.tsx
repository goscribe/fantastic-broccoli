"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api/notifications";
import { cn, formatRelativeDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";

/** A list request that has not answered by then is shown as failed, with Retry (it may still land). */
const LIST_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      },
    );
  });
}

/** Bell + unread badge + popover, shared by the new shell header and the legacy top bar. */
export function NotificationBell() {
  const router = useRouter();
  const { t } = useI18n();
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  /** The last list we got; null until the first answer. Kept on screen while a refresh runs. */
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifFailed, setNotifFailed] = useState(false);
  const [unread, setUnread] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /** Asks for the list; only the newest request's answer counts. */
  const fetchList = useCallback(() => {
    const id = ++requestId.current;
    withTimeout(fetchNotifications(), LIST_TIMEOUT_MS)
      .then((items) => {
        if (id === requestId.current) setNotifications(items);
      })
      .catch(() => {
        if (id === requestId.current) setNotifFailed(true);
      })
      .finally(() => {
        if (id === requestId.current) setNotifLoading(false);
      });
  }, []);

  const loadList = useCallback(() => {
    setNotifLoading(true);
    setNotifFailed(false);
    fetchList();
  }, [fetchList]);

  // The count and the list load together, so the panel usually opens on a list that is already there.
  useEffect(() => {
    fetchUnreadCount().then(setUnread).catch(() => {});
    fetchList();
  }, [fetchList]);

  const openNotifications = () => {
    setNotifOpen((v) => !v);
    if (!notifOpen) {
      // Refresh in the background; the last list stays visible meanwhile.
      fetchUnreadCount().then(setUnread).catch(() => {});
      loadList();
    }
  };

  const onNotificationClick = (n: AppNotification) => {
    if (!n.read) {
      markNotificationRead(n.id).catch(() => {});
      setUnread((c) => Math.max(0, c - 1));
      setNotifications((prev) => prev && prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    if (n.actionUrl) {
      setNotifOpen(false);
      router.push(n.actionUrl);
    }
  };

  const list = notifications ?? [];
  // An empty list means nothing is unread, whichever request answered last: the badge never says 9+ over "all caught up".
  const badge = notifications !== null && list.length === 0 ? 0 : unread;
  // Skeletons only when there is nothing to show yet; "all caught up" only from a real, empty answer.
  const showSkeleton = notifications === null && notifLoading;
  const showError = notifFailed && list.length === 0 && !notifLoading;
  const showEmpty = notifications !== null && list.length === 0 && !notifFailed && !notifLoading;

  return (
    // On phones the panel is pinned to the screen's edges (the bell is not the
    // right-most control there, so a panel hung from it ran off the left).
    <div className="relative z-40" ref={notifRef}>
      <button
        type="button"
        onClick={openNotifications}
        className="relative grid size-10 place-items-center rounded-xl border border-border bg-white text-foreground/70 hover:bg-muted"
        aria-label={t("misc.notifications")}
        aria-expanded={notifOpen}
      >
        <Bell className="h-4 w-4" />
        {badge > 0 && (
          <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[9px] font-bold text-white">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>

      {notifOpen && (
        // Same panel as the streak popover: white card, hairline, soft shadow, no rule under the title.
        <div className="fixed inset-x-3 top-[64px] z-50 rounded-2xl border border-border bg-card p-2 text-foreground shadow-[0_12px_32px_-14px_rgba(22,22,26,0.22)] animate-fade-up sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[340px]">
          <div className="flex items-baseline justify-between gap-3 px-2.5 pb-1 pt-2">
            <p className="text-[17px] font-bold leading-tight">{t("misc.notifications")}</p>
            {badge > 0 && list.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  markAllNotificationsRead().catch(() => {});
                  setUnread(0);
                  setNotifications((prev) => prev && prev.map((n) => ({ ...n, read: true })));
                }}
                className="text-[12.5px] font-semibold text-muted-foreground hover:text-accent"
              >
                {t("misc.markAllRead")}
              </button>
            )}
          </div>
          <div className="max-h-[min(360px,calc(100dvh-140px))] overflow-y-auto" aria-busy={notifLoading}>
            {showSkeleton && (
              <div className="space-y-3 px-2.5 py-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            )}
            {showError && (
              <div className="px-2.5 py-5 text-center" role="alert">
                <p className="text-[13.5px] font-semibold text-foreground">{t("misc.notifLoadFailed")}</p>
                <button type="button" onClick={loadList} className="mt-1 text-[13.5px] font-bold text-accent hover:underline">
                  {t("misc.retry")}
                </button>
              </div>
            )}
            {showEmpty && <p className="px-2.5 py-6 text-center text-[13.5px] text-muted-foreground">{t("misc.allCaughtUp")}</p>}
            {list.length > 0 && (
              <ul>
                {list.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => onNotificationClick(n)}
                      className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left hover:bg-muted"
                    >
                      <span className={cn("mt-[7px] size-1.5 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-accent")} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-[13.5px]", n.read ? "font-medium" : "font-bold")}>{n.title}</span>
                        <span className="line-clamp-2 text-[12.5px] leading-snug text-muted-foreground">{n.body}</span>
                        <span className="mt-0.5 block text-[11px] text-faint">{formatRelativeDate(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {notifFailed && list.length > 0 && (
              <p className="px-2.5 py-2 text-[12px] text-faint">
                {t("misc.notifLoadFailed")}{" "}
                <button type="button" onClick={loadList} className="font-bold text-accent hover:underline">
                  {t("misc.retry")}
                </button>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
