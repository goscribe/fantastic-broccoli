import type { StudySession } from "@/types";
import { noteHref } from "./notes";

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
  // A mixed round is titled "Practice my mistakes · Biology, Chemistry": keep the subjects.
  const subjects = practiceRoundSubjects(session.title);
  return {
    ...session,
    title: subjects ? `${t("mistakes.sessionTitle")} · ${subjects}` : t("mistakes.sessionTitle"),
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

/** The subjects named in a mixed round's server title ("Practice my mistakes · Biology, Chemistry" → "Biology, Chemistry"). */
export function practiceRoundSubjects(title: string | null | undefined): string | null {
  const i = title ? title.indexOf(" · ") : -1;
  const rest = i >= 0 ? title!.slice(i + 3).trim() : "";
  return rest || null;
}

/** "Biology, Chemistry +2": the subjects in a mixed round, most to fix first (the server's order and cap of three). */
export function mixedRoundSubjects(subjects: Array<{ title: string; open: number }>, max = 3): string {
  const names = [...subjects]
    .filter((s) => s.open > 0)
    .sort((a, b) => b.open - a.open)
    .map((s) => s.title.trim())
    .filter((n, i, all) => n && all.indexOf(n) === i);
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown} +${names.length - max}` : shown;
}

/** What a saved mistake links to (purpose audit, finding 16): its topic, the session it came from. */
export interface MistakeLinkable {
  workspaceId: string;
  label: string;
  sessionId?: string | null;
  session?: { id: string; title: string; date: Date | string } | null;
  courseTopic?: { courseId: string; topicId: string; code: string; title: string } | null;
  note?: { courseId: string; topicId: string } | null;
  hasNote?: boolean;
  detail?: { note?: { courseId: string; topicId: string } };
}

/** The topic's note when Scribe has one, else the topic in its subject; null when the mistake has no catalog topic. */
export function mistakeTopicHref(m: MistakeLinkable): string | null {
  const note = (m.hasNote !== false && m.note) || m.detail?.note;
  if (note) return noteHref(note.courseId, note.topicId);
  if (m.courseTopic) return `/workspace/${encodeURIComponent(m.workspaceId)}?topic=${encodeURIComponent(m.courseTopic.topicId)}`;
  return null;
}

/** The end screen of the session the mistake was made in. */
export function mistakeSessionHref(m: MistakeLinkable): string | null {
  const id = m.session?.id ?? m.sessionId;
  return id ? sessionSummaryHref(m.workspaceId, id) : null;
}

/** A session's end screen (the player opens on its summary). */
export const sessionSummaryHref = (workspaceId: string, sessionId: string) =>
  `/workspace/${encodeURIComponent(workspaceId)}/session/${encodeURIComponent(sessionId)}?view=summary`;

/** The mistakes from one finished session, in its subject's list. */
export const sessionMistakesHref = (workspaceId: string | null | undefined, sessionId: string) => {
  const q = new URLSearchParams();
  if (workspaceId) q.set("workspace", workspaceId);
  q.set("session", sessionId);
  return `/mistakes?${q.toString()}`;
};

/** The proficiency key of a topic label (the server's topicKey): "A1.1 Water" and "water" compare equal to their own forms. */
export const topicKey = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 120);

/** The catalog topic a mastery label stands for ("Water", "water", "A1.1 Water"), as the server matches them. */
export function catalogTopicForLabel<T extends { id: string; code: string; name: string }>(
  units: Array<{ topics: T[] }>,
  label: string,
): T | null {
  const key = topicKey(label);
  if (!key) return null;
  for (const u of units)
    for (const t of u.topics) if (topicKey(t.name) === key || topicKey(`${t.code} ${t.name}`) === key) return t;
  return null;
}
