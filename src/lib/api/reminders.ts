import { rpc } from "./study-session";
import type { ReviewReminder } from "@/lib/review-reminders";
import { reviewDeepLink } from "@/lib/review-reminders";

/**
 * Server persistence for review reminders, off until goscribe/server ships a
 * `reminders.schedule` route (set NEXT_PUBLIC_REVIEW_REMINDERS_API=1). The
 * server is expected to create an in-app `Notification` (and, only for users
 * who opted in, an email) at `scheduledAt` whose actionUrl is `deepLink`.
 * Until then reminders are browser-local (see src/lib/review-reminders.ts).
 */
export const reminderApiEnabled =
  process.env.NEXT_PUBLIC_REVIEW_REMINDERS_API === "1";

export async function syncReminderToServer(reminder: ReviewReminder): Promise<void> {
  if (!reminderApiEnabled) return;
  await rpc("reminders.schedule", "mutation", {
    reminderId: reminder.id,
    workspaceId: reminder.workspaceId,
    sessionId: reminder.sessionId,
    scheduledAt: new Date(reminder.scheduledAt),
    dueCount: reminder.dueCount,
    deepLink: reviewDeepLink(reminder, "notification"),
  });
}
