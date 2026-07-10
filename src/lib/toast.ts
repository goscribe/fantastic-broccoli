import { toast } from "sonner";

export { toast };

/** Shows an error toast using the server's message when available. */
export function toastError(err: unknown, fallback: string): string {
  const message =
    err instanceof Error && err.message ? err.message : fallback;
  toast.error(message);
  return message;
}
