/**
 * The session player's bottom bar and its end screen (purpose audit,
 * finding 3). Pure rules, so they can be tested without the page:
 *
 * - A one-activity session (a Quick 5, a mistakes round) has no activity
 *   steps: the bar is hidden; the question card has its own Back and Next.
 * - Elsewhere Next and Back act on the question inside the activity when it
 *   has several, and move between activities only past its first or last
 *   question. Skipping an activity is a deliberate choice in an overflow menu.
 * - The end screen is only for finished work; leaving early shows that it
 *   isn't finished, without a cheer, points or a streak day.
 */

export type ActivityStatus = "pending" | "in_progress" | "completed" | "skipped" | (string & {});

const isDone = (status: ActivityStatus) => status === "completed" || status === "skipped";

/** Whether the bottom bar is shown at all. */
export function showSessionFooter(activityCount: number): boolean {
  return activityCount > 1;
}

/**
 * What one tap on the bar's Next (or Back) does: move within the activity
 * (`item`), to the neighbouring activity (`activity`), or past the last
 * activity to the summary (`summary`). `none` when there is nowhere to go.
 */
export type FooterStep = "item" | "activity" | "summary" | "none";

export function footerNextStep(input: { canItemNext: boolean; activeIndex: number; activityCount: number }): FooterStep {
  if (input.canItemNext) return "item";
  if (input.activeIndex < 0 || input.activeIndex >= input.activityCount) return "none";
  return input.activeIndex + 1 < input.activityCount ? "activity" : "summary";
}

export function footerBackStep(input: { canItemBack: boolean; activeIndex: number }): FooterStep {
  if (input.canItemBack) return "item";
  return input.activeIndex > 0 ? "activity" : "none";
}

/** Every activity completed or deliberately skipped: the end screen may celebrate. */
export function sessionFinished(activities: Array<{ status: ActivityStatus }>): boolean {
  return activities.length > 0 && activities.every((a) => isDone(a.status));
}

/** For the "not finished yet" screen: how much is left, and where to pick it up. */
export function unfinishedSummary<A extends { id: string; status: ActivityStatus; estimatedMinutes?: number }>(
  activities: A[],
): { left: number; minutes: number; resumeId: string | null } {
  const open = activities.filter((a) => !isDone(a.status));
  const resume = open.find((a) => a.status === "in_progress") ?? open[0] ?? null;
  const minutes = open.reduce((sum, a) => sum + (a.estimatedMinutes || 0), 0);
  return { left: open.length, minutes: open.length ? Math.max(1, Math.round(minutes)) : 0, resumeId: resume?.id ?? null };
}

/**
 * Next question to show after the one at `index` in a multi-question card:
 * the next unanswered one after it, wrapping round, or null when every
 * question has an answer (then the card may finish).
 */
export function nextUnanswered(answers: Array<unknown | null>, index: number): number | null {
  const n = answers.length;
  for (let step = 1; step <= n; step++) {
    const i = (index + step) % n;
    if (answers[i] === null || answers[i] === undefined) return i;
  }
  return null;
}
