"use client";

import { useEffect, useSyncExternalStore } from "react";
import { DAYPART_ATTR, daypartForHour, type Daypart } from "./daypart";

function subscribe(onChange: () => void) {
  // Buckets only change on the hour; a minute's lag is fine. Also re-check when the tab comes back.
  const timer = window.setInterval(onChange, 60_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onChange);
  };
}
const fromClock = () => daypartForHour(new Date().getHours());
const onServer = () => null;

/**
 * The visitor's part of the day, from their own clock. Null on the server and
 * while hydrating (so the markup matches); the real value arrives in the same
 * commit, before paint. Also keeps <html data-daypart> current while the page
 * stays open across a boundary.
 */
export function useDaypart(): Daypart | null {
  const daypart = useSyncExternalStore(subscribe, fromClock, onServer);
  useEffect(() => {
    if (daypart) document.documentElement.setAttribute(DAYPART_ATTR, daypart);
  }, [daypart]);
  return daypart;
}
