import { rpc } from "./study-session";

export interface StreakSummary {
  current: number;
  longest: number;
  goalMin: number;
  todayMinutes: number;
  todayDone: boolean;
  week: { date: string; minutes: number; done: boolean }[];
}

export const fetchStreak = () => rpc<StreakSummary>("streak.get", "query", undefined);
