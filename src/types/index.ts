export type ActivityType =
  | "mcq"
  | "comprehension_check"
  | "flashcard_review"
  | "reading"
  | "worksheet"
  | "interactive"
  | "vocab_recall"
  | "cloze"
  | "explain_aloud";

export type ActivityStatus = "pending" | "in_progress" | "completed" | "skipped";

export type SessionDepth = "light" | "moderate" | "deep";

export type ExamBoard = "IB" | "AP" | "GCSE" | "A_LEVEL" | "SAT" | "OTHER";

export interface SessionNote {
  id: string;
  content: string;
  createdAt: string;
}

export interface StudySession {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  depth: SessionDepth;
  durationMinutes: number;
  comments: SessionNote[];
  activities: SessionActivity[];
  progress: number;
  generating: boolean;
  status: "active" | "paused" | "completed";
  startDate: string;
  endDate?: string;
  examBoard?: ExamBoard;
  syllabus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionActivity {
  id: string;
  sessionId: string;
  type: ActivityType;
  title: string;
  description?: string;
  content: ActivityContent;
  order: number;
  status: ActivityStatus;
  estimatedMinutes: number;
  timeSpentSeconds?: number;
  highlights?: SessionHighlight[];
  meta?: Record<string, unknown>;
}

/** A persisted reading highlight (studySession.addHighlight). */
export interface SessionHighlight {
  id: string;
  activityId: string;
  text: string;
  color: string;
  note?: string;
  paragraph: number;
  startChar: number;
  endChar: number;
  createdAt: string;
}

export type ActivityContent =
  | McqContent
  | ComprehensionContent
  | FlashcardContent
  | ReadingContent
  | WorksheetContent
  | InteractiveContent
  | VocabRecallContent
  | ClozeContent
  | ExplainAloudContent;

export interface McqQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  userAnswer?: number;
}

export interface McqContent {
  type: "mcq";
  questions: McqQuestion[];
}

export interface ComprehensionContent {
  type: "comprehension_check";
  originalText: string;
  userRewrites: string[];
  evaluations: ComprehensionEvaluation[];
  passedAt?: string;
}

export interface ComprehensionEvaluation {
  attempt: number;
  score: number;
  feedback: string;
  passed: boolean;
}

export interface FlashcardContent {
  type: "flashcard_review";
  cards: {
    front: string;
    back: string;
    known: boolean | null;
    /** Backing relational `Flashcard` row for SRS progress tracking. */
    flashcardId?: string;
  }[];
}

export interface GraphFigureExpression {
  latex: string;
  label?: string | null;
}

export interface ReadingGraphFigure {
  id: string;
  type: "graph";
  title: string;
  xLabel: string;
  yLabel: string;
  expressions: GraphFigureExpression[];
}

export interface ReadingImageFigure {
  id: string;
  type: "image";
  url: string;
  caption: string;
}

export type ReadingFigure = ReadingGraphFigure | ReadingImageFigure;

export interface ReadingContent {
  type: "reading";
  text: string;
  figures?: ReadingFigure[];
  highlights?: { start: number; end: number; note: string }[];
  completed: boolean;
}

export interface WorksheetFigure {
  figure: string;
  title: string;
  caption?: string;
  source?: { file: string; page: number };
}

export interface MarkSchemePoint {
  point: number;
  requirements: string;
}

export interface MarkScheme {
  points: MarkSchemePoint[];
  totalPoints: number;
}

export interface MarkedPoint extends MarkSchemePoint {
  achievedPoints: number;
  feedback: string;
}

export interface PartMarking {
  points: MarkedPoint[];
  achievedPoints: number;
  totalPoints: number;
  correct: boolean;
}

export interface WorksheetPart {
  label: string;
  prompt: string;
  type: "text" | "numeric" | "true_false";
  answer?: string;
  userAnswer?: string;
  marks?: number;
  markScheme?: MarkScheme;
  /** Backing relational `WorksheetQuestion` row for progress tracking. */
  worksheetQuestionId?: string;
}

export interface WorksheetStep {
  title: string;
  intro?: string;
  figure?: WorksheetFigure;
  parts: WorksheetPart[];
}

export interface WorksheetContent {
  type: "worksheet";
  source?: { file: string; generatedByAi?: boolean };
  steps: WorksheetStep[];
}

export interface InteractiveContent {
  type: "interactive";
  componentType: string;
  config: Record<string, unknown>;
  completed: boolean;
}

export interface VocabRecallContent {
  type: "vocab_recall";
  terms: { term: string; definition: string; result: boolean | null }[];
}

export interface ClozeContent {
  type: "cloze";
  passages: {
    textWithBlanks: string;
    answers: string[];
    userAnswers?: string[];
  }[];
}

export interface ExplainAloudContent {
  type: "explain_aloud";
  prompt: string;
  keyPoints: string[];
  completed: boolean;
}

export type MaterialType = "note" | "pdf" | "audio" | "slides";

export interface Material {
  id: string;
  workspaceId: string;
  type: MaterialType;
  title: string;
  preview?: string;
  pages?: number;
  durationSeconds?: number;
  sizeLabel?: string;
  analyzed?: boolean;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  title: string;
  description?: string;
  icon: string;
  color: string;
  course?: string;
  folderId?: string;
  sessions: StudySession[];
  materials: Material[];
  totalProgress: number;
  lastStudied?: string;
  createdAt: string;
  sharedBy?: string;
  members?: WorkspaceMember[];
}

export interface WorkspaceMember {
  id: string;
  name: string;
  color: string;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  workspaces: Workspace[];
  folders?: Folder[];
  parentId?: string;
}
