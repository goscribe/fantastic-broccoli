/**
 * Reveal on scroll for the note reader (components/notes-public/reading-progress.tsx).
 *
 * The rule: motion never decides whether content can be seen. An element is
 * hidden ("wait") only while an observer that will show it again is alive,
 * and the stylesheet hides it only under the root attribute that observer
 * owns (REVEAL_SCOPE), so a script that stops for any reason leaves the whole
 * note readable.
 *
 * States of `data-nl-reveal`: "" (as rendered, visible), "wait" (below the
 * fold, hidden until it arrives), "in" (arrived; eases in once).
 */
export const REVEAL_SCOPE = "data-nl-reveals";

export type RevealState = "" | "wait" | "in";

/** What a freshly started observer does with an element: hide and watch it, or leave it alone. */
export function revealOnStart(state: string | undefined, top: number, viewportHeight: number): { state: RevealState; observe: boolean } {
  // Shown once already: never hidden again.
  if (state === "in") return { state: "in", observe: false };
  // On screen (or above it) right now: it must not blink out.
  if (top < viewportHeight) return { state: "", observe: false };
  // Below the fold. Also takes over an element an earlier observer left waiting, which nothing else would ever show.
  return { state: "wait", observe: true };
}

/** What an observer that is going away leaves behind: nothing stays hidden. */
export function revealOnStop(state: string | undefined): RevealState {
  return state === "in" ? "in" : "";
}
