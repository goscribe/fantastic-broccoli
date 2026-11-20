import { toast } from "sonner";

/** Prefix the server puts on every free-plan cap error (see server PLAN_LIMIT_ERROR_PREFIX). */
export const PLAN_LIMIT_ERROR_PREFIX = "Free plan limit reached";

export function isPlanLimitError(err: unknown): err is Error {
  return (
    err instanceof Error &&
    // Running out of monthly tokens is the same moment as hitting a cap.
    (err.message.startsWith(PLAN_LIMIT_ERROR_PREFIX) ||
      /^Not enough tokens\b/.test(err.message))
  );
}

/**
 * Fired on `window` (cancelable) when a request is refused by a free-plan
 * cap; the upgrade dialog listens and calls `preventDefault()` to claim it.
 */
export const PLAN_LIMIT_EVENT = "scribe:plan-limit";

/** How refusals reach the learner when no dialog claims them (swappable in tests). */
export const refusalToast = {
  show(message: string): void {
    // Keyed by message so the same refusal never stacks.
    toast.error(message, { id: message });
  },
};

let lastAnnounced: { message: string; at: number } | null = null;

/**
 * Tells the learner a plan limit was hit. The subscribe wall claims the
 * event when it can show; otherwise (wall not mounted, billing paused,
 * exempt route, signed-out shell…) the server's reason is shown as a toast,
 * so a refusal is never silent. Repeats within a moment (the same error
 * surfaced by the transport and by the call site) are ignored.
 */
export function announcePlanLimit(message: string): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (lastAnnounced?.message === message && now - lastAnnounced.at < 1500) return;
  lastAnnounced = { message, at: now };
  const event = new CustomEvent(PLAN_LIMIT_EVENT, {
    detail: message,
    cancelable: true,
  });
  const unclaimed = window.dispatchEvent(event);
  if (unclaimed) refusalToast.show(message);
}
