/**
 * The "Stuck? Tap me" bubble on the collapsed Copilot tab in the session player.
 *
 * Rules (per device, so they live in localStorage, and every read/write is
 * wrapped: private mode or a full store just means the bubble is not shown):
 * - The × dismisses it for good.
 * - It stops once the student has opened Copilot themselves twice: they know
 *   where it is.
 * - At most once per page visit to a session (the caller keeps that in state),
 *   only after a short wait on a question or right after a wrong answer.
 * - Only where it fits in the empty gutter between the content column and the
 *   tab (wrapping to two lines in a narrow gutter), so it never covers the
 *   question, the answers or the buttons. Below ~1270px wide (phones included) there
 *   is no such gutter (on phones the edge tab is hidden and Copilot is a
 *   top-bar button), so it does not show there.
 */
export const COPILOT_BUBBLE_DISMISSED_KEY = "scribe.copilot.bubble.dismissed";
export const COPILOT_OPENS_KEY = "scribe.copilot.opens";
/** Opening Copilot this many times yourself retires the bubble. */
export const BUBBLE_MAX_OPENS = 2;
/** How long a student sits on a question before the bubble offers help. */
export const BUBBLE_IDLE_MS = 15_000;
/** After a wrong answer: long enough to read the feedback first. */
export const BUBBLE_AFTER_WRONG_MS = 1_200;
/** The bubble leaves by itself after this long (it has had its one showing). */
export const BUBBLE_VISIBLE_MS = 20_000;
/** Clear space kept between the bubble and the content column / the tab. */
export const BUBBLE_GAP = 12;

type ReadStore = Pick<Storage, "getItem">;
type WriteStore = Pick<Storage, "getItem" | "setItem">;

function readOpens(store: ReadStore): number {
  const n = Number.parseInt(store.getItem(COPILOT_OPENS_KEY) ?? "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** May the bubble be offered on this device at all? */
export function bubbleAllowed(store: ReadStore | null | undefined): boolean {
  if (!store) return false;
  try {
    if (store.getItem(COPILOT_BUBBLE_DISMISSED_KEY) === "1") return false;
    return readOpens(store) < BUBBLE_MAX_OPENS;
  } catch {
    return false;
  }
}

/** The ×: never again on this device. */
export function dismissBubble(store: WriteStore | null | undefined): void {
  try {
    store?.setItem(COPILOT_BUBBLE_DISMISSED_KEY, "1");
  } catch {
    // Storage blocked: it still goes away for this visit (the caller hides it).
  }
}

/** The student opened Copilot themselves (tab, top-bar button or the bubble). */
export function countCopilotOpen(store: WriteStore | null | undefined): void {
  try {
    if (!store) return;
    store.setItem(COPILOT_OPENS_KEY, String(Math.min(readOpens(store) + 1, 99)));
  } catch {
    // Storage blocked: nothing to count.
  }
}

/** Narrowest the bubble may get (its line wraps to two below its natural width). */
export const BUBBLE_MIN_WIDTH = 176;

/**
 * Room for the bubble between the content column's right edge and the tab's
 * left edge, keeping a gap on both sides; null when it would not fit without
 * covering the column (the question, the answers, the buttons).
 */
export function bubbleRoom(contentRight: number, tabLeft: number): number | null {
  const room = Math.floor(tabLeft - contentRight - BUBBLE_GAP * 2);
  return room >= BUBBLE_MIN_WIDTH ? room : null;
}
