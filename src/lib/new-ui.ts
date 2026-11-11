"use client";

import { useSyncExternalStore } from "react";

const KEY = "scribe.newUi";
const envOn = process.env.NEXT_PUBLIC_NEW_UI === "1";

/** Redesign flag: NEXT_PUBLIC_NEW_UI=1 for everyone, or ?ui=new / ?ui=old once per browser to preview. */
function readClient(): boolean {
  if (envOn) return true;
  const q = new URLSearchParams(window.location.search).get("ui");
  if (q === "new") localStorage.setItem(KEY, "1");
  if (q === "old") localStorage.removeItem(KEY);
  const on = localStorage.getItem(KEY) === "1";
  document.documentElement.classList.toggle("new-ui", on);
  return on;
}

export function useNewUi(): boolean {
  return useSyncExternalStore(
    () => () => {},
    readClient,
    () => envOn,
  );
}
