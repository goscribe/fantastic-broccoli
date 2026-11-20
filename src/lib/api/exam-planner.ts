import { rpc } from "./study-session";

/** learn → practice → review are the topic ladder; quick5 and mock are whole-paper tasks before the exam. */
export type PlanTaskKind = "learn" | "practice" | "review" | "quick5" | "mock";
export type TopicLevel = "unknown" | "beginner" | "developing" | "secure";

export interface PlanTask {
  id: string;
  /** Local day YYYY-MM-DD. */
  date: string;
  kind: PlanTaskKind;
  workspaceId: string;
  subject: string;
  examId: string | null;
  examTitle: string | null;
  topic: string | null;
  label: string;
  minutes: number;
  status: "planned" | "done" | "skipped" | "missed";
  /** Day this was planned for before it was missed and moved forward. */
  movedFrom: string | null;
  pinned: boolean;
  sessionId: string | null;
}

export interface ExamSummary {
  id: string;
  workspaceId: string;
  subject: string;
  title: string;
  kind: "exam" | "test" | "coursework";
  date: string;
  daysLeft: number;
  topics: number;
  covered: number;
  secure: number;
  unplanned: number;
  tasksDone: number;
  tasksTotal: number;
  topicLabels: string[];
  confidence: Record<string, number>;
}

export interface PlanToday {
  today: string;
  tasks: PlanTask[];
  exams: ExamSummary[];
  /** Sunday first. */
  weekdayMinutes: number[];
  minutesToday: number;
  movedForward: number;
  missedYesterday: number;
  /** The next planned task when today is a rest day. */
  next: PlanTask | null;
}

export interface PlanRange {
  today: string;
  from: string;
  days: { date: string; minutes: number; tasks: PlanTask[]; exams: { id: string; title: string; date: string; workspaceId: string }[] }[];
}

export interface ExamTopic {
  key: string;
  label: string;
  level: TopicLevel;
  mastery: number | null;
  attempts: number;
}

export interface ExamInput {
  id?: string;
  workspaceId: string;
  title: string;
  date: string;
  kind: "exam" | "test" | "coursework";
  topics: string[];
  /** Topic key → 0 shaky, 1 okay, 2 solid. */
  confidence: Record<string, number>;
}

const tz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

export const fetchPlanToday = () => rpc<PlanToday>("planner.today", "query", { timezone: tz() });
export const fetchPlanRange = (from: string | undefined, days: number) =>
  rpc<PlanRange>("planner.examPlan", "query", { from, days, timezone: tz() });
export const fetchExamTopics = (workspaceId: string) => rpc<ExamTopic[]>("planner.examTopics", "query", { workspaceId });
export const fetchExamSuggestions = () =>
  rpc<{ connected: boolean; suggestions: { title: string; date: string }[] }>("planner.examSuggestions", "query", { timezone: tz() });
export const saveExam = (input: ExamInput) => rpc<{ id: string }>("planner.saveExam", "mutation", input);
export const deleteExam = (id: string) => rpc<{ ok: boolean }>("planner.deleteExam", "mutation", { id });
export const setWeekdayMinutes = (minutes: number[]) => rpc<{ ok: boolean }>("planner.setWeekdayMinutes", "mutation", { minutes });
export const startPlanTask = (id: string) => rpc<{ path: string; sessionId: string }>("planner.startTask", "mutation", { id });
export const setPlanTaskStatus = (id: string, status: "planned" | "done" | "skipped") =>
  rpc<{ ok: boolean }>("planner.setTaskStatus", "mutation", { id, status });
export const movePlanTask = (id: string, date: string) => rpc<{ ok: boolean }>("planner.moveTask", "mutation", { id, date });

/** Mirrors the server's first-rung rule, for the setup's time suggestion. */
export function suggestedDailyMinutes(masteries: number[], studyDays: number): number {
  const need = masteries.reduce((n, m) => n + (m < 0.45 ? 60 : m < 0.75 ? 35 : 20), 0);
  const perDay = need / Math.max(1, studyDays) + 10;
  return Math.max(15, Math.min(120, Math.ceil(perDay / 15) * 15));
}

export const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const dayDiff = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
export const weekdayOf = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();
/** Monday of the week containing `ymd`. */
export const mondayOf = (ymd: string) => addDays(ymd, -((weekdayOf(ymd) + 6) % 7));
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
