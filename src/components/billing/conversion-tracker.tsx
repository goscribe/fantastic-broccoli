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
import { isPaidConversion } from "@/lib/plan-access";
import { paidConversionPlan } from "@/lib/pass";

/**
 * After the debrief announces a finished session, re-check a few times: the
 * debrief can mount (e.g. a second "done" tap skips the reward pause) before
 * the last activity's status write lands and the server counts the session.
 */
const ACTIVATION_RECHECK_DELAYS_MS = [1500, 4000, 10000];

/**
 * Sends the Google Ads conversions bidding optimises for, each once per user:
 * activation (first completed study session of any kind — a Quick 5 counts,
 * since the server's `completedSessions` includes quick-start sessions) and a
 * paid plan / trial start, confirmed from the server's plan state — on load,
 * right after a session completes, and a few times after returning from
 * checkout while the provider webhook lands.
 */
export function ConversionTracker() {
  const { user } = useAuthUser();

  useEffect(() => {
    if (!user || user.isAdmin) return;
    const fromCheckout =
      new URLSearchParams(window.location.search).get("checkout") === "success";
    let cancelled = false;
    let activated = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const check = async () => {
      try {
        const caps = await fetchPlanCaps();
        if (cancelled) return;
        if (caps.completedSessions >= 1) {
          activated = true;
          reportActivationConversion(user.id);
        }
        // A complimentary grant is not a purchase: never reported as one.
        // An exam pass is a paid conversion worth its one-off price (29 / 59),
        // including one a parent paid through a pay link while the student was away.
        if (isPaidConversion(caps)) {
          const plans = caps.paidPlan ? [] : await fetchPlanOptions();
          const paid = paidConversionPlan(caps, plans);
          if (paid && !cancelled) reportPaidConversion(user.id, paid.id, paid.price);
        }
      } catch {
        // tracking is best-effort
      }
    };

    void check();
    if (fromCheckout) {
      for (const delay of CHECKOUT_REFRESH_DELAYS_MS) timers.push(setTimeout(() => void check(), delay));
    }
    const onCompleted = () => {
      void check();
      for (const delay of ACTIVATION_RECHECK_DELAYS_MS) {
        timers.push(setTimeout(() => {
          if (!activated) void check();
        }, delay));
      }
    };
    window.addEventListener(SESSION_COMPLETED_EVENT, onCompleted);
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      window.removeEventListener(SESSION_COMPLETED_EVENT, onCompleted);
    };
  }, [user]);

  return null;
}
