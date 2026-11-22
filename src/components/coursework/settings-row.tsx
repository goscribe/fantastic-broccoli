"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { courseworkApi, type GraderStatus } from "@/lib/api/coursework";
import { allowanceCopy, ultraPitch } from "@/lib/coursework";
import { useCw } from "./use-cw";
import { ultraOffer } from "./use-grader";

/**
 * Settings › Plan: what the plan gives for coursework today, in the plan
 * row's own flat style. Ultra is named only when it is on sale and the
 * student is not already on it. Renders nothing on a server without the grader.
 */
export function CourseworkPlanRow() {
  const { t } = useCw();
  const [status, setStatus] = useState<GraderStatus | null>(null);
  const [now] = useState(() => new Date());
  useEffect(() => {
    let cancelled = false;
    courseworkApi
      .status()
      .then((s) => !cancelled && setStatus(s))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  if (!status) return null;
  const ultra = ultraOffer(status);
  const copy = allowanceCopy(status, ultra, now);
  const pitch = status.tier !== "ultra" && copy.state !== "locked" ? ultraPitch(ultra) : null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-border py-4">
      <div className="min-w-0">
        <p className="text-ui font-extrabold">{t("cw.set.row")}</p>
        <p className="mt-0.5 text-small text-muted-foreground">
          {copy.line}
          {copy.state === "limit" && copy.resets ? `. ${copy.resets}` : ""}
        </p>
      </div>
      {pitch && (
        <Link href="/pricing" className="text-small font-extrabold text-foreground underline decoration-border-strong decoration-2 underline-offset-4">
          {pitch}
        </Link>
      )}
    </div>
  );
}
