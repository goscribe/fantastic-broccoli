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
  /**
   * The latest freeze Scribe applied by itself in the last week ("A streak
   * freeze saved your 5-day streak"); `bought` freezes were paid for with
   * points. Show once per `at`.
   */
  freezeSave?: FreezeSave | null;
}

import type { FreezeSave } from "@/lib/streak-freeze";
export { freezeSaveLine, type FreezeSave } from "@/lib/streak-freeze";

function localTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export const fetchStreak = () =>
  rpc<StreakSummary>("streak.get", "query", { timezone: localTimezone() });
