"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mistakesApi } from "@/lib/api/mistakes";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/mistakes";

type State = { kind: "building" } | { kind: "empty" } | { kind: "failed" };

/**
 * "Practice my mistakes" deep link (end screen, Mistakes page, comeback
 * email): builds a short round from the open mistakes — one subject
 * (`?workspace=`), one finished session's (`?session=`), or the subject with
 * most — and opens it in the session player.
 */
function PracticeInner() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const workspaceId = params.get("workspace") ?? undefined;
  const sessionId = params.get("session") ?? undefined;
  const [state, setState] = useState<State>({ kind: "building" });
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  useEffect(() => {
    // Once per attempt (StrictMode runs effects twice; a second call would replace the first round).
    if (started.current === attempt) return;
    started.current = attempt;
    mistakesApi
      .startPractice({ workspaceId, sessionId })
      .then((r) => {
        if (r.sessionId && r.workspaceId) router.replace(`/workspace/${r.workspaceId}/session/${r.sessionId}`);
        else setState({ kind: "empty" });
      })
      .catch(() => setState({ kind: "failed" }));
  }, [attempt, workspaceId, sessionId, router]);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <Image
        src={state.kind === "empty" ? "/design/cat3-trophy.webp" : "/design/cat3-book.webp"}
        alt=""
        width={413}
        height={400}
        unoptimized
        className="cat-bob h-28 w-auto select-none"
      />
      {state.kind === "building" && (
        <p className="mt-5 inline-flex items-center gap-2 text-[15px] font-semibold text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" />
          {t("mistakes.building")}
        </p>
      )}
      {state.kind === "empty" && (
        <>
          <h1 className="mt-5 text-xl font-bold tracking-tight">{t("mistakes.nothingToFixTitle")}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("mistakes.nothingToFix")}</p>
          <Link href={workspaceId ? `/mistakes?workspace=${encodeURIComponent(workspaceId)}` : "/mistakes"} className="mt-6 w-full">
            <Button size="lg" variant="outline" className="w-full">
              {t("mistakes.seeAll")}
            </Button>
          </Link>
        </>
      )}
      {state.kind === "failed" && (
        <>
          <p className="mt-5 text-[15px] font-semibold">{t("mistakes.practiceFailed")}</p>
          <Button
            size="lg"
            className="mt-6 w-full"
            onClick={() => {
              setState({ kind: "building" });
              setAttempt((a) => a + 1);
            }}
          >
            {t("mistakes.tryAgain")}
          </Button>
        </>
      )}
    </main>
  );
}

export default function PracticeMistakesPage() {
  return (
    <Suspense fallback={null}>
      <PracticeInner />
    </Suspense>
  );
}
