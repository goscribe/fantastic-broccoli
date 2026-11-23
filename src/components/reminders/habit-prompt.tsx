"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Share, SquarePlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Mascot, type MascotPose } from "@/components/rewards/mascot";
import { StudyTimePicker } from "@/components/reminders/study-time-picker";
import { remindersApi, REMINDER_PREFS_KEY } from "@/lib/api/reminders";
import {
  DEFAULT_REMINDER_MINUTE,
  detectPlatform,
  formatStudyTime,
  habitSteps,
  isGoodSession,
  type HabitStep,
  type ReminderPrefs,
} from "@/lib/reminders";
import {
  enablePush,
  markDeviceSeen,
  promptInstall,
  readDeviceSeen,
  useCanInstall,
} from "@/lib/push-client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import "@/lib/i18n/reminders";
import { claimEndScreenAsk } from "@/lib/wall";
import { fetchStudyPlan, updateStudyPlan } from "@/lib/api/planner";
import { plannerWindowFromStudyTime } from "@/lib/reminders";

/**
 * Feeds the study time into the week planner: its study window starts at the
 * time the student gave, unless they already set their own window or free
 * times (only the server's untouched default is replaced). Best effort.
 */
async function syncPlannerWindow(minute: number): Promise<void> {
  try {
    const plan = await fetchStudyPlan();
    const win = plannerWindowFromStudyTime(plan, minute);
    if (!win) return;
    let timezone: string | undefined;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      timezone = undefined;
    }
    await updateStudyPlan({ ...win, ...(timezone ? { timezone } : {}) });
  } catch {
    // Old server or offline: the planner keeps its default window.
  }
}

/** Let the debrief's celebration land before asking anything. */
const SHOW_AFTER_MS = 1400;

/**
 * After a finished Quick 5: "When do you usually study?", then (once) the
 * push soft-ask before the browser's own prompt, or on iOS Safari the "Add to
 * Home Screen" hint (web push only works there once installed), or Chrome's
 * install offer. Each is shown once (see `habitSteps`); old servers without
 * the reminders API simply show nothing.
 */
export function HabitPrompt({
  sessionId,
  accuracy,
  activitiesDone,
  subjectTitle,
  showAfterMs = SHOW_AFTER_MS,
}: {
  /** The end screen this asks on: it holds that screen's one ask, so the subscribe wall never opens over it. */
  sessionId?: string;
  accuracy: number | null | undefined;
  activitiesDone: number;
  subjectTitle?: string;
  /** Wait longer when the debrief has more to read first (e.g. mastery gains). */
  showAfterMs?: number;
}) {
  const canInstall = useCanInstall();
  const { data: prefs } = useQuery({
    queryKey: REMINDER_PREFS_KEY,
    queryFn: remindersApi.get,
    retry: false,
    staleTime: 60_000,
  });
  const [steps, setSteps] = useState<HabitStep[] | null>(null);
  // Decided once per finished Quick 5; later changes (e.g. Chrome's install
  // event arriving) wait for the next one. `closed` keeps a refetch of the
  // prefs from opening the sheet again.
  const decided = useRef<HabitStep[] | null>(null);
  const closed = useRef(false);

  useEffect(() => {
    if (!prefs || activitiesDone <= 0 || closed.current) return;
    decided.current ??= habitSteps({
      prefs,
      platform: detectPlatform(canInstall),
      seen: readDeviceSeen(),
      goodSession: isGoodSession(accuracy, activitiesDone),
    });
    const planned = decided.current;
    if (planned.length === 0) return;
    const timer = window.setTimeout(() => {
      // One ask per end screen; the habit prompt goes first.
      if (sessionId && !claimEndScreenAsk(sessionId, "habit")) return;
      setSteps(planned);
    }, showAfterMs);
    return () => window.clearTimeout(timer);
  }, [prefs, canInstall, accuracy, activitiesDone, showAfterMs, sessionId]);

  if (!prefs || !steps || steps.length === 0) return null;
  return (
    <HabitSheet
      prefs={prefs}
      steps={steps}
      subjectTitle={subjectTitle}
      onDone={() => {
        closed.current = true;
        setSteps([]);
      }}
    />
  );
}

/** The sheet: one step at a time, "not now" on Escape, a tap outside or the X. */
export function HabitSheet({
  prefs,
  steps,
  subjectTitle,
  onDone,
}: {
  prefs: ReminderPrefs;
  steps: HabitStep[];
  subjectTitle?: string;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [minute, setMinute] = useState<number | null>(prefs.studyReminderMinute);
  const step = steps[index];

  const next = () => (index + 1 < steps.length ? setIndex(index + 1) : onDone());

  const update = (p: ReminderPrefs) => queryClient.setQueryData(REMINDER_PREFS_KEY, p);
  const shownMinute = minute ?? prefs.studyReminderMinute ?? DEFAULT_REMINDER_MINUTE;

  /** The step's "not now": remembered so it isn't asked again, then on to the next. */
  const dismiss = () => {
    if (step === "study_time" || step === "push") {
      void remindersApi.markAsked(step).catch(() => undefined);
    } else if (step === "ios_install") {
      markDeviceSeen("iosInstallHint");
    } else if (step === "android_install") {
      markDeviceSeen("androidInstall");
    }
    next();
  };

  // Escape = "not now".
  const dismissRef = useRef(dismiss);
  useEffect(() => {
    dismissRef.current = dismiss;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!step) return null;

  let body: ReactNode;
  if (step === "study_time") {
    body = (
      <StudyTimeStep
        minute={minute}
        setMinute={setMinute}
        onSkip={dismiss}
        onSave={async () => {
          if (minute === null) return;
          try {
            update(await remindersApi.setStudyTime(minute));
          } catch {
            // Old server or offline: the default time still applies.
          }
          // The one "when do you study" answer also places the planner's study window.
          void syncPlannerWindow(minute);
          next();
        }}
      />
    );
  } else if (step === "push") {
    body = (
      <PushStep
        minute={shownMinute}
        subjectTitle={subjectTitle}
        onSkip={dismiss}
        onEnable={async () => {
          const result = await enablePush(prefs.vapidPublicKey ?? "");
          void remindersApi.markAsked("push").catch(() => undefined);
          void queryClient.invalidateQueries({ queryKey: REMINDER_PREFS_KEY });
          return result;
        }}
        onFinished={next}
      />
    );
  } else if (step === "ios_install") {
    body = <IosInstallStep onDone={dismiss} />;
  } else {
    body = (
      <AndroidInstallStep
        onSkip={dismiss}
        onInstall={async () => {
          markDeviceSeen("androidInstall");
          await promptInstall();
          next();
        }}
      />
    );
  }

  // Portalled: the debrief animates with a transform, which would trap a fixed overlay inside it.
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/30 sm:items-center sm:p-4"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="habit-sheet-title"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[28px] border border-border bg-card px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-xl animate-fade-up",
          "sm:rounded-[28px] sm:px-6 sm:pb-6 sm:pt-5",
        )}
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border sm:hidden" aria-hidden />
        <button
          type="button"
          onClick={dismiss}
          aria-label={t(step === "ios_install" ? "remind.gotIt" : "remind.notNow")}
          className="absolute right-3.5 top-3.5 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
        {steps.length > 1 && (
          <div className="mb-1 flex justify-center gap-1.5" aria-hidden>
            {steps.map((s, i) => (
              <span key={s} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-accent" : "w-1.5 bg-border")} />
            ))}
          </div>
        )}
        {body}
      </div>
    </div>,
    document.body,
  );
}

function StepHeader({ pose, title, sub }: { pose: MascotPose; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <Mascot pose={pose} className="h-[64px] sm:h-[84px]" />
      <h2 id="habit-sheet-title" className="mt-2 text-[20px] font-bold leading-tight tracking-tight sm:text-[21px]">
        {title}
      </h2>
      <p className="mt-1.5 max-w-[22rem] text-[14px] leading-snug text-muted-foreground">{sub}</p>
    </div>
  );
}

function StudyTimeStep({
  minute,
  setMinute,
  onSkip,
  onSave,
}: {
  minute: number | null;
  setMinute: (m: number) => void;
  onSkip: () => void;
  onSave: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  return (
    <>
      <StepHeader pose="wave" title={t("remind.studyTitle")} sub={t("remind.studySub")} />
      <StudyTimePicker value={minute} onChange={setMinute} className="mt-4" />
      <div className="mt-4 space-y-0.5">
        <Button
          size="lg"
          className="w-full text-[15px]"
          disabled={minute === null || saving}
          onClick={async () => {
            setSaving(true);
            await onSave();
            setSaving(false);
          }}
        >
          {t("remind.continue")}
        </Button>
        <Button size="lg" variant="ghost" className="w-full" onClick={onSkip}>
          {t("remind.skip")}
        </Button>
      </div>
    </>
  );
}

function PushStep({
  minute,
  subjectTitle,
  onSkip,
  onEnable,
  onFinished,
}: {
  minute: number;
  subjectTitle?: string;
  onSkip: () => void;
  onEnable: () => Promise<"granted" | "denied" | "failed">;
  onFinished: () => void;
}) {
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState(false);
  const time = formatStudyTime(minute, locale);
  const topic = subjectTitle?.trim();
  return (
    <>
      <StepHeader pose="flame" title={t("remind.pushTitle").replace("{time}", time)} sub={t("remind.pushSub").replace("{time}", time)} />

      {/* What it will look like: one calm notification, not a feed. */}
      <div className="mt-5 rounded-2xl bg-muted/70 p-3" aria-hidden>
        <div className="flex items-start gap-3 rounded-xl bg-card p-3 shadow-sm">
          <Image src="/icons/hp-maskable-192.png" alt="" width={36} height={36} className="size-9 shrink-0 rounded-[10px] border border-border" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
              <span className="font-semibold uppercase tracking-wide">Scribe</span>
              <span>{time}</span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-[13.5px] font-semibold leading-5">
              {topic ? t("remind.previewTitle").replace("{topic}", topic) : t("remind.previewTitleNoTopic")}
            </p>
            <p className="text-[12.5px] leading-5 text-muted-foreground">{t("remind.previewBody")}</p>
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-2 text-[14px]">
        {(["remind.pushPoint1", "remind.pushPoint2", "remind.pushPoint3"] as const).map((k) => (
          <li key={k} className="flex items-center gap-2.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            {t(k)}
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-1">
        <Button
          size="lg"
          className="w-full text-[15px]"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const result = await onEnable();
            setBusy(false);
            if (result === "granted") toast.success(t("remind.pushOn"));
            else if (result === "denied") toast(t("remind.pushDenied"));
            else toast(t("remind.pushFailed"));
            onFinished();
          }}
        >
          <Bell className="mr-2 size-4" />
          {t("remind.pushCta")}
        </Button>
        <Button size="lg" variant="ghost" className="w-full" onClick={onSkip}>
          {t("remind.notNow")}
        </Button>
      </div>
      <p className="mt-1 text-center text-[12px] text-muted-foreground">{t("remind.pushNext")}</p>
    </>
  );
}

function IosInstallStep({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const steps: Array<{ key: string; icon: ReactNode }> = [
    { key: "remind.iosStep1", icon: <Share className="size-[18px] text-[#007aff]" /> },
    { key: "remind.iosStep2", icon: <SquarePlus className="size-[18px]" /> },
    { key: "remind.iosStep3", icon: <Image src="/icons/hp-maskable-192.png" alt="" width={22} height={22} className="rounded-[6px]" /> },
  ];
  return (
    <>
      <StepHeader pose="book" title={t("remind.iosTitle")} sub={t("remind.iosSub")} />
      <ol className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {steps.map((s, i) => (
          <li key={s.key} className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-accent-dim">
              {i + 1}
            </span>
            <span className="flex-1 text-[14.5px] font-medium leading-5">{t(s.key)}</span>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">{s.icon}</span>
          </li>
        ))}
      </ol>
      <Button size="lg" className="mt-5 w-full text-[15px]" onClick={onDone}>
        {t("remind.gotIt")}
      </Button>
      {/* Safari's Share button sits in the bottom toolbar on iPhone. */}
      <div className="mt-3 flex justify-center sm:hidden" aria-hidden>
        <span className="h-0 w-0 border-x-[9px] border-t-[10px] border-x-transparent border-t-accent animate-bounce" />
      </div>
    </>
  );
}

function AndroidInstallStep({ onSkip, onInstall }: { onSkip: () => void; onInstall: () => Promise<void> }) {
  const { t } = useI18n();
  return (
    <>
      <StepHeader pose="cheer" title={t("remind.installTitle")} sub={t("remind.installSub")} />
      <div className="mt-5 flex justify-center" aria-hidden>
        <Image src="/icons/hp-maskable-192.png" alt="" width={72} height={72} className="size-[72px] rounded-[20px] border border-border shadow-sm" />
      </div>
      <div className="mt-5 space-y-1">
        <Button size="lg" className="w-full text-[15px]" onClick={() => void onInstall()}>
          {t("remind.installCta")}
        </Button>
        <Button size="lg" variant="ghost" className="w-full" onClick={onSkip}>
          {t("remind.notNow")}
        </Button>
      </div>
    </>
  );
}
