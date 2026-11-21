"use client";

import "@/lib/i18n/today";
import "@/lib/i18n/exam-planner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Mascot, type MascotPose } from "@/components/rewards/mascot";
import { createStudySession } from "@/lib/api/study";
import { useStartTask } from "@/components/planner/plan-task";
import { actionCopy, funnelKind, type HomeAction, type HomeSummary } from "@/lib/home-action";
import { track } from "@/lib/funnel";
import { toastError } from "@/lib/toast";
import { useI18n } from "@/lib/i18n";
import { useDaypart } from "@/lib/use-daypart";
import { cn } from "@/lib/utils";

/** Big enough for a thumb on a phone (≥ 44px); the page's one purple button. */
const primaryBtn =
  "btn-chunky rounded-[var(--r-button)] relative mt-5 inline-flex h-14 w-full items-center justify-center gap-2 bg-accent px-6 text-[17px] font-extrabold text-white hover:bg-accent-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 disabled:opacity-70 sm:w-auto sm:min-w-[240px]";

/** The cat's pose follows what the action asks for. */
const POSE: Record<Exclude<HomeAction["kind"], "upload">, MascotPose> = {
  mistakes: "think",
  plan: "pencil",
  continue: "book",
  next: "book",
  quick5: "book",
};
/** The banner: the colour of its scene's light (white by day, dark after dark), a hairline, the scene inside it. */
const shell = "hero-card life-rise relative isolate overflow-hidden rounded-[var(--r-panel)] border border-border px-5 pb-6 pt-[188px] sm:p-9";

/**
 * The banner's backdrop: an illustrated landscape lit for the student's own
 * time of day (tokens.css picks the file from <html data-daypart>), with the
 * cat on the knoll at its right in whatever outfit is equipped. Phones: a
 * strip across the top, text below; from sm up: full-bleed. The "Dress up"
 * pill opens the shop's outfits.
 */
function HeroScene({ pose, motion }: { pose: MascotPose; motion: string }) {
  const { t } = useI18n();
  return (
    <>
      <div aria-hidden className="hero-field pointer-events-none absolute inset-x-0 top-0 -z-10 h-[168px] overflow-hidden sm:inset-0 sm:h-auto">
        <div className="absolute bottom-[26px] right-[13%] h-[112px] sm:bottom-[15%] sm:right-[9%] sm:h-[184px] lg:right-[11%]">
          <span className="hero-field__ground" />
          <Mascot pose={pose} className={cn(motion, "h-full")} priority />
        </div>
      </div>
      <Link
        href="/shop#outfits"
        className="absolute left-1.5 top-1.5 z-10 flex min-h-11 items-center px-1.5 focus-visible:outline-none sm:bottom-1.5 sm:left-auto sm:right-2.5 sm:top-auto [&:focus-visible>span]:ring-2 [&:focus-visible>span]:ring-accent/50"
      >
        <span className="rounded-full bg-white/90 px-3 py-1.5 text-[12.5px] font-extrabold leading-none text-[#16161a] shadow-[0_1px_0_rgb(0_0_0/0.08)] transition-colors hover:bg-white">
          {t("today.dressUp")}
        </span>
      </Link>
    </>
  );
}

function Greeting({ greeting }: { greeting: string }) {
  return <h1 className="relative text-balance text-[28px] font-extrabold leading-[1.1] sm:max-w-[60%] sm:text-[36px]">{greeting}</h1>;
}

/** The summary failed: say so in the banner, with Retry as its one button. */
export function HomeBannerError({ greeting, onRetry, retrying }: { greeting: string; onRetry: () => void; retrying: boolean }) {
  const { t } = useI18n();
  return (
    <section className={shell} role="alert" aria-labelledby="today-title">
      <HeroScene pose="think" motion="cat-bob" />
      <Greeting greeting={greeting} />
      <h2 id="today-title" className="relative mt-5 text-[22px] font-extrabold leading-[1.2] sm:mt-7 sm:max-w-[440px] sm:text-[26px]">
        {t("today.loadError")}
      </h2>
      <p className="relative mt-1.5 text-[15px] leading-snug text-foreground/75 sm:max-w-[420px]">{t("today.loadErrorBody")}</p>
      <button type="button" disabled={retrying} onClick={onRetry} className={primaryBtn}>
        {retrying && <Loader2 className="size-5 animate-spin" />}
        {t("today.retry")}
      </button>
    </section>
  );
}

/**
 * Home's banner: the greeting, one sentence saying what to do now (and in
 * which subject, for how long) and one button. At most one quiet line under
 * it for what else is due. Nothing else competes here.
 */
export function HomeBanner({
  greeting,
  summary,
  uploading,
  onUpload,
}: {
  greeting: string;
  summary: HomeSummary;
  uploading: boolean;
  onUpload: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const daypart = useDaypart();
  const starter = useStartTask();
  const [busy, setBusy] = useState(false);
  const { action, due } = summary;

  const tapped = () => track("home.today_tapped", { action: funnelKind(action) }, ("workspaceId" in action && action.workspaceId) || undefined);

  if (action.kind === "upload") {
    return (
      <section className={shell} aria-labelledby="today-title">
        <HeroScene pose="wave" motion="cat-wiggle" />
        <Greeting greeting={greeting} />
        <div className="relative mt-5 sm:mt-7 sm:max-w-[460px]">
          <h2 id="today-title" className="text-balance text-[24px] font-extrabold leading-[1.15] sm:text-[28px]">
            {t("today.uploadTitle")}
          </h2>
          <p className="mt-2.5 text-[15.5px] leading-relaxed text-foreground/75">{t("today.uploadSub")}</p>
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => {
            tapped();
            onUpload();
          }}
          className={primaryBtn}
        >
          {uploading && <Loader2 className="size-5 animate-spin" />}
          {uploading ? t("today.uploading") : t("today.uploadCta")}
        </button>
      </section>
    );
  }

  const copy = actionCopy(action, t);

  const go = async () => {
    tapped();
    if (action.kind === "plan") return void starter.start(action.taskId);
    setBusy(true);
    if (action.kind !== "quick5") return router.push(action.href);
    try {
      const created = await createStudySession({
        workspaceId: action.workspaceId,
        title: action.subject || t("today.quick5Cta"),
        depth: "light",
        durationMinutes: 5,
        quickStart: true,
        // No notes yet (a topic-only subject): the subject name is the topic.
        topics: action.topics ?? undefined,
      });
      router.push(created ? `/workspace/${action.workspaceId}/session/${created.id}` : `/workspace/${action.workspaceId}`);
    } catch (e) {
      toastError(e, t("today.startFailed"));
      setBusy(false);
    }
  };
  const pending = busy || !!starter.startingId;

  // One quiet line for what else is due (the review queue minus what the action already covers).
  const moreMistakes = action.kind === "mistakes" ? due.mistakes - action.count : due.mistakes;
  const also: string[] = [];
  if (moreMistakes > 0) also.push(t(moreMistakes === 1 ? "home.alsoMistake" : "home.alsoMistakes").replace("{n}", String(moreMistakes)));
  if (due.questions > 0) also.push(t(due.questions === 1 ? "home.alsoQuestion" : "home.alsoQuestions").replace("{n}", String(due.questions)));
  if (due.cards > 0) also.push(t(due.cards === 1 ? "home.alsoCard" : "home.alsoCards").replace("{n}", String(due.cards)));
  const alsoHref =
    moreMistakes > 0 ? "/mistakes" : due.questions > 0 && due.questionsWorkspaceId ? `/workspace/${due.questionsWorkspaceId}` : "/flashcards/review";

  // In the small hours the cat is asleep on its feet.
  const pose = daypart === "late" ? "sleep" : POSE[action.kind];

  return (
    <section className={shell} aria-labelledby="today-title">
      <HeroScene pose={pose} motion="cat-peek" />
      <Greeting greeting={greeting} />
      <h2 id="today-title" className="relative mt-5 text-balance text-[22px] font-extrabold leading-[1.2] sm:mt-7 sm:max-w-[460px] sm:text-[27px]">
        {copy.title}
        <span className="whitespace-nowrap font-bold text-foreground/60"> — {copy.meta}</span>
      </h2>
      <button type="button" disabled={pending} onClick={() => void go()} className={primaryBtn}>
        {pending && <Loader2 className="size-5 animate-spin" />}
        {copy.cta}
      </button>
      {also.length > 0 && (
        <p className="relative mt-3 text-[14px] font-semibold text-foreground/70">
          {t("home.alsoDue").replace("{list}", also.join(" · "))}{" "}
          <Link href={alsoHref} className="font-bold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground">
            {t("home.review")}
          </Link>
        </p>
      )}
    </section>
  );
}
