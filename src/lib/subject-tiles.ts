/**
 * Home's subject tiles with real accounts: which subjects to show first, and
 * what the tile's second line says. Pure, so it is unit-tested.
 */

/** Up to this many subjects, home shows them all (and its "New subject" tile). */
export const HOME_TILES_ALL_UP_TO = 8;
/** Past that, home shows this many (whole rows at 1, 2 and 3 columns) and a "Show all" control. */
export const HOME_TILES_SHOWN = 6;

const time = (v: string | Date | null | undefined) => {
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
};

/**
 * Subjects, most recently active first: the latest of the subject's own
 * timestamp and its sessions' updates. Ties keep the order they came in.
 */
export function byRecentActivity<W extends { id: string; createdAt?: string | Date | null; lastStudied?: string | Date | null }>(
  workspaces: W[],
  sessions: { workspaceId: string; updatedAt?: string | Date | null; createdAt?: string | Date | null }[],
): W[] {
  const last = new Map<string, number>();
  for (const w of workspaces) last.set(w.id, Math.max(time(w.createdAt), time(w.lastStudied)));
  for (const s of sessions) {
    if (!last.has(s.workspaceId)) continue;
    last.set(s.workspaceId, Math.max(last.get(s.workspaceId)!, time(s.updatedAt), time(s.createdAt)));
  }
  return workspaces
    .map((w, i) => ({ w, i }))
    .sort((a, b) => last.get(b.w.id)! - last.get(a.w.id)! || a.i - b.i)
    .map((x) => x.w);
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Whether a session's title only repeats its subject's ("B4 Thermodynamics
 * Guide +3" under the subject of the same name, or a cut-off copy of it), so
 * "Next: …" would say nothing the tile's title has not.
 */
export function repeatsTitle(subjectTitle: string, sessionTitle: string | null | undefined): boolean {
  const a = norm(subjectTitle);
  const b = norm(sessionTitle ?? "");
  if (!b) return true;
  if (!a) return false;
  return a === b || b.startsWith(a) || (b.length >= 8 && a.startsWith(b));
}

/** About how much of a long title a tile shows before it is cut ("B4 Thermodynami…"). */
export const TILE_TITLE_VISIBLE_CHARS = 16;

/**
 * Subjects whose titles look the same once a tile cuts them ("B4
 * Thermodynamics Guide +3" and "B4 Thermodynamics Short Answer Questions"
 * both read "B4 Thermodynami…"). For each of those, the part that tells it
 * apart ("Guide +3", "Short Answer Questions"), to show on the tile's second
 * line. Titles that are short, or unique in what the tile shows, get nothing.
 */
export function titleHints(subjects: { id: string; title: string }[], visibleChars = TILE_TITLE_VISIBLE_CHARS): Map<string, string> {
  const hints = new Map<string, string>();
  const groups = new Map<string, { id: string; words: string[] }[]>();
  for (const s of subjects) {
    const title = s.title.trim().replace(/\s+/g, " ");
    if (title.length <= visibleChars) continue;
    const key = title.slice(0, visibleChars).toLowerCase();
    const group = groups.get(key) ?? [];
    group.push({ id: s.id, words: title.split(" ") });
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // The words every title in the group starts with.
    let shared = 0;
    while (group.every((g) => g.words.length > shared && g.words[shared].toLowerCase() === group[0].words[shared].toLowerCase())) shared++;
    for (const g of group) {
      const rest = g.words.slice(shared).join(" ");
      if (rest) hints.set(g.id, rest);
    }
  }
  return hints;
}
