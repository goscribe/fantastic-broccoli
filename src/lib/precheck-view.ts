/**
 * What the wait screen's quick check shows, from what the server returned.
 * Pure, so the rules are tested without a browser (precheck-view.test.ts).
 *
 * - `loading`: the check has not come back yet; nothing is shown.
 * - `check`:   the server returned topics and the learner has not skipped.
 * - `warmup`:  no topics (an empty bank, nothing matching the session's
 *              planned topics or title, or the request failed) or Skip: the
 *              warm-up questions instead, which show nothing until one exists.
 */
export type PrecheckView = "loading" | "check" | "warmup";

export function precheckView(topics: readonly unknown[] | null, skipped: boolean): PrecheckView {
  if (topics === null) return "loading";
  return topics.length > 0 && !skipped ? "check" : "warmup";
}

/**
 * Whether anything is on screen (the wait screen shrinks its build header
 * only then; otherwise it is the full progress view, with no empty card).
 */
export function precheckShown(view: PrecheckView, warmupHasQuestion: boolean): boolean {
  return view === "check" || (view === "warmup" && warmupHasQuestion);
}
