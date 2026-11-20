import type { StudySession } from "@/types";

/** Link that builds a "Practice my mistakes" round and opens it (one subject, or one finished session's mistakes). */
export function practiceHref(opts: { workspaceId?: string | null; sessionId?: string | null } = {}): string {
  const q = new URLSearchParams();
  if (opts.workspaceId) q.set("workspace", opts.workspaceId);
  if (opts.sessionId) q.set("session", opts.sessionId);
  const s = q.toString();
  return `/mistakes/practice${s ? `?${s}` : ""}`;
}

/** Minutes a practice round of `n` mistakes takes (mirrors the server: 8 per round, ~30s each). */
export const fixMinutes = (n: number) => Math.max(1, Math.ceil(Math.min(n, 8) / 2));

const PRACTICE_ACTIVITY_KEY: Record<string, string> = {
  mcq: "mistakes.actMcq",
  cloze: "mistakes.actCloze",
  flashcard_review: "mistakes.actCards",
  worksheet: "mistakes.actParts",
};

/** A practice session's titles in the learner's language (the server writes them in English). */
export function localizePracticeSession<S extends StudySession | undefined>(session: S, t: (key: string) => string): S {
  if (!session?.mistakesPractice) return session;
  return {
    ...session,
    title: t("mistakes.sessionTitle"),
    activities: session.activities.map((a) =>
      PRACTICE_ACTIVITY_KEY[a.type] ? { ...a, title: t(PRACTICE_ACTIVITY_KEY[a.type]) } : a,
    ),
  } as S;
}

/** One "Osmosis 48% → 61% (+13%)" row, in whole percents; before is null for a topic first practised in the session. */
export function masteryRow(m: { before: number | null; after: number; delta: number | null }) {
  const before = m.before === null ? null : Math.round(m.before * 100);
  const after = Math.round(m.after * 100);
  const delta = before === null ? null : after - before;
  // The bar: where the topic was (base) and what the session added on top.
  const base = before === null ? 0 : Math.min(before, after);
  return { before, after, delta, base, gain: Math.max(2, after - base) };
}
