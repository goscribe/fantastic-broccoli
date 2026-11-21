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
