"use client";

import "@/lib/i18n/flashcards";
import { ShareItemButton } from "@/components/growth/share-item-button";
import Image from "next/image";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { WaitScreen } from "@/components/ui/wait-screen";
import { MathText } from "@/components/ui/markdown-text";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchDeckProgress,
  startFlashcardTest,
  studySessionApi,
} from "@/lib/api/study-session";
import { toastError } from "@/lib/toast";
import { createStudySession } from "@/lib/api/study";
import { Button } from "@/components/ui/button";
import { deckEntries } from "@/components/bank/bank-content";
import { DeckCardsView } from "@/components/flashcards/deck-cards-view";
import { DeckLearnView } from "@/components/flashcards/deck-learn-view";
import { DeckTestView } from "@/components/flashcards/deck-test-view";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { ArrowLeft } from "lucide-react";
import { chooseStudyLength } from "@/lib/study-length-client";

type DeckMode = "cards" | "learn" | "test";

const MODES: { id: DeckMode; labelKey: TranslationKey }[] = [
  { id: "cards", labelKey: "fc.modeCards" },
  { id: "learn", labelKey: "fc.modeLearn" },
  { id: "test", labelKey: "fc.modeTest" },
];

function FlashcardDeck() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const deckId = params.id as string;
  const workspaceId = searchParams.get("ws") ?? "";

  const { data: items, isLoading } = useQuery({
    queryKey: ["bank", workspaceId],
    queryFn: () => studySessionApi.listBank({ workspaceId }),
    enabled: !!workspaceId,
  });

  const item = items?.find((i) => i.id === deckId);
  const deck = useMemo(() => (item ? deckEntries(item) : null), [item]);

  const hasPooledCards = !!deck?.entries.some((e) => e.flashcardId);
  const { data: progress, refetch: refetchProgress } = useQuery({
    queryKey: ["deck-progress", deckId],
    queryFn: () => fetchDeckProgress(deckId),
    enabled: hasPooledCards,
  });

  const masteredCount = useMemo(
    () =>
      (progress ?? []).filter(
        (p) => (p.progress?.masteryLevel ?? 0) >= 80,
      ).length,
    [progress],
  );

  const requestedMode = searchParams.get("mode");
  const [mode, setMode] = useState<DeckMode>(
    requestedMode === "learn" ? "learn" : "cards",
  );

  // Test mode is opened server-side so the free-plan test cap is enforced.
  const openTest = useMutation({
    mutationFn: () => startFlashcardTest(deckId),
    onSuccess: () => setMode("test"),
    onError: (err) => toastError(err, t("fc.startSessionError")),
  });
  const selectMode = (next: DeckMode) => {
    if (next === "test") {
      if (mode !== "test" && !openTest.isPending) openTest.mutate();
      return;
    }
    setMode(next);
  };
  const autoOpenedTest = useRef(false);
  useEffect(() => {
    if (requestedMode !== "test" || !item || autoOpenedTest.current) return;
    autoOpenedTest.current = true;
    openTest.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedMode, item?.id]);

  const startSession = useMutation({
    mutationFn: async () =>
      createStudySession(
        await chooseStudyLength({
          workspaceId,
          title: item!.title,
          depth: "moderate" as const,
          durationMinutes: 30,
          topics: item!.topic ?? item!.title,
        }),
      ),
    onSuccess: (session) => {
      if (session) {
        router.push(`/workspace/${workspaceId}/session/${session.id}`);
      }
    },
    onError: (err) => toastError(err, t("fc.startSessionError")),
  });

  const qc = useQueryClient();
  const deckEmpty = !item || !deck || deck.entries.length === 0;
  const { data: gen } = useQuery({
    queryKey: ["fc-generating", workspaceId],
    queryFn: () => studySessionApi.flashcardsGenerating(workspaceId),
    enabled: !!workspaceId && deckEmpty,
    refetchInterval: (q) => (q.state.data?.generating ? 2500 : false),
  });
  const wasGenerating = useRef(false);
  useEffect(() => {
    if (gen?.generating) wasGenerating.current = true;
    else if (wasGenerating.current) {
      wasGenerating.current = false;
      void qc.invalidateQueries({ queryKey: ["bank", workspaceId] });
    }
  }, [gen?.generating, qc, workspaceId]);

  if (isLoading) {
    return (
      <div className="w-full max-w-3xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-[380px] w-full rounded-3xl" />
      </div>
    );
  }

  if (deckEmpty && gen?.generating) {
    return (
      <WaitScreen
        pose="book"
        title="Your flashcards"
        status={gen.metadata?.quantity ? `Writing ${gen.metadata.quantity} cards from your material` : "Writing cards from your material"}
        time="About a minute. The deck opens here by itself."
      />
    );
  }

  if (!item || !deck || deck.entries.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-12 text-center">
        <Image src="/design/cat3-think.webp" alt="" width={383} height={400} unoptimized className="pointer-events-none mx-auto h-24 w-auto select-none" />
        <p className="mt-3 text-sm font-medium">
          {t(item ? "fc.emptyDeck" : "fc.deckNotFound")}
        </p>
        <Link
          href="/flashcards"
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("fc.backToFlashcards")}
        </Link>
      </div>
    );
  }

  const cardCount = deck.entries.length;

  return (
    <div className="w-full max-w-3xl space-y-6">
      <PageHeader
        back={{ href: "/flashcards", label: t("fc.backToFlashcards") }}
        title={<MathText text={item.title} />}
        subtitle={
          <>
            {cardCount} {t(cardCount === 1 ? "fc.card" : "fc.cards")}
            {item.topic && <> · {item.topic}</>}
            {hasPooledCards && progress && <> · {t("fc.masteredCount").replace("{count}", String(masteredCount))}</>}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ShareItemButton artifactId={item.id} kind={item.kind} title={item.title} />
            <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            {MODES.map(({ id, labelKey }) => (
              <button
                key={id}
                type="button"
                onClick={() => selectMode(id)}
                disabled={id === "test" && openTest.isPending}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-small font-semibold transition-colors",
                  mode === id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(labelKey)}
              </button>
            ))}
            </div>
            <Button
              size="sm"
              onClick={() => startSession.mutate()}
              disabled={startSession.isPending}
            >
              {t(startSession.isPending ? "fc.starting" : "fc.study")}
            </Button>
          </div>
        }
      />

      {mode === "cards" && (
        <DeckCardsView
          entries={deck.entries}
          frontLabel={deck.frontLabel}
          backLabel={deck.backLabel}
        />
      )}
      {mode === "learn" && (
        <DeckLearnView
          entries={deck.entries}
          frontLabel={deck.frontLabel}
          backLabel={deck.backLabel}
          progress={progress}
          onAttemptRecorded={() => refetchProgress()}
        />
      )}
      {mode === "test" && (
        <DeckTestView
          entries={deck.entries}
          frontLabel={deck.frontLabel}
          backLabel={deck.backLabel}
          onAttemptRecorded={() => refetchProgress()}
        />
      )}
    </div>
  );
}

export default function FlashcardDeckPage() {
  return (
    <PageShell max="max-w-none">
      <Suspense fallback={null}>
        <FlashcardDeck />
      </Suspense>
    </PageShell>
  );
}
