"use client";

import { useEffect } from "react";
import {
  fetchPlanCaps,
  fetchPlanOptions,
  SESSION_COMPLETED_EVENT,
} from "@/lib/api/account";
import { useAuthUser } from "@/lib/api/auth";
import { CHECKOUT_REFRESH_DELAYS_MS } from "@/lib/checkout-return";
import { reportActivationConversion, reportPaidConversion } from "@/lib/gtag";

/**
 * Sends the Google Ads conversions bidding optimises for, each once per user:
 * activation (first completed study session) and a paid plan / trial start,
 * confirmed from the server's plan state — on load, and a few times after
 * returning from checkout while the provider webhook lands.
 */
export function ConversionTracker() {
  const { user } = useAuthUser();

  useEffect(() => {
    if (!user || user.isAdmin) return;
    const fromCheckout =
      new URLSearchParams(window.location.search).get("checkout") === "success";
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const check = async () => {
      try {
        const caps = await fetchPlanCaps();
        if (cancelled) return;
        if (caps.completedSessions >= 1) reportActivationConversion(user.id);
        if (caps.paid) {
          const plans = await fetchPlanOptions();
          const active = plans.find((p) => p.isActive && p.priceDollars > 0);
          if (active && !cancelled) reportPaidConversion(user.id, active.id, active.priceDollars);
        }
      } catch {
        // tracking is best-effort
      }
    };

    void check();
    if (fromCheckout) {
      for (const delay of CHECKOUT_REFRESH_DELAYS_MS) timers.push(setTimeout(() => void check(), delay));
    }
    const onCompleted = () => void check();
    window.addEventListener(SESSION_COMPLETED_EVENT, onCompleted);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      window.removeEventListener(SESSION_COMPLETED_EVENT, onCompleted);
    };
  }, [user]);

  return null;
}
