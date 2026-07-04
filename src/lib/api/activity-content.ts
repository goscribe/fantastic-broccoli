import type {
  ActivityContent,
  ActivityType,
  ClozeContent,
  ComprehensionContent,
  ComprehensionEvaluation,
  ExplainAloudContent,
  FlashcardContent,
  InteractiveContent,
  McqContent,
  McqQuestion,
  ReadingContent,
  VocabRecallContent,
  WorksheetContent,
  WorksheetPart,
  WorksheetStep,
} from "@/types";

/**
 * Normalizes activity `content` JSON blobs coming off the wire into the
 * discriminated `ActivityContent` shapes the UI renders.
 *
 * The blobs are LLM-generated (plan generation and the artifact bank) and use
 * snake_case with slightly different structures per source — e.g. MCQs may be
 * a single flat `{question, options, correct_index}` object or a
 * `{questions: [...]}` pool, cloze passages arrive as `{text, gaps}`, vocab
 * decks as `{cards}`. Progress fields the UI writes back (userAnswer, known,
 * evaluations, …) are preserved, so normalization is idempotent.
 */

type Raw = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" ? v : fallback;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Raw =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {};

function mcqQuestion(raw: Raw): McqQuestion {
  return {
    question: str(raw.question),
    options: arr(raw.options).map(str),
    correctIndex: num(raw.correctIndex ?? raw.correct_index),
    explanation: str(raw.explanation),
    userAnswer:
      typeof raw.userAnswer === "number" ? raw.userAnswer : undefined,
  };
}

function normalizeMcq(raw: Raw): McqContent {
  const questions =
    arr(raw.questions).length > 0
      ? arr(raw.questions).map((q) => mcqQuestion(obj(q)))
      : typeof raw.question === "string"
        ? [mcqQuestion(raw)]
        : [];
  return { type: "mcq", questions };
}

function normalizeComprehension(raw: Raw): ComprehensionContent {
  return {
    type: "comprehension_check",
    originalText: str(raw.originalText ?? raw.original_text ?? raw.text),
    userRewrites: arr(raw.userRewrites).map(str),
    evaluations: arr(raw.evaluations).map(
      (e) => obj(e) as unknown as ComprehensionEvaluation,
    ),
    passedAt: typeof raw.passedAt === "string" ? raw.passedAt : undefined,
  };
}

function normalizeFlashcards(raw: Raw): FlashcardContent {
  return {
    type: "flashcard_review",
    cards: arr(raw.cards).map((c) => {
      const card = obj(c);
      return {
        front: str(card.front),
        back: str(card.back),
        known: typeof card.known === "boolean" ? card.known : null,
      };
    }),
  };
}

function normalizeReading(raw: Raw): ReadingContent {
  return {
    type: "reading",
    text: str(raw.text),
    highlights: Array.isArray(raw.highlights)
      ? (raw.highlights as ReadingContent["highlights"])
      : undefined,
    completed: raw.completed === true,
  };
}

function worksheetPart(raw: Raw): WorksheetPart {
  const type = str(raw.type);
  return {
    label: str(raw.label),
    prompt: str(raw.prompt ?? raw.question),
    type: type === "numeric" || type === "true_false" ? type : "text",
    answer: typeof raw.answer === "string" ? raw.answer : undefined,
    userAnswer: typeof raw.userAnswer === "string" ? raw.userAnswer : undefined,
    marks: typeof raw.marks === "number" ? raw.marks : undefined,
  };
}

function normalizeWorksheet(raw: Raw): WorksheetContent {
  const steps: WorksheetStep[] = arr(raw.steps).map((s) => {
    const step = obj(s);
    return {
      title: str(step.title ?? step.question),
      intro: typeof step.intro === "string" ? step.intro : undefined,
      figure: step.figure as WorksheetStep["figure"],
      parts: arr(step.parts).map((p) => worksheetPart(obj(p))),
    };
  });
  return {
    type: "worksheet",
    source: raw.source as WorksheetContent["source"],
    steps,
  };
}

function normalizeVocab(raw: Raw): VocabRecallContent {
  const entries = arr(raw.terms).length > 0 ? arr(raw.terms) : arr(raw.cards);
  return {
    type: "vocab_recall",
    terms: entries.map((t) => {
      const entry = obj(t);
      return {
        term: str(entry.term ?? entry.front),
        definition: str(entry.definition ?? entry.back),
        result: typeof entry.result === "boolean" ? entry.result : null,
      };
    }),
  };
}

function normalizeCloze(raw: Raw): ClozeContent {
  if (arr(raw.passages).length > 0) {
    return {
      type: "cloze",
      passages: arr(raw.passages).map((p) => {
        const passage = obj(p);
        return {
          textWithBlanks: str(passage.textWithBlanks ?? passage.text),
          answers: arr(passage.answers).map(str),
          userAnswers: Array.isArray(passage.userAnswers)
            ? passage.userAnswers.map(str)
            : undefined,
        };
      }),
    };
  }
  // Bank shape: { text, gaps: [{ index, answer }] }
  const gaps = arr(raw.gaps)
    .map(obj)
    .sort((a, b) => num(a.index) - num(b.index));
  return {
    type: "cloze",
    passages: [
      {
        textWithBlanks: str(raw.textWithBlanks ?? raw.text),
        answers: gaps.map((g) => str(g.answer)),
      },
    ],
  };
}

function normalizeExplainAloud(raw: Raw): ExplainAloudContent {
  return {
    type: "explain_aloud",
    prompt: str(raw.prompt),
    keyPoints: arr(raw.keyPoints ?? raw.key_points).map(str),
    completed: raw.completed === true,
  };
}

function normalizeInteractive(raw: Raw): InteractiveContent {
  return {
    type: "interactive",
    componentType: str(raw.componentType ?? raw.component_type),
    config: obj(raw.config),
    completed: raw.completed === true,
  };
}

export function normalizeActivityContent(
  type: ActivityType,
  content: unknown,
): ActivityContent {
  const raw = obj(content);
  switch (type) {
    case "mcq":
      return normalizeMcq(raw);
    case "comprehension_check":
      return normalizeComprehension(raw);
    case "flashcard_review":
      return normalizeFlashcards(raw);
    case "reading":
      return normalizeReading(raw);
    case "worksheet":
      return normalizeWorksheet(raw);
    case "vocab_recall":
      return normalizeVocab(raw);
    case "cloze":
      return normalizeCloze(raw);
    case "explain_aloud":
      return normalizeExplainAloud(raw);
    case "interactive":
      return normalizeInteractive(raw);
  }
}
