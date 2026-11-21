/**
 * Whether the Copilot panel starts docked open in the session player.
 * Closed by default: the question is the screen's one job, and a docked panel
 * squeezes it (at 768 the question column was ~330px). A student who opens it
 * keeps it open next time; on a phone it covers the whole screen, so it never
 * starts open there whatever was chosen on a wider screen.
 */
export const COPILOT_OPEN_KEY = "scribe.copilot.open";

type ReadStore = Pick<Storage, "getItem">;
type WriteStore = Pick<Storage, "setItem">;

export function initialCopilotOpen(store: ReadStore | null | undefined, wideScreen: boolean): boolean {
  if (!wideScreen) return false;
  try {
    return store?.getItem(COPILOT_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

/** Remember an explicit open/close (the student's own tap, not a one-off prompt that opens the panel). */
export function rememberCopilotOpen(store: WriteStore | null | undefined, open: boolean): void {
  try {
    store?.setItem(COPILOT_OPEN_KEY, open ? "1" : "0");
  } catch {
    // Private mode / storage full: the choice just lasts for this page.
  }
}
