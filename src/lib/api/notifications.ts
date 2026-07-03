import { api } from "./trpc-client";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  actionUrl?: string;
  read: boolean;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  actionUrl: string | null;
  read: boolean;
  createdAt: Date | string;
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  const { items } = (await api.notifications.list.query({ limit: 20 })) as {
    items: NotificationRow[];
  };
  return items.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    actionUrl: n.actionUrl ?? undefined,
    read: n.read,
    createdAt: new Date(n.createdAt).toISOString(),
  }));
}

export async function fetchUnreadCount(): Promise<number> {
  const { count } = await api.notifications.unreadCount.query();
  return count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.notifications.markRead.mutate({ id });
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.notifications.markAllRead.mutate();
}
