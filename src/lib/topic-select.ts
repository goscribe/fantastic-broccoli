/**
 * Picking several course topics on the subject page to start one session on
 * all of them. Pure (no React or API imports) so the rules can be tested:
 * what a tick does, what a unit's box shows, the cap, and the session length
 * the server will choose.
 */

/** The most topics one session covers (`course.startTopics` refuses more). */
export const MAX_SELECTED_TOPICS = 20;

export type GroupState = "none" | "some" | "all";

export interface SelectChange {
  next: ReadonlySet<string>;
  /** Topics that were not added because the selection is full. */
  capped: boolean;
}

/** Ticks or unticks one topic. A full selection takes no more. */
export function toggleTopic(selected: ReadonlySet<string>, id: string, max = MAX_SELECTED_TOPICS): SelectChange {
  const next = new Set(selected);
  if (next.delete(id)) return { next, capped: false };
  if (next.size >= max) return { next: selected, capped: true };
  next.add(id);
  return { next, capped: false };
}

/** A unit's box: empty, a dash when some of its topics are picked, ticked when all are. */
export function groupState(ids: readonly string[], selected: ReadonlySet<string>): GroupState {
  const picked = ids.filter((id) => selected.has(id)).length;
  if (picked === 0) return "none";
  return picked === ids.length ? "all" : "some";
}

/**
 * A unit's box pressed: a fully picked unit is cleared; otherwise its
 * remaining topics are added, in order, for as long as there is room.
 */
export function toggleGroup(selected: ReadonlySet<string>, ids: readonly string[], max = MAX_SELECTED_TOPICS): SelectChange {
  const next = new Set(selected);
  if (ids.length > 0 && ids.every((id) => next.has(id))) {
    for (const id of ids) next.delete(id);
    return { next, capped: false };
  }
  let capped = false;
  for (const id of ids) {
    if (next.has(id)) continue;
    if (next.size >= max) {
      capped = true;
      break;
    }
    next.add(id);
  }
  return { next, capped };
}

/** The picked topics that are still in the list, in the list's own order. */
export function selectedInOrder(units: readonly { topics: readonly { id: string }[] }[], selected: ReadonlySet<string>): string[] {
  return units.flatMap((u) => u.topics.filter((t) => selected.has(t.id)).map((t) => t.id));
}

/**
 * Minutes the server gives a session over this many topics when the learner
 * has not chosen a length (goscribe/server src/lib/courses/mixed.ts): the
 * starting point of the "how long?" slider.
 */
export function mixedSessionMinutes(topicCount: number): number {
  return Math.min(45, Math.max(15, 5 + topicCount * 5));
}
