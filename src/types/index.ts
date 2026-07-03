export type ActivityType =
  | "mcq"
  | "comprehension_check"
  | "flashcard_review"
  | "reading"
  | "worksheet"
  | "interactive";

export type ActivityStatus = "pending" | "in_progress" | "completed" | "skipped";

export type SessionDepth = "light" | "moderate" | "deep";

export type ExamBoard = "IB" | "AP" | "GCSE" | "A_LEVEL" | "SAT" | "OTHER";

export interface StudySession {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  depth: SessionDepth;
  durationMinutes: number;
  comments: string[];
  activities: SessionActivity[];
  progress: number;
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
  meta?: Record<string, unknown>;
}

export type ActivityContent =
  | McqContent
  | ComprehensionContent
  | FlashcardContent
  | ReadingContent
  | WorksheetContent
  | InteractiveContent;

export interface McqContent {
  type: "mcq";
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  userAnswer?: number;
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
  cards: { front: string; back: string; known: boolean | null }[];
}

export interface ReadingContent {
  type: "reading";
  text: string;
  highlights?: { start: number; end: number; note: string }[];
  completed: boolean;
}

export interface WorksheetContent {
  type: "worksheet";
  questions: {
    prompt: string;
    type: "text" | "numeric" | "true_false";
    answer?: string;
    userAnswer?: string;
    correct?: boolean;
  }[];
}

export interface InteractiveContent {
  type: "interactive";
  componentType: string;
  config: Record<string, unknown>;
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
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  workspaces: Workspace[];
  parentId?: string;
}
