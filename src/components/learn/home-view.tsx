"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/lib/api/auth";
import { createStudySession } from "@/lib/api/study";
import { uploadFiles, analyzeFiles } from "@/lib/api/materials";
import { startWorkspaceFromUploads, workspaceTitleFromFiles, fileBasename } from "@/lib/start-from-uploads";
import { UPLOAD_ACCEPT } from "@/lib/uploads";
import { emitTreeChanged } from "@/lib/tree-events";
import { toastError } from "@/lib/toast";
import { useDaypart } from "@/lib/use-daypart";
import type { Daypart } from "@/lib/daypart";
import type { HomeSummary } from "@/lib/home-action";
import { HomeBanner, HomeBannerError } from "@/components/learn/today-card";
import { SubjectsGrid } from "@/components/learn/subjects-grid";
import { StreakCard } from "@/components/learn/streak-card";
import { CourseShelf } from "@/components/courses/course-shelf";
import { Mascot } from "@/components/rewards/mascot";
import { useRewards, useStreak } from "@/lib/rewards";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import "@/lib/i18n/rewards";
import "@/app/design/design.css";

/** The same buckets as the banner's sky (src/lib/daypart.ts), so the words and the scene agree. */
const GREETING: Record<Daypart, string> = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
  night: "Good evening",
  late: "Up late",
};

/** Home's frame: the main column, and the rail beside it from lg up. */
const frame = "mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-12 pt-5 sm:px-6 sm:pt-6 lg:flex-row";

export function useGreeting(): string {
  const { user } = useAuthUser();
  const daypart = useDaypart();
  const firstName = user?.name?.trim().split(/\s+/)[0];
  return `${daypart ? GREETING[daypart] : "Hello"}${firstName ? `, ${firstName}` : ""}`;
}

/**
 * The signed-in home: the banner (greeting, the week's plan, today's one
 * action on today's day), the subjects and courses; beside them the rail
 * (due for review, the streak and its week, the cat and its points). On
 * phones the streak card and the cards-due / points tiles sit under the
 * banner instead of the rail.
 *
 * The action, the subject tiles and the due counts come from one
 * `home.summary` call, which the page waits for alone. The week, the streak,
 * the cat's points and the courses each load on their own and never hold
 * the action back.
 */
export function HomeView({ summary }: { summary: HomeSummary }) {
  const router = useRouter();
  const greeting = useGreeting();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  /** From home an upload is the first win: 5 questions on it, not a half-hour plan. */
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    setUploading(true);
    try {
      const target = summary.subjects[0]?.id;
      if (!target) {
        const created = await startWorkspaceFromUploads(list);
        router.push(created.session ? `/workspace/${created.workspaceId}/session/${created.session.id}` : `/workspace/${created.workspaceId}`);
        return;
      }
      const fileIds = await uploadFiles(target, list);
      analyzeFiles(target, fileIds).catch(() => {});
      emitTreeChanged();
      const session = await createStudySession({
        workspaceId: target,
        title: workspaceTitleFromFiles(list),
        depth: "light",
        durationMinutes: 5,
        quickStart: true,
        topics: list.map((f) => fileBasename(f.name)).filter(Boolean).join(", ").slice(0, 2000) || undefined,
      });
      router.push(session ? `/workspace/${target}/session/${session.id}` : `/workspace/${target}`);
    } catch (e) {
      toastError(e, "Upload failed");
      setUploading(false);
    }
  };

  // Nothing uploaded and never studied: home is the upload action and nothing else.
  const brandNew = summary.action.kind === "upload";
  return (
    <div className={frame}>
      <input ref={fileRef} type="file" multiple accept={UPLOAD_ACCEPT} className="hidden" onChange={(e) => void onFiles(e.target.files)} />
      <div className="flex min-w-0 flex-1 flex-col gap-4 sm:gap-5">
        <HomeBanner greeting={greeting} summary={summary} uploading={uploading} onUpload={() => fileRef.current?.click()} />
        {!brandNew && <PhoneStreak cards={summary.due.cards} />}
        {!brandNew && <SubjectsGrid subjects={summary.subjects} onNew={() => router.push("/new-subject")} />}
        {/* Courses from the course picker: a compact shelf (or one "pick a course" row) under the subjects. */}
        {!brandNew && <CourseShelf />}
      </div>
      {!brandNew && (
        <div className="rail-flat hidden w-full shrink-0 flex-col lg:flex lg:w-[300px]">
          <DueCard due={summary.due} action={summary.action} />
          <RailStreak />
          <HomeCatCard />
        </div>
      )}
    </div>
  );
}

function useShopSummary() {
  const { data: rewards } = useRewards();
  if (!rewards) return null;
  const affordable = rewards.catalog.some(
    (item) =>
      item.cost <= rewards.balance &&
      (item.slot === "freeze" ? rewards.freezes < rewards.maxFreezes : !rewards.owned.includes(item.id)),
  );
  return { balance: rewards.balance, affordable };
}

/** Phones: the streak card with the cards-due and points tiles under the banner (desktop has them in the rail). */
function PhoneStreak({ cards }: { cards: number }) {
  const { data: streak } = useStreak();
  const shop = useShopSummary();
  return <StreakCard streak={streak} due={cards} points={shop?.balance ?? 0} canAfford={!!shop?.affordable} tiles className="lg:hidden" />;
}

function RailStreak() {
  const { data: streak, isPending } = useStreak();
  if (isPending) return <div aria-hidden className="h-[132px] animate-pulse rounded-2xl bg-muted" />;
  return <StreakCard streak={streak} />;
}

/** Due for review, from `home.summary` (the review queue's counts): flashcards first, then what else is waiting. */
function DueCard({ due, action }: { due: HomeSummary["due"]; action: HomeSummary["action"] }) {
  const cards = due.cards;
  // Mistakes the banner's action already offers are not counted again here.
  const mistakes = action.kind === "mistakes" ? Math.max(0, due.mistakes - action.count) : due.mistakes;
  const also: string[] = [];
  if (due.questions > 0) also.push(`${due.questions} review question${due.questions === 1 ? "" : "s"}`);
  if (mistakes > 0) also.push(`${mistakes} mistake${mistakes === 1 ? "" : "s"} to fix`);
  return (
    <div className="life-card p-[18px]">
      <div className="text-[16px] font-extrabold">Due for review</div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-[40px] font-extrabold leading-none tabular-nums">{cards}</span>
        <div className="text-[13px] leading-snug text-muted-foreground">
          {cards ? `flashcards due today, about ${Math.max(1, Math.round(cards / 3))} min` : "No flashcards due right now"}
        </div>
      </div>
      {also.length > 0 && <p className="mt-2 text-[12.5px] font-semibold text-muted-foreground">Also {also.join(" · ")}</p>}
      <Link href="/flashcards/review" className="mt-3.5 inline-flex h-10 w-full items-center justify-center rounded-full bg-muted text-[14px] font-semibold hover:bg-accent-soft">
        {cards ? "Review now" : "Browse flashcards"}
      </Link>
    </div>
  );
}

/** The shop from home: the cat in its outfit, the points balance, one tap to spend them. */
function HomeCatCard() {
  const { t } = useI18n();
  const shop = useShopSummary();
  if (!shop) return null;
  return (
    <Link href="/shop" className="life-card life-press group flex items-center gap-3.5 p-3.5">
      <span className="grid size-[64px] shrink-0 place-items-end justify-center overflow-hidden rounded-full bg-muted">
        <Mascot pose="wave" className="cat-wiggle mb-0.5 h-[56px] w-[48px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-bold">{t("rewards.homeTitle")}</span>
          <span className="text-[12.5px] font-bold tabular-nums text-foreground">{t("rewards.ptsValue").replace("{n}", String(shop.balance))}</span>
        </span>
        <span className={cn("mt-0.5 block text-[12px] leading-snug", shop.affordable ? "font-semibold text-accent-dim" : "text-muted-foreground")}>
          {shop.affordable ? `${t("rewards.homeAfford")} →` : t("rewards.homeBody")}
        </span>
      </span>
    </Link>
  );
}

/** The summary failed: the banner says so with Retry; nothing on the page pretends there are no subjects. */
export function HomeError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const greeting = useGreeting();
  return (
    <div className={cn(frame, "lg:flex-col")}>
      <HomeBannerError greeting={greeting} onRetry={onRetry} retrying={retrying} />
    </div>
  );
}
