"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { claimTry, clearPendingTry, pendingTry } from "@/lib/api/anon";
import { SESSION_COMPLETED_EVENT } from "@/lib/api/account";

/**
 * Signed in with an anonymous Quick 5 still waiting in this browser (they
 * signed up from the header or logged in instead of the results page's
 * button): attach it to the account. From home they are taken to its
 * results; elsewhere it is saved quietly. Renders nothing.
 */
export function PendingTryClaim() {
  const router = useRouter();
  const pathname = usePathname();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || pathname.startsWith("/try/")) return;
    const attemptId = pendingTry();
    if (!attemptId) return;
    started.current = true;
    claimTry(attemptId)
      .then(({ workspaceId, sessionId }) => {
        clearPendingTry();
        window.dispatchEvent(new Event(SESSION_COMPLETED_EVENT));
        if (window.location.pathname === "/") router.replace(`/workspace/${workspaceId}/session/${sessionId}`);
      })
      .catch((err: unknown) => {
        // Expired, someone else's, or never finished generating: nothing to keep.
        if (err instanceof Error && /expired or does not exist/.test(err.message)) clearPendingTry();
      });
  }, [pathname, router]);

  return null;
}
