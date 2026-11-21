/**
 * The subject page's decisions, kept free of framework imports so they can be
 * tested: the one next thing (the band's only primary), the scope of "New
 * session" when nothing is picked, the composer chips that can be offered
 * truthfully, the one review line, and which of the student's files belong
 * to which course topic.
 */

/** `review.summary` (goscribe/server services/review/review.service.ts). */
export type ReviewNextKind = "mistakes" | "review_items" | "cards" | "none";

export interface ReviewNextAction {
  kind: ReviewNextKind;
  count: number;
  workspaceId: string | null;
  via: "mistakes.startPractice" | "studySession.create" | "flashcards.getDueReview" | null;
  label: string;
}

export interface ReviewQueueEntry {
  type: "mistake" | "item" | "card";
  id: string;
  workspaceId: string;
  workspaceTitle: string;
  label: string;
  at: Date | string;
}

export interface ReviewSummary {
  mistakes: number;
  dueItems: number;
  dueCards: number;
  total: number;
  nextAction: ReviewNextAction;
  queue: ReviewQueueEntry[];
}

/** "1 mistake", "3 mistakes". */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export interface SubjectSessionInput {
  id: string;
  title: string;
  /** App statuses are lower-case: active | paused | completed | failed. */
  status: string;
  generating: boolean;
  quickStart: boolean;
  createdAt: string;
  activities: { status: string; title: string; estimatedMinutes: number }[];
}

export interface SubjectPlanTask {
  id: string;
  label: string;
  minutes: number;
  status: string;
}

export type SubjectNext =
  | { kind: "loading" }
  | { kind: "mistakes"; count: number; minutes: number }
  | { kind: "plan"; taskId: string; label: string; minutes: number }
  | { kind: "continue"; sessionId: string; title: string; activityTitle: string | null; minutes: number; started: boolean; quick: boolean }
  | { kind: "building"; sessionId: string; title: string }
  | { kind: "review"; review: "review_items" | "cards"; count: number; minutes: number }
  | { kind: "topic"; topicId: string; title: string; course: string }
  | { kind: "quick5"; fromFiles: boolean };

const openActivity = (s: string) => s !== "completed" && s !== "skipped";
/** Mirrors the server's practice round: 8 at most, about 30 s each. */
export const practiceMinutes = (n: number) => Math.max(1, Math.ceil(Math.min(n, 8) / 2));

/**
 * The one thing to do next in this subject, in the same order as Home's
 * action: mistakes first (a two-minute fix), then today's exam-plan task,
 * then work already started, then what is due for review, then the next
 * course topic, then five questions on the subject.
 */
export function pickSubjectNext(input: {
  loading: boolean;
  sessions: SubjectSessionInput[];
  review: Pick<ReviewSummary, "mistakes" | "dueItems" | "dueCards"> | null;
  planTasks: SubjectPlanTask[];
  courseNext: { topicId: string; title: string; course: string } | null;
  materialCount: number;
}): SubjectNext {
  if (input.loading) return { kind: "loading" };
  const mistakes = input.review?.mistakes ?? 0;
  if (mistakes > 0) return { kind: "mistakes", count: mistakes, minutes: practiceMinutes(mistakes) };

  const task = input.planTasks.find((t) => t.status === "planned");
  if (task) return { kind: "plan", taskId: task.id, label: task.label, minutes: Math.max(1, task.minutes) };

  // Oldest unfinished first: carry on where you left off, not the newest thing generated.
  const byStart = [...input.sessions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ready = byStart.find((s) => s.status !== "completed" && !s.generating && s.activities.some((a) => openActivity(a.status)));
  if (ready) {
    const open = ready.activities.filter((a) => openActivity(a.status));
    return {
      kind: "continue",
      sessionId: ready.id,
      title: ready.title,
      activityTitle: open[0]?.title ?? null,
      minutes: Math.max(1, Math.round(open.reduce((n, a) => n + (a.estimatedMinutes || 0), 0)) || 1),
      started: open.length < ready.activities.length,
      quick: ready.quickStart,
    };
  }
  const building = byStart.find((s) => s.status !== "completed" && s.generating);
  if (building) return { kind: "building", sessionId: building.id, title: building.title };

  const dueItems = input.review?.dueItems ?? 0;
  if (dueItems > 0) return { kind: "review", review: "review_items", count: dueItems, minutes: Math.max(2, Math.ceil(dueItems / 2)) };
  const dueCards = input.review?.dueCards ?? 0;
  if (dueCards > 0) return { kind: "review", review: "cards", count: dueCards, minutes: Math.max(1, Math.round(dueCards / 3)) };

  if (input.courseNext) return { kind: "topic", ...input.courseNext };
  return { kind: "quick5", fromFiles: input.materialCount > 0 };
}

/** The band's sentence (what, and why it is this) and its one button. */
export function subjectNextCopy(next: Exclude<SubjectNext, { kind: "loading" }>, subject: string): { sentence: string; cta: string } {
  switch (next.kind) {
    case "mistakes":
      return {
        sentence:
          next.count === 1
            ? `1 answer you got wrong in ${subject} is waiting. Fix it now, before it sticks · ${next.minutes} min`
            : `${next.count} answers you got wrong in ${subject} are waiting. Fix them now, before they stick · ${next.minutes} min`,
        cta: next.count === 1 ? "Fix 1 mistake" : `Fix ${next.count} mistakes`,
      };
    case "plan":
      return { sentence: `${next.label} is on your exam plan for today · ${next.minutes} min`, cta: "Start" };
    case "continue":
      return {
        sentence: next.quick
          ? `Finish your 5 questions on ${next.title} · ${next.minutes} min`
          : `${next.started ? "Carry on with" : "Start"} ${next.title}${next.activityTitle ? `: ${next.activityTitle} is next` : ""} · ${next.minutes} min left`,
        cta: next.started || next.quick ? "Continue" : "Start",
      };
    case "building":
      return { sentence: `${next.title} is being written. It opens by itself when it's ready.`, cta: "Open" };
    case "review":
      return next.review === "review_items"
        ? {
            sentence: `${plural(next.count, "question")} from earlier ${next.count === 1 ? "is" : "are"} due: answering just before you'd forget is what makes ${next.count === 1 ? "it" : "them"} stick · ${next.minutes} min`,
            cta: `Review ${plural(next.count, "question")}`,
          }
        : { sentence: `${plural(next.count, "card")} ${next.count === 1 ? "is" : "are"} due for review today · ${next.minutes} min`, cta: `Review ${plural(next.count, "card")}` };
    case "topic":
      return { sentence: `Next in ${next.course}: ${next.title}, the first topic you haven't done · 5 questions`, cta: "Start" };
    case "quick5":
      return {
        sentence: next.fromFiles ? `Nothing started here yet: 5 questions from your notes in ${subject} · 5 min` : `Nothing started here yet: 5 questions on ${subject} · 5 min`,
        cta: "Start 5 questions",
      };
  }
}

/**
 * What "New session" studies. Picked files when there are some; with
 * nothing picked, the whole subject (its topics), never silently the first
 * file. Never an empty title, so a course-only subject with no files works.
 */
export function newSessionScope(input: {
  subject: string;
  picked: string[];
  topics: string[];
  materials: string[];
}): { title: string; topics: string } {
  const subject = input.subject.trim() || "This subject";
  if (input.picked.length > 0) {
    const t = input.picked;
    return { title: (t.length <= 2 ? t.join(" + ") : `${t[0]} + ${t.length - 1} more`).slice(0, 200), topics: t.join(", ").slice(0, 2000) };
  }
  const scope = input.topics.length ? input.topics : input.materials.length ? input.materials : [subject];
  return { title: `${subject}: all topics`.slice(0, 200), topics: scope.join(", ").slice(0, 2000) };
}

export type ChipId = "flashcards" | "mistakes";

/**
 * Composer chips that do exactly what they say, and only when they can:
 * a deck from the newest uploaded file (not a Scribe note), and practice of
 * this subject's open mistakes. "Make a study session from everything here"
 * is gone: "New session" does exactly that.
 */
export function subjectChips(input: { latestUploadTitle: string | null; openMistakes: number }): { id: ChipId; label: string }[] {
  const out: { id: ChipId; label: string }[] = [];
  if (input.latestUploadTitle) out.push({ id: "flashcards", label: "Flashcards from my latest upload" });
  if (input.openMistakes > 0) out.push({ id: "mistakes", label: "Explain what I got wrong last time" });
  return out;
}

/**
 * What a chip does: a deck made from that one file (the same path as picking
 * the file and tapping Flashcards), or this subject's mistakes practice.
 */
export function chipAction(id: ChipId, ctx: { workspaceId: string; latestUploadId: string | null }): { kind: "deck"; fileId: string } | { kind: "go"; href: string } | null {
  if (id === "flashcards") return ctx.latestUploadId ? { kind: "deck", fileId: ctx.latestUploadId } : null;
  return { kind: "go", href: `/mistakes/practice?workspace=${encodeURIComponent(ctx.workspaceId)}` };
}

/** The newest uploaded file: what "my latest upload" means. */
export function latestUpload<M extends { id: string; updatedAt: string }>(materials: M[], exclude: (m: M) => boolean = () => false): M | null {
  return [...materials].filter((m) => !exclude(m)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

/** "3 mistakes · 4 questions · 6 cards", only the parts there are. */
export function reviewBreakdown(r: Pick<ReviewSummary, "mistakes" | "dueItems" | "dueCards">): string {
  return [
    r.mistakes ? plural(r.mistakes, "mistake") : null,
    r.dueItems ? plural(r.dueItems, "question") : null,
    r.dueCards ? plural(r.dueCards, "card") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// ---------- the student's files on the course's topics ----------

const STOP = new Set(["and", "the", "of", "in", "a", "an", "to", "for", "on", "with", "notes", "note", "slides", "worksheet", "unit", "chapter", "topic", "pdf", "pptx", "docx"]);

/** Lower-case word stems: "Membranes and membrane transport" → membrane, transport. */
export function stems(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/\.[a-z0-9]{2,4}$/, "")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w)),
  );
}

/** Share of the topic's words that `text` also has. */
function overlap(topic: Set<string>, text: Set<string>): number {
  if (topic.size === 0) return 0;
  let hit = 0;
  for (const w of topic) if (text.has(w)) hit += 1;
  return hit / topic.size;
}

/**
 * Which of the student's files go with which course topic: a file whose name
 * names the topic, or the files of an organised-outline topic that matches
 * it. Outline topics that match no course topic come back in `unmatched`,
 * so nothing the student uploaded disappears from the list.
 */
export function filesForCourseTopics<O extends { title: string; fileIds: string[] }>(
  topics: { id: string; name: string }[],
  outline: O[],
  materials: { id: string; title: string }[],
): { byTopic: Map<string, string[]>; unmatched: O[] } {
  const byTopic = new Map<string, string[]>();
  const add = (topicId: string, ids: string[]) => {
    const cur = byTopic.get(topicId) ?? [];
    for (const id of ids) if (!cur.includes(id)) cur.push(id);
    byTopic.set(topicId, cur);
  };
  const topicStems = topics.map((t) => ({ id: t.id, s: stems(t.name) }));
  const best = (text: string) => {
    const s = stems(text);
    let top: { id: string; score: number } | null = null;
    for (const t of topicStems) {
      const score = overlap(t.s, s);
      if (score >= 0.5 && (!top || score > top.score)) top = { id: t.id, score };
    }
    return top?.id ?? null;
  };
  const unmatched: O[] = [];
  for (const o of outline) {
    const hit = best(o.title);
    if (hit) add(hit, o.fileIds);
    else unmatched.push(o);
  }
  for (const m of materials) {
    const hit = best(m.title);
    if (hit) add(hit, [m.id]);
  }
  return { byTopic, unmatched };
}
