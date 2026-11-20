/** Wording and small sums for the generation assessment card on the admin Quality page. */

const MEDIUM_ISSUE_LABELS: Record<string, string> = {
  needs_drawing: "Asks the student to draw or plot",
  needs_paper: "Needs paper or handwriting",
  needs_equipment: "Needs equipment that is not on screen",
  hard_to_type: "Answer is hard to type",
  too_long_to_type: "Answer is too long to type",
  missing_figure: "Refers to a figure that is not shown",
  needs_other_source: "Sends the student to another source",
  other_medium: "Other device problem",
};

export function mediumIssueLabel(kind: string): string {
  return MEDIUM_ISSUE_LABELS[kind] ?? kind.replace(/_/g, " ");
}

/** "7.4", or "–" when nothing was assessed. */
export function scoreText(score: number | null): string {
  return score === null ? "–" : score.toFixed(1);
}

/**
 * Change against the previous run, e.g. "+0.6 since last run". Null when
 * either run has no score or nothing moved, so the card stays quiet.
 */
export function scoreChange(now: number | null, before: number | null | undefined): string | null {
  if (now === null || before === null || before === undefined) return null;
  const diff = Math.round((now - before) * 10) / 10;
  if (diff === 0) return null;
  return `${diff > 0 ? "+" : "−"}${Math.abs(diff).toFixed(1)} since last run`;
}
