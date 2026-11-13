"use client";

import { useEffect, useState } from "react";

/** True below Tailwind's `sm` breakpoint (phones). */
export function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

/** Mon–Sun chips for picking one day of a week on a phone. */
export const weekdayIndexOf = (ymd: string) => (new Date(ymd + "T00:00:00Z").getUTCDay() + 6) % 7;
