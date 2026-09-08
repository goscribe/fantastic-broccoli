import { toast } from "sonner";
import { announcePlanLimit, isPlanLimitError } from "./api/account";

export { toast };

/**
 * Shows an error toast using the server's message when available. Free-plan
 * cap errors are routed to the upgrade dialog instead of a plain toast.
 */
export function toastError(err: unknown, fallback: string): string {
  if (isPlanLimitError(err)) {
    announcePlanLimit(err.message);
    return err.message;
  }
  const message =
    err instanceof Error && err.message ? err.message : fallback;
  toast.error(message);
  return message;
}
