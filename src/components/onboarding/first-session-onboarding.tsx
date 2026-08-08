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
import { toastError } from "@/lib/toast";
import { Check, Loader2, Circle, Upload, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Upload-first onboarding for users who have never started a study session:
 * one dropzone, a "building your session" progress screen, then straight into
 * the generated session — workspaces and the dashboard come later.
 */

const SKIP_KEY = "scribe_first_session_onboarding_skip";

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

export function FirstSessionOnboarding({ onSkip }: { onSkip: () => void }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [phase, setPhase] = useState<"upload" | "building">("upload");
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const workspaceIdRef = useRef<string | null>(null);
  const [title, setTitle] = useState("My first session");
  const creatingSessionRef = useRef(false);
  const [analysisDone, setAnalysisDone] = useState(false);

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
            setAnalysisDone(true);
          }
        })
        .catch(() => {});
    }, 8000);
    return () => clearInterval(timer);
  }, [phase, analysisDone]);

  useEffect(() => {
    const workspaceId = workspaceIdRef.current;
    if (!analysisDone || !workspaceId || creatingSessionRef.current) return;
    creatingSessionRef.current = true;
    setStepIndex(3);
    createStudySession({
      workspaceId,
      title,
      depth: "moderate",
      durationMinutes: 30,
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

      const unsubscribe = subscribeAnalysisProgress(workspaceId, (progress) => {
        setStepIndex((current) =>
          Math.max(current, stepIndexFromProgress(progress)),
        );
        if (analysisComplete(progress)) {
          unsubscribe();
          setAnalysisDone(true);
        }
      });

      const fileIds = await uploadFiles(workspaceId, files);
      await analyzeFiles(workspaceId, fileIds);
    } catch (err) {
      startedRef.current = false;
      setPhase("upload");
      setError(toastError(err, "Upload failed"));
    }
  }, []);

  if (phase === "building") {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center animate-fade-up">
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
          <p className="mt-6 text-xs text-muted-foreground">
            This can take a couple of minutes for large files — hang tight.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="w-full max-w-lg text-center animate-fade-up">
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
            "mt-8 rounded-3xl border-2 border-dashed px-6 py-14 transition-colors",
            dragOver
              ? "border-accent bg-accent-soft/40"
              : "border-border-strong bg-card",
          )}
        >
          <Upload className="mx-auto h-8 w-8 text-accent" />
          <p className="mt-4 text-sm font-semibold">
            Drop your notes, slides, or PDF here
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 transition-opacity"
          >
            <Upload className="h-4 w-4" />
            Upload material
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.key,.txt,.md,audio/*"
            className="hidden"
            onChange={(e) => {
              start(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>

        {error && <p className="mt-3 text-xs text-rose">{error}</p>}

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
