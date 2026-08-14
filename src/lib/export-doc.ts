import {
  type ApiExportArtifact,
  type ExportDoc,
} from "@/lib/api/study-session";
import { normalizeActivityContent } from "@/lib/api/activity-content";
import type { ActivityType } from "@/types";

/**
 * Visual themes for the export editor — inspired by classic printable
 * worksheet styles (playful primary, space, jungle, ocean, candy pastel,
 * chalkboard). `page`/`heading`/`section` are class names applied to the
 * export sheet; deliberately colorful, unlike the app's own design tokens.
 */
export interface ExportTheme {
  id: string;
  label: string;
  emoji: string;
  /** Wrapper around the whole printable sheet. */
  page: string;
  /** Document title. */
  heading: string;
  /** Each artifact section card. */
  section: string;
  /** Section heading row. */
  sectionHeading: string;
  /** Small preview swatch in the theme picker. */
  swatch: string;
}

export const exportThemes: ExportTheme[] = [
  {
    id: "classic",
    label: "Classic",
    emoji: "📄",
    page: "bg-white text-neutral-900",
    heading: "font-serif text-neutral-900 border-b-2 border-neutral-800",
    section: "border border-neutral-300 bg-white",
    sectionHeading: "bg-neutral-100 text-neutral-800 border-b border-neutral-300",
    swatch: "bg-white border-neutral-400",
  },
  {
    id: "playful",
    label: "Playful",
    emoji: "🖍️",
    page: "bg-amber-50 text-neutral-900",
    heading: "text-orange-600 border-b-4 border-dashed border-orange-400",
    section: "border-2 border-dashed border-orange-300 bg-white rounded-2xl",
    sectionHeading: "bg-orange-100 text-orange-700 border-b-2 border-dashed border-orange-300",
    swatch: "bg-amber-50 border-orange-400 border-dashed",
  },
  {
    id: "space",
    label: "Space",
    emoji: "🚀",
    page: "bg-indigo-950 text-indigo-50",
    heading: "text-amber-300 border-b-2 border-indigo-500",
    section: "border border-indigo-700 bg-indigo-900/70 rounded-xl",
    sectionHeading: "bg-indigo-800 text-indigo-100 border-b border-indigo-600",
    swatch: "bg-indigo-950 border-indigo-500",
  },
  {
    id: "jungle",
    label: "Jungle",
    emoji: "🦁",
    page: "bg-lime-50 text-neutral-900",
    heading: "text-green-700 border-b-4 border-green-600",
    section: "border-2 border-green-500 bg-white rounded-2xl",
    sectionHeading: "bg-green-100 text-green-800 border-b-2 border-green-400",
    swatch: "bg-lime-100 border-green-600",
  },
  {
    id: "ocean",
    label: "Ocean",
    emoji: "🌊",
    page: "bg-sky-50 text-neutral-900",
    heading: "text-sky-700 border-b-4 border-sky-400 rounded",
    section: "border border-sky-300 bg-white rounded-2xl",
    sectionHeading: "bg-sky-100 text-sky-800 border-b border-sky-300",
    swatch: "bg-sky-100 border-sky-400",
  },
  {
    id: "candy",
    label: "Candy",
    emoji: "🍭",
    page: "bg-pink-50 text-neutral-900",
    heading: "text-pink-600 border-b-4 border-dotted border-pink-400",
    section: "border-2 border-pink-300 bg-white rounded-3xl",
    sectionHeading: "bg-pink-100 text-pink-700 border-b-2 border-pink-300",
    swatch: "bg-pink-100 border-pink-400 border-dotted",
  },
  {
    id: "chalkboard",
    label: "Chalkboard",
    emoji: "🧑‍🏫",
    page: "bg-emerald-950 text-emerald-50",
    heading: "font-serif text-amber-200 border-b-2 border-emerald-700",
    section: "border border-emerald-700 bg-emerald-900/60 rounded-lg",
    sectionHeading: "bg-emerald-900 text-emerald-100 border-b border-emerald-700",
    swatch: "bg-emerald-950 border-emerald-600",
  },
];

export const exportThemeIds = exportThemes.map((t) => t.id);

export function exportThemeById(id: string): ExportTheme {
  return exportThemes.find((t) => t.id === id) ?? exportThemes[0];
}

const kindToActivityType: Record<string, ActivityType> = {
  WORKSHEET: "worksheet",
  MCQ_POOL: "mcq",
  FLASHCARD_DECK: "flashcard_review",
  VOCAB_DECK: "vocab_recall",
  CLOZE_PASSAGE: "cloze",
  READING_CHUNK: "reading",
};

/** Converts an artifact's content JSON into editable markdown. */
export function artifactToMarkdown(artifact: ApiExportArtifact): string {
  const content = artifact.content ?? {};
  if (artifact.kind === "FIGURE") {
    const url = typeof content.url === "string" ? content.url : "";
    const caption =
      typeof content.caption === "string"
        ? content.caption
        : typeof content.title === "string"
          ? content.title
          : "";
    return url ? `[Figure: ${url}${caption ? ` — ${caption}` : ""}]` : caption;
  }
  const type = artifact.kind ? kindToActivityType[artifact.kind] : undefined;
  if (!type) return "";
  const normalized = normalizeActivityContent(type, content);
  switch (normalized.type) {
    case "worksheet":
      return normalized.steps
        .map((step, i) => {
          const lines: string[] = [`### ${step.title || `Question ${i + 1}`}`];
          if (step.intro) lines.push("", step.intro);
          step.parts.forEach((part, j) => {
            const label = part.label || `(${String.fromCharCode(97 + j)})`;
            const marks =
              typeof part.marks === "number" ? ` *[${part.marks} marks]*` : "";
            lines.push("", `**${label}** ${part.prompt}${marks}`);
            if (part.answer) lines.push("", `> **Answer:** ${part.answer}`);
          });
          return lines.join("\n");
        })
        .join("\n\n");
    case "mcq":
      return normalized.questions
        .map((q, i) => {
          const lines: string[] = [`**${i + 1}.** ${q.question}`, ""];
          q.options.forEach((option, j) => {
            lines.push(`- ${String.fromCharCode(65 + j)}. ${option}`);
          });
          lines.push(
            "",
            `> **Answer:** ${String.fromCharCode(65 + q.correctIndex)}${q.explanation ? ` — ${q.explanation}` : ""}`,
          );
          return lines.join("\n");
        })
        .join("\n\n");
    case "flashcard_review":
      return [
        "| # | Question | Answer |",
        "|---|----------|--------|",
        ...normalized.cards.map(
          (card, i) =>
            `| ${i + 1} | ${card.front.replace(/\|/g, "\\|")} | ${card.back.replace(/\|/g, "\\|")} |`,
        ),
      ].join("\n");
    case "vocab_recall":
      return [
        "| # | Term | Definition |",
        "|---|------|------------|",
        ...normalized.terms.map(
          (t, i) =>
            `| ${i + 1} | ${t.term.replace(/\|/g, "\\|")} | ${t.definition.replace(/\|/g, "\\|")} |`,
        ),
      ].join("\n");
    case "cloze":
      return normalized.passages
        .map((p) => {
          const answers = p.answers.length
            ? `\n\n> **Answers:** ${p.answers.join(", ")}`
            : "";
          return `${p.textWithBlanks}${answers}`;
        })
        .join("\n\n");
    case "reading":
      return normalized.text;
    default:
      return "";
  }
}

/** Builds the initial export document from the selected artifacts. */
export function buildExportDoc(artifacts: ApiExportArtifact[]): ExportDoc {
  return {
    title:
      artifacts.length === 1
        ? artifacts[0].title
        : (artifacts[0]?.workspaceTitle ?? "Study pack"),
    themeId: "classic",
    sections: artifacts.map((a) => ({
      heading: a.title,
      body: artifactToMarkdown(a),
    })),
  };
}
