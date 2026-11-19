import { rpc } from "./study-session";

export interface StreakDay {
  /** Local YYYY-MM-DD. */
  date: string;
  minutes: number;
  /** At least one activity finished that day. */
  done: boolean;
  goalMet: boolean;
  /** Missed, but a streak freeze kept the streak alive. */
  frozen: boolean;
}

export interface StreakSummary {
  current: number;
  longest: number;
  goalMin: number;
  todayMinutes: number;
  /** Today already counts toward the streak (any finished activity). */
  todayDone: boolean;
  todayGoalMet: boolean;
  /** Streak freezes held; the server spends them on missed days. */
  freezes: number;
  /** Last 7 local days, oldest first, ending today. */
  week: StreakDay[];
}

function localTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export const fetchStreak = () =>
  rpc<StreakSummary>("streak.get", "query", { timezone: localTimezone() });
