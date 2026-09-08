"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLAN_LIMIT_EVENT, PLAN_LIMIT_ERROR_PREFIX } from "@/lib/api/account";

/**
 * Upgrade prompt that opens whenever a request is refused by a free-plan cap
 * (see `toastError`). Renders nothing until such an error is announced.
 */
export function PlanLimitDialog() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const onLimit = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setMessage(typeof detail === "string" ? detail : PLAN_LIMIT_ERROR_PREFIX);
    };
    window.addEventListener(PLAN_LIMIT_EVENT, onLimit);
    return () => window.removeEventListener(PLAN_LIMIT_EVENT, onLimit);
  }, []);

  if (!message) return null;

  const detail = message.startsWith(PLAN_LIMIT_ERROR_PREFIX)
    ? message.slice(PLAN_LIMIT_ERROR_PREFIX.length).replace(/^[:\s]+/, "")
    : message;
  const close = () => setMessage(null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1 text-faint hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Lock className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-xl font-bold tracking-tight">
          You&apos;ve hit the free plan limit
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              close();
              router.push("/pricing");
            }}
          >
            Upgrade to keep going
          </Button>
          <button
            type="button"
            onClick={close}
            className="text-xs text-faint hover:text-muted-foreground"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
