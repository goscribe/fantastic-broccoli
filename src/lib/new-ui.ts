"use client";

import { useSyncExternalStore } from "react";

const KEY = "scribe.newUi";
const envOff = process.env.NEXT_PUBLIC_NEW_UI === "0";

/** The redesign is the app. `?ui=old` once per browser (or NEXT_PUBLIC_NEW_UI=0) falls back to the legacy screens; `?ui=new` clears it. */
function readClient(): boolean {
  if (envOff) return false;
  const q = new URLSearchParams(window.location.search).get("ui");
  if (q === "old") localStorage.setItem(KEY, "0");
  if (q === "new") localStorage.removeItem(KEY);
  const on = localStorage.getItem(KEY) !== "0";
  document.documentElement.classList.toggle("new-ui", on);
  return on;
}

export function useNewUi(): boolean {
  return useSyncExternalStore(
    () => () => {},
    readClient,
    () => !envOff,
  );
}
