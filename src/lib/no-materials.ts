import { toast, toastError } from "@/lib/toast";
import { isNoMaterialsError } from "@/lib/session-start";

/**
 * `toastError` for a session start, with a way forward when the subject has
 * nothing to plan from: an "Add material" button that opens the subject,
 * where the empty materials grid is the upload (and the Scribe notes picker).
 */
export function toastStartError(
  err: unknown,
  fallback: string,
  opts: { workspaceId?: string; addLabel: string; open: (href: string) => void },
): string {
  if (!isNoMaterialsError(err) || !opts.workspaceId) return toastError(err, fallback);
  const message = (err as Error).message;
  const href = `/workspace/${encodeURIComponent(opts.workspaceId)}`;
  toast.error(message, { id: message, action: { label: opts.addLabel, onClick: () => opts.open(href) } });
  return message;
}
