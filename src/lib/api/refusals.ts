import { announcePlanLimit, isPlanLimitError, refusalToast } from "./plan-limit";

/**
 * Mutations whose refusals (plan caps, rate limits, storage, the old
 * verify-email gate) must always reach the learner: subject creation,
 * session creation and uploads. Call sites used to swallow some of these,
 * so people retried a refused `workspace.create` a dozen times.
 */
const SURFACED_PATHS = new Set([
  "workspace.create",
  "studySession.create",
  "studySession.retryGeneration",
  "workspace.uploadFiles",
  "workspace.getFileUploadUrl",
  "workspace.uploadAndAnalyzeMedia",
  "workspace.uploadAndAnalyzeMediaConcurrent",
  "workspace.importYoutube",
  "workspace.reanalyzeFile",
]);

/** Server refusals, as opposed to validation or unexpected failures. */
const REFUSAL_CODES = new Set([
  "FORBIDDEN",
  "TOO_MANY_REQUESTS",
  "PRECONDITION_FAILED",
  "PAYLOAD_TOO_LARGE",
]);

/**
 * Called by the transport for every failed mutation. Plan-limit errors open
 * the upgrade dialog (or a toast when it can't show) wherever they come
 * from; other refusals on the paths above show the server's message as a
 * toast. Toasts are keyed by message, so a call site that also reports the
 * error doesn't stack a duplicate.
 */
export function surfaceRefusal(
  path: string,
  message: string | undefined,
  code: string | undefined,
): void {
  if (typeof window === "undefined" || !message) return;
  if (isPlanLimitError(new Error(message))) {
    announcePlanLimit(message);
    return;
  }
  if (SURFACED_PATHS.has(path) && code && REFUSAL_CODES.has(code)) {
    refusalToast.show(message);
  }
}
