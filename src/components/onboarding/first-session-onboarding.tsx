"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createWorkspace, fetchWorkspace } from "@/lib/api/workspace";
import {
  analyzeFiles,
  subscribeAnalysisProgress,
  uploadFiles,
  type AnalysisProgress,
} from "@/lib/api/materials";
import { createStudySession } from "@/lib/api/study";
import { refreshSession, resendVerification, useAuthUser } from "@/lib/api/auth";
import {
  fetchPlanOptions,
  switchPlan,
  type PlanOption,
} from "@/lib/api/account";
import { toastError } from "@/lib/toast";
import {
  Check,
  Loader2,
  Circle,
  Upload,
  Camera,
  Sparkles,
  MailCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UPLOAD_ACCEPT } from "@/lib/uploads";
import {
  CURRICULUM_PRESETS,
  type CurriculumPreset,
} from "./curriculum-presets";
import { WarmupQuiz } from "./warmup-quiz";

/**
 * Upload-first onboarding for users who have never started a study session:
 * one dropzone, a "building your session" progress screen, then straight into
 * the generated session — workspaces and the dashboard come later.
 */

const SKIP_KEY = "scribe_first_session_onboarding_skip";
const PENDING_KEY = "scribe_first_session_onboarding_pending";

type PendingBuild = { workspaceId: string; title: string };

function readPendingBuild(): PendingBuild | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingBuild>;
    if (typeof parsed.workspaceId !== "string") return null;
    return {
      workspaceId: parsed.workspaceId,
      title: typeof parsed.title === "string" ? parsed.title : "My first session",
    };
  } catch {
    return null;
  }
}

function writePendingBuild(pending: PendingBuild | null): void {
  try {
    if (pending) localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* private mode */
  }
}

export function hasSkippedFirstSessionOnboarding(): boolean {
  try {
    return localStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
}

export function markFirstSessionOnboardingSkipped(): void {
  try {
    localStorage.setItem(SKIP_KEY, "1");
  } catch {
    /* private mode */
  }
}

const BUILD_STEPS = [
  "Reading your material",
  "Finding key concepts",
  "Creating practice questions",
  "Building your study plan",
] as const;

/** Maps live analysis-pipeline progress onto the four display steps. */
function stepIndexFromProgress(progress: AnalysisProgress | null): number {
  const steps = progress?.steps;
  if (!steps) return 0;
  const done = (key: string) => {
    const s = steps[key];
    return !s || s.status === "completed" || s.status === "skipped";
  };
  if (!done("transcription") || !done("parsing") || !done("fileUpload")) return 0;
  if (!done("generation")) return 1;
  if (!done("worksheetBank") || !done("figureExtraction")) return 2;
  return 3;
}

function analysisComplete(progress: AnalysisProgress | null): boolean {
  const steps = Object.values(progress?.steps ?? {});
  return (
    steps.length > 0 &&
    steps.every((s) => s.status === "completed" || s.status === "skipped")
  );
}

function fileBasename(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

/** Paid-plan pitch shown while the first session builds: upgrading here means
 * more tokens from day one. */
function PlanUpsell() {
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    fetchPlanOptions()
      .then((all) => setPlans(all.filter((p) => p.priceDollars > 0)))
      .catch(() => {});
  }, []);

  if (plans.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-accent/25 bg-accent-soft/30 p-4 text-left">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold">
        <Zap className="h-3.5 w-3.5 text-accent" />
        Study more with a Scribe plan
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        More monthly tokens for study sessions, flashcards, and worksheets —
        starting from day one.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            disabled={upgrading !== null}
            onClick={() => {
              setUpgrading(plan.id);
              switchPlan(plan.id).catch((err) => {
                setUpgrading(null);
                toastError(err, "Could not start checkout");
              });
            }}
            className="rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-accent disabled:opacity-60"
          >
            <span className="flex items-center justify-between text-[13px] font-semibold capitalize">
              {plan.name}
              {upgrading === plan.id && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
              )}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              ${plan.priceDollars}/mo · {plan.monthlyTokens} tokens
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function FirstSessionOnboarding({ onSkip }: { onSkip: () => void }) {
  const router = useRouter();
  const { user } = useAuthUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">(
    "idle",
  );
  const [dragOver, setDragOver] = useState(false);
  // Resume an in-progress build after a reload: the workspace/upload survive
  // server-side, so rejoin the "building" screen instead of starting over.
  const [pending] = useState(readPendingBuild);
  const [phase, setPhase] = useState<"upload" | "building">(
    pending ? "building" : "upload",
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(!!pending);

  const workspaceIdRef = useRef<string | null>(pending?.workspaceId ?? null);
  // Mirrors workspaceIdRef for render use (the warm-up quiz needs it).
  const [warmupWorkspaceId, setWarmupWorkspaceId] = useState<string | null>(
    pending?.workspaceId ?? null,
  );
  const [title, setTitle] = useState(pending?.title ?? "My first session");
  const creatingSessionRef = useRef(false);
  const [analysisDone, setAnalysisDone] = useState(false);
  /** False when every uploaded file failed analysis — nothing to plan from. */
  const anyMaterialAnalyzedRef = useRef(true);

  // Fallback for missing/unreliable Pusher config: poll the workspace until
  // every uploaded material is analyzed.
  useEffect(() => {
    if (phase !== "building" || analysisDone) return;
    const timer = setInterval(() => {
      const workspaceId = workspaceIdRef.current;
      if (!workspaceId) return;
      fetchWorkspace(workspaceId)
        .then((ws) => {
          const materials = ws?.materials ?? [];
          if (
            materials.length > 0 &&
            materials.every(
              (m) => m.analyzed || m.analysisStatus === "FAILED",
            )
          ) {
            anyMaterialAnalyzedRef.current = materials.some((m) => m.analyzed);
            setAnalysisDone(true);
          }
        })
        .catch(() => {});
    }, 8000);
    return () => clearInterval(timer);
  }, [phase, analysisDone]);

  // Live progress subscription (covers both fresh starts and resumes).
  useEffect(() => {
    if (phase !== "building" || analysisDone) return;
    const workspaceId = workspaceIdRef.current;
    if (!workspaceId) return;
    const unsubscribe = subscribeAnalysisProgress(workspaceId, (progress) => {
      setStepIndex((current) =>
        Math.max(current, stepIndexFromProgress(progress)),
      );
      if (analysisComplete(progress)) setAnalysisDone(true);
    });
    return unsubscribe;
  }, [phase, analysisDone]);

  useEffect(() => {
    const workspaceId = workspaceIdRef.current;
    if (!analysisDone || !workspaceId || creatingSessionRef.current) return;
    creatingSessionRef.current = true;
    setStepIndex(3);
    writePendingBuild(null);
    createStudySession({
      workspaceId,
      title,
      depth: "moderate",
      durationMinutes: 30,
      // Nothing was readable, so give the planner the title to work from
      // rather than failing with "no analyzed materials".
      ...(anyMaterialAnalyzedRef.current ? {} : { topics: title }),
    })
      .then((session) => {
        if (session) {
          router.push(`/workspace/${workspaceId}/session/${session.id}`);
        } else {
          router.push(`/workspace/${workspaceId}/study`);
        }
      })
      .catch((err) => {
        toastError(err, "Could not create your session");
        router.push(`/workspace/${workspaceId}/study`);
      });
  }, [analysisDone, router, title]);

  const [preset, setPreset] = useState<CurriculumPreset | null>(null);

  // Curriculum path: two taps (curriculum → subject) and the planner builds a
  // session from the subject + exam board alone — no upload needed.
  const startFromPreset = useCallback(
    async (chosen: CurriculumPreset, subject: string) => {
      if (startedRef.current) return;
      startedRef.current = true;
      setError(null);
      setPhase("building");
      setStepIndex(3);
      const sessionTitle = `${chosen.label} ${subject}`;
      setTitle(sessionTitle);
      try {
        const workspaceId = await createWorkspace(sessionTitle);
        if (!workspaceId) throw new Error("Could not create a workspace");
        workspaceIdRef.current = workspaceId;
        setWarmupWorkspaceId(workspaceId);
        const session = await createStudySession({
          workspaceId,
          title: sessionTitle,
          depth: "moderate",
          durationMinutes: 30,
          subject,
          examBoard: chosen.board,
        });
        if (session) {
          router.push(`/workspace/${workspaceId}/session/${session.id}`);
        } else {
          router.push(`/workspace/${workspaceId}/study`);
        }
      } catch (err) {
        startedRef.current = false;
        setPhase("upload");
        setError(toastError(err, "Could not create your session"));
      }
    },
    [router],
  );

  const start = useCallback(async (files: File[]) => {
    if (files.length === 0 || startedRef.current) return;
    startedRef.current = true;
    setError(null);
    setPhase("building");
    setStepIndex(0);
    try {
      const sessionTitle = fileBasename(files[0].name) || "My study space";
      setTitle(sessionTitle);
      const workspaceId = await createWorkspace(sessionTitle);
      if (!workspaceId) throw new Error("Could not create a workspace");
      workspaceIdRef.current = workspaceId;
      setWarmupWorkspaceId(workspaceId);

      const fileIds = await uploadFiles(workspaceId, files);
      await analyzeFiles(workspaceId, fileIds);
      writePendingBuild({ workspaceId, title: sessionTitle });
    } catch (err) {
      startedRef.current = false;
      setPhase("upload");
      writePendingBuild(null);
      setError(toastError(err, "Upload failed"));
    }
  }, []);

  if (phase === "building") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center animate-fade-up">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Building your study session…
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{title}</p>
          <div className="mt-8 space-y-3 text-left">
            {BUILD_STEPS.map((label, i) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3",
                  i < stepIndex
                    ? "border-accent/25 bg-accent-soft/40"
                    : i === stepIndex
                      ? "border-border bg-card"
                      : "border-border/60 bg-card/50",
                )}
              >
                {i < stepIndex ? (
                  <Check className="h-4 w-4 text-accent shrink-0" />
                ) : i === stepIndex ? (
                  <Loader2 className="h-4 w-4 animate-spin text-accent shrink-0" />
                ) : (
                  <Circle className="h-3 w-3 text-faint shrink-0" />
                )}
                <span
                  className={cn(
                    "text-sm font-medium",
                    i > stepIndex && "text-faint",
                  )}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
          {warmupWorkspaceId && <WarmupQuiz workspaceId={warmupWorkspaceId} />}
          <PlanUpsell />
          <p className="mt-6 text-xs text-muted-foreground">
            This can take a couple of minutes for large files — hang tight.
          </p>
        </div>
      </div>
    );
  }

  // Unverified users get their first study session for free (the server
  // allows generation until they own one), so this screen only nudges them
  // to verify instead of blocking the upload.
  const unverified = user?.emailVerified === false;

  if (preset) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-center animate-fade-up">
          <button
            type="button"
            onClick={() => setPreset(null)}
            className="float-left text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
          <p className="text-xs font-semibold text-accent">{preset.label}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            Pick a subject
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            One tap — Scribe builds your first {preset.label} study session
            around it.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            {preset.subjects.map((subject) => (
              <button
                key={subject}
                type="button"
                onClick={() => startFromPreset(preset, subject)}
                className="rounded-xl border border-border bg-card px-3 py-3 text-sm font-medium hover:border-accent hover:bg-accent-soft/40 transition-colors"
              >
                {subject}
              </button>
            ))}
          </div>
          {error && <p className="mt-3 text-xs text-rose">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-center animate-fade-up">
        <p className="text-xs font-semibold text-accent">Welcome to Scribe</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          What are you studying?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Scribe will turn it into a personalized study session.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            start(Array.from(e.dataTransfer.files));
          }}
          className={cn(
            "mt-6 rounded-2xl border-2 border-dashed px-6 py-10 transition-colors",
            dragOver
              ? "border-accent bg-accent-soft/40"
              : "border-border-strong bg-card",
          )}
        >
          <Upload className="mx-auto h-8 w-8 text-accent" />
          <p className="mt-4 text-sm font-semibold">
            Drop your notes, slides, PDF, or a photo here
          </p>
          <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90 transition-opacity sm:hidden"
            >
              <Camera className="h-4 w-4" />
              Take a photo of your notes
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold hover:border-accent/40 transition-colors sm:border-0 sm:bg-accent sm:py-2.5 sm:text-accent-foreground sm:hover:opacity-90"
            >
              <Upload className="h-4 w-4" />
              Upload material
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={UPLOAD_ACCEPT}
            className="hidden"
            onChange={(e) => {
              start(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              start(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-medium text-muted-foreground">
            or start from your curriculum
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {CURRICULUM_PRESETS.map((p) => (
            <button
              key={p.board}
              type="button"
              onClick={() => setPreset(p)}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent hover:bg-accent-soft/40 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-xs text-rose">{error}</p>}

        {unverified && (
          <div className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-left">
            <p className="flex items-center gap-2 text-xs font-semibold">
              <MailCheck className="h-3.5 w-3.5 text-accent" />
              Your first session is free
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Verify{" "}
              <span className="font-medium text-foreground">
                {user?.email ?? "your email"}
              </span>{" "}
              to keep generating after this one.
            </p>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => refreshSession().catch(() => {})}
                className="text-xs font-semibold text-accent hover:underline"
              >
                I&apos;ve verified
              </button>
              <button
                type="button"
                disabled={resendState !== "idle"}
                onClick={() => {
                  setResendState("sending");
                  resendVerification()
                    .then(() => setResendState("sent"))
                    .catch((err) => {
                      setResendState("idle");
                      toastError(err, "Could not resend the email");
                    });
                }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
              >
                {resendState === "sent"
                  ? "Email sent — check your inbox"
                  : resendState === "sending"
                    ? "Sending…"
                    : "Resend verification email"}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onSkip}
          className="mt-6 text-xs font-medium text-faint hover:text-foreground"
        >
          Skip for now — take me to my dashboard
        </button>
      </div>
    </div>
  );
}
