/**
 * Titles, descriptions, the indexability rule and JSON-LD for the public
 * topic-note pages. Pure, so it is tested (src/lib/notes-public/seo.test.ts).
 *
 * Structured data, per Google's current guidance:
 * - BreadcrumbList on every page (supported rich result).
 * - Topic pages with practice questions: a `Quiz` (a schema.org
 *   LearningResource) whose `hasPart` Questions carry the visible question,
 *   the correct answer and its explanation — the Education Q&A markup Google
 *   documents for study / flashcard pages, on the most specific (leaf) page only.
 * - Locked topics (paid gate): a `WebPage` with `isAccessibleForFree: false`
 *   and a `hasPart` WebPageElement whose `cssSelector` is the unlock panel
 *   (`.notes-locked`), per Google's subscription / paywalled content guidance.
 *   The locked text is not in the page at all (the server strips it), and the
 *   Quiz lists only the questions the page shows.
 * - Not used: Course / CourseInstance (Google dropped Course Info in 2025),
 *   practice-problem markup (dropped in early 2026), FAQPage (rich result
 *   retired) and QAPage (meant for user-submitted answers).
 * Unsupported markup does not hurt, but it adds bytes for nothing.
 */

import { coursePath, topicPath, unitPath, notesIndexPath } from "./slug";

/** Fewest checked practice questions for a topic page to be indexed (and listed in the sitemap). */
export const MIN_INDEXABLE_QUESTIONS = 6;

export interface IndexInput {
  /** Public note label, or null when the topic has no public note. */
  note: "reviewed" | "draft" | null;
  /** Checked practice questions on the page. */
  questionCount: number;
  /** Index notes that are still "draft, not yet reviewed" (NOTES_INDEX_DRAFTS). */
  indexDrafts: boolean;
}

/**
 * A topic page is indexable when it has a note (reviewed, or a draft while
 * NOTES_INDEX_DRAFTS is on) AND at least {@link MIN_INDEXABLE_QUESTIONS}
 * checked questions. Anything thinner is served (visitors can still practise)
 * but `noindex, follow` and left out of the sitemap.
 */
export function isTopicIndexable({ note, questionCount, indexDrafts }: IndexInput): boolean {
  if (!note) return false;
  if (note === "draft" && !indexDrafts) return false;
  return questionCount >= MIN_INDEXABLE_QUESTIONS;
}

/** NOTES_INDEX_DRAFTS=1 (server env of the app) indexes draft notes; off by default. */
export const indexDraftsFromEnv = (v = process.env.NOTES_INDEX_DRAFTS) => v === "1" || v === "true";

/** Shown in titles: "IB Biology", "AP Chemistry", "AQA A-level Biology". */
const courseName = (c: { title: string }) => c.title;

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…`);

/** The site suffix " | Scribe" comes from the root title template. */
export function topicTitle(c: { title: string }, t: { code: string; name: string }, hasNote: boolean, questionCount: number): string {
  const what = hasNote ? (questionCount > 0 ? "notes and practice questions" : "revision notes") : "practice questions";
  return `${courseName(c)} ${t.code} ${t.name}: ${what}`;
}

export function topicDescription(
  c: { title: string },
  t: { code: string; name: string; objectives: string[] },
  hasNote: boolean,
  questionCount: number,
  locked = false,
): string {
  if (locked) {
    const what = hasNote ? `${courseName(c)} notes on ${t.code} ${t.name}` : `${courseName(c)} ${t.code} ${t.name}`;
    const obj = t.objectives[0] ? ` Covers: ${t.objectives.slice(0, 2).join("; ").replace(/\.$/, "")}.` : "";
    return clip(`${what}: read the first section and try ${Math.min(2, questionCount)} practice questions free; the rest comes with a plan.${obj}`, 158);
  }
  const lead = hasNote
    ? `Clear ${courseName(c)} notes on ${t.code} ${t.name}`
    : `${courseName(c)} ${t.code} ${t.name}`;
  const qs = questionCount > 0 ? `${hasNote ? ", then " : ": "}${questionCount} exam-style questions with answers and worked explanations` : "";
  const obj = t.objectives[0] ? ` Covers: ${t.objectives.slice(0, 2).join("; ").replace(/\.$/, "")}.` : "";
  return clip(`${lead}${qs}. Free, no sign-up.${obj}`, 158);
}

export function courseTitle(c: { title: string }): string {
  return `${courseName(c)} notes and practice questions by topic`;
}

export function courseDescription(c: { title: string; units: { topics: unknown[] }[] }, noteCount: number, questionCount: number): string {
  const topics = c.units.reduce((a, u) => a + u.topics.length, 0);
  return clip(
    `Free ${courseName(c)} revision: ${topics} topics in ${c.units.length} units` +
      (noteCount ? `, ${noteCount} with Scribe notes` : "") +
      (questionCount ? ` and ${questionCount} exam-style practice questions with worked answers` : "") +
      ". Pick a topic and start.",
    158,
  );
}

export function unitTitleSeo(c: { title: string }, u: { code: string; name: string }, label: string): string {
  return `${courseName(c)} ${label ? `${label} ` : ""}${u.code} ${u.name}: notes and practice questions`;
}

export const INDEX_TITLE = "Free revision notes and practice questions for IB, AP, GCSE and A-level";
export const INDEX_DESCRIPTION =
  "Scribe's free topic notes and exam-style practice questions with worked answers for IB, AP, GCSE and A-level courses. Read the note, answer the questions, see your score.";

/* ------------------------------ JSON-LD ------------------------------ */

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(siteUrl: string, crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${siteUrl}${c.path}`,
    })),
  };
}

export const crumbsFor = {
  index: (): Crumb[] => [{ name: "Notes", path: notesIndexPath() }],
  course: (c: { id: string; title: string }): Crumb[] => [...crumbsFor.index(), { name: c.title, path: coursePath(c.id) }],
  unit: (c: { id: string; title: string }, u: { id: string; code: string; name: string }): Crumb[] => [
    ...crumbsFor.course(c),
    { name: `${u.code} ${u.name}`, path: unitPath(c.id, u) },
  ],
  topic: (
    c: { id: string; title: string },
    u: { id: string; code: string; name: string },
    t: { id: string; code: string; name: string },
  ): Crumb[] => [...crumbsFor.unit(c, u), { name: `${t.code} ${t.name}`, path: topicPath(c.id, t) }],
};

/** Plain text for JSON-LD: markdown bold/italics and $…$ delimiters removed, LaTeX left readable. */
export function plainText(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1$2")
    .replace(/\$([^$]+)\$/g, (_, m: string) =>
      m
        .replace(/\\text\{([^}]*)\}|\\mathrm\{([^}]*)\}/g, (_m, a?: string, b?: string) => a ?? b ?? "")
        .replace(/\\times/g, "×")
        .replace(/\\,|\\;|\\!/g, " ")
        .replace(/\\(left|right)/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .replace(/\s+/g, " ")
    .trim();
}

export interface QuizQuestionLd {
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export function topicQuizJsonLd(opts: {
  siteUrl: string;
  path: string;
  course: { title: string; subject: string; qualification: string };
  topic: { code: string; name: string };
  questions: QuizQuestionLd[];
  locale: "en-GB" | "en-US";
}) {
  const { siteUrl, path, course, topic, questions, locale } = opts;
  return {
    "@context": "https://schema.org",
    "@type": "Quiz",
    name: `${course.title} ${topic.code} ${topic.name} practice questions`,
    url: `${siteUrl}${path}#practice`,
    inLanguage: locale,
    educationalLevel: course.qualification,
    learningResourceType: "Practice questions",
    isAccessibleForFree: true,
    about: { "@type": "Thing", name: `${topic.name} (${course.subject})` },
    provider: { "@type": "Organization", name: "Scribe", url: siteUrl },
    hasPart: questions.map((q) => ({
      "@type": "Question",
      eduQuestionType: "Flashcard",
      text: plainText(q.stem),
      acceptedAnswer: {
        "@type": "Answer",
        text: `${plainText(q.options[q.correctIndex] ?? "").replace(/[.!?]+$/, "")}. ${plainText(q.explanation)}`,
      },
    })),
  };
}

/** CSS class of the unlock panel on a locked topic page; the paywall markup points at it. */
export const LOCKED_SELECTOR = ".notes-locked";

/** Paywall structured data for a locked topic page (see the header comment). */
export function lockedPageJsonLd(opts: { siteUrl: string; path: string; title: string; locale: "en-GB" | "en-US" }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: opts.title,
    url: `${opts.siteUrl}${opts.path}`,
    inLanguage: opts.locale,
    isAccessibleForFree: false,
    hasPart: {
      "@type": "WebPageElement",
      isAccessibleForFree: false,
      cssSelector: LOCKED_SELECTOR,
    },
  };
}
