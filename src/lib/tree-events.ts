/**
 * Cross-component notification for workspace/folder tree changes, so
 * surfaces with their own tree state (sidebar, dashboard, folder pages)
 * stay in sync when one of them creates, edits, or deletes a node.
 */

const EVENT = "scribe:tree-changed";

export function emitTreeChanged(): void {
  window.dispatchEvent(new Event(EVENT));
}

export function onTreeChanged(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
