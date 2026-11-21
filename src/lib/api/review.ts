import { rpc } from "./study-session";
import { mistakesApi } from "./mistakes";
import type { ReviewSummary } from "@/lib/subject-page";

export type { ReviewSummary, ReviewNextAction, ReviewQueueEntry } from "@/lib/subject-page";

/**
 * Client for the server's `review` router: one review count and queue (open
 * mistakes, then due spaced-review questions, then due flashcards) and what
 * the one Review button starts. Newer than the published @goscribe/server
 * types, so the contract mirrors services/review/review.service.ts there.
 */
export const reviewApi = {
  summary: (input: { workspaceId?: string; limit?: number } = {}) => rpc<ReviewSummary>("review.summary", "query", input),
};

/**
 * The subject's review summary; against a server without `review.summary`,
 * the subject's open mistakes alone (the old flashcard count was for every
 * subject, so it is not used here).
 */
export async function subjectReview(workspaceId: string): Promise<ReviewSummary> {
  try {
    return await reviewApi.summary({ workspaceId, limit: 20 });
  } catch {
    const m = await mistakesApi.summary(workspaceId);
    const label = `Fix ${m.open} mistake${m.open === 1 ? "" : "s"}`;
    return {
      mistakes: m.open,
      dueItems: 0,
      dueCards: 0,
      total: m.open,
      nextAction: m.open
        ? { kind: "mistakes", count: m.open, workspaceId, via: "mistakes.startPractice", label }
        : { kind: "none", count: 0, workspaceId, via: null, label: "Nothing to review" },
      queue: [],
    };
  }
}
