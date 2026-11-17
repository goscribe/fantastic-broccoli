/** Formatting and small derivations for the admin timeline and analytics views. */

/**
 * "under a minute", "12 min", "1 h 05 min". Visit lengths are shown as
 * lower bounds ("at least …"), so partial minutes round down.
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return "under a minute";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")} min`;
}

/** "3 min", "2.5 h", "4 days" for a median time-to-first-session. */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "n/a";
  if (minutes < 1) return "under a minute";
  if (minutes < 90) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${Math.round(hours * 10) / 10} h`;
  return `${Math.round(hours / 24)} days`;
}

/** "content_quality" → "content quality". */
export function humanizeTag(tag: string): string {
  return tag.replace(/[_-]+/g, " ").trim();
}

export interface FunnelLike {
  label: string;
  users: number;
}

/**
 * The step where the most people were lost relative to the step before it.
 * Null when no step lost anyone (or there is nobody in the cohort).
 */
export function biggestDropOff(
  steps: FunnelLike[],
): { from: string; to: string; lost: number; pct: number } | null {
  let worst: { from: string; to: string; lost: number; pct: number } | null = null;
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1];
    const lost = prev.users - steps[i].users;
    if (prev.users <= 0 || lost <= 0) continue;
    if (!worst || lost > worst.lost) {
      worst = {
        from: prev.label,
        to: steps[i].label,
        lost,
        pct: Math.round((lost / prev.users) * 100),
      };
    }
  }
  return worst;
}

/** Height (0–100) of each bar relative to the tallest; an all-zero series stays flat. */
export function barHeights(values: number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((v) => (max === 0 ? 0 : Math.round((v / max) * 100)));
}

const PAGE_LABELS: Record<string, string> = {
  "/": "Home",
  "/new-subject": "New subject",
  "/planner": "Study planner",
  "/flashcards": "Flashcards",
  "/flashcards/[id]": "Flashcard set",
  "/flashcards/review": "Flashcard review",
  "/folder/[id]": "Folder",
  "/marketplace": "Marketplace",
  "/pricing": "Pricing",
  "/settings": "Settings",
  "/shared": "Shared with me",
  "/study-bot": "Study bot",
  "/export": "Export",
  "/feedback": "Feedback",
  "/workspace/[id]": "Subject home",
  "/workspace/[id]/study": "Subject: study",
  "/workspace/[id]/materials": "Subject: materials",
  "/workspace/[id]/guide": "Subject: study guide",
  "/workspace/[id]/chat": "Subject: Copilot chat",
  "/workspace/[id]/recall": "Subject: recall",
  "/workspace/[id]/bank": "Subject: question bank",
  "/workspace/[id]/bank/[itemId]": "Subject: question bank item",
  "/workspace/[id]/session/[sessionId]": "Study session",
};

/** A readable name for a recorded route pattern; unknown routes show as the pattern itself. */
export function pageLabel(path: string): string {
  return PAGE_LABELS[path] ?? path;
}
