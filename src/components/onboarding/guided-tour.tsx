"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { EventData, Step, TooltipRenderProps } from "react-joyride";
import { Button } from "@/components/ui/button";
import {
  markGuidedTourCompleted,
  type GuidedTourPhase,
} from "@/lib/onboarding";

const TOUR_EVENT = "scribe:start-guided-tour";

/** Starts the guided tour for the current route (wired to the "?" button). */
export function requestGuidedTour(): void {
  window.dispatchEvent(new Event(TOUR_EVENT));
}

/** Whether the current route has a guided tour available. */
export function hasGuidedTourForPath(pathname: string): boolean {
  return phasesForPath(pathname).length > 0;
}

const Joyride = dynamic(
  () => import("react-joyride").then((m) => m.Joyride),
  { ssr: false },
);

const homeSteps: Step[] = [
  {
    target: '[data-tour="home-banner"]',
    title: "Start a study session",
    content:
      "Everything starts here — describe what you're studying and Scribe plans a full session with readings, flashcards, worksheets, and quizzes.",
    placement: "bottom",
  },
  {
    target: '[data-tour="workspace-tree"]',
    title: "Your workspaces",
    content:
      "Each course or topic lives in a workspace. Organize them into folders and jump between them from here.",
    placement: "right",
  },
  {
    target: '[data-tour="sidebar-search"]',
    title: "Find anything fast",
    content:
      "Search all your workspaces and folders. You can also press ⌘K (Ctrl+K) from anywhere.",
    placement: "right",
  },
  {
    target: '[data-tour="sidebar-footer"]',
    title: "Tokens, storage & settings",
    content:
      "Generating content uses monthly tokens — keep an eye on your balance here. Settings and your account live here too.",
    placement: "right-end",
  },
  {
    target: '[data-tour="new-workspace"]',
    title: "Create your first workspace",
    content:
      "This is your next step: create a workspace for a course or topic. Open it and we'll show you how to upload materials and start a study session.",
    placement: "right",
  },
];

const studySteps: Step[] = [
  {
    target: '[data-tour="workspace-tabs"]',
    title: "Inside a workspace",
    content:
      "Everything for this course lives in these tabs — your materials, study sessions, artifact bank, study guide, and podcast-style recall.",
    placement: "bottom",
  },
  {
    target: '[data-tour="tab-materials"]',
    title: "Add your materials first",
    content:
      "Head to Materials to upload PDFs, slides, or lecture recordings. Scribe analyzes them and uses them to build everything else.",
    placement: "bottom",
  },
  {
    target: '[data-tour="new-session"]',
    title: "Create a study session",
    content:
      "Once your materials are in, create a session — tell Scribe what to cover and it plans readings, quizzes, and comprehension checks for you.",
    placement: "bottom",
  },
];

const materialsSteps: Step[] = [
  {
    target: '[data-tour="upload-materials"]',
    title: "Add your first material",
    content:
      "Go ahead — click Upload files and pick a PDF, slides, or an audio file, or hit Record audio to capture a lecture live. The buttons work while this tour is open.",
    placement: "bottom",
  },
  {
    target: '[data-tour="tab-study"]',
    title: "Then start studying",
    content:
      "Once your materials are analyzed, head to the Study tab and create your first study session from them.",
    placement: "bottom",
  },
];

const analysisSteps: Step[] = [
  {
    target: '[data-tour="analysis-status"]',
    title: "Scribe is reading your material",
    content:
      "Your upload is being transcribed, parsed, and turned into a knowledge base with a precomputed bank of questions. You can keep working while it runs.",
    placement: "bottom",
  },
  {
    target: '[data-tour="tab-study"]',
    title: "Next: create a study session",
    content:
      "When the analysis finishes, open the Study tab and create a session built from this material.",
    placement: "bottom",
  },
];

const wizardSteps: Step[] = [
  {
    target: '[data-tour="session-wizard"]',
    title: "Describe your session",
    content:
      "Give the session a title and any topics or syllabus points to cover, then pick your study depth and duration. Scribe generates a full plan — readings, quizzes, and comprehension checks — when you hit Generate plan.",
    placement: "right",
  },
];

type PhaseConfig = {
  phase: GuidedTourPhase;
  steps: Step[];
};

const homePhase: PhaseConfig = { phase: "home", steps: homeSteps };
const studyPhase: PhaseConfig = { phase: "study", steps: studySteps };
const wizardPhase: PhaseConfig = { phase: "wizard", steps: wizardSteps };
const materialsPhase: PhaseConfig = {
  phase: "materials",
  steps: materialsSteps,
};
const analysisPhase: PhaseConfig = { phase: "analysis", steps: analysisSteps };

/**
 * Candidate phases for a route, in priority order. A phase only starts once
 * its first step's target is in the DOM, so action-driven phases (the session
 * wizard, the upload analysis card) are listed first and take over as soon as
 * the user acts.
 */
function phasesForPath(pathname: string): PhaseConfig[] {
  if (pathname === "/") return [homePhase];
  if (/^\/workspace\/[^/]+\/study\/?$/.test(pathname)) {
    return [wizardPhase, analysisPhase, materialsPhase, studyPhase];
  }
  return [];
}

function firstTargetVisible(config: PhaseConfig): boolean {
  const target = config.steps[0].target;
  return typeof target !== "string" || !!document.querySelector(target);
}

function TourTooltip({
  backProps,
  index,
  isLastStep,
  primaryProps,
  size,
  skipProps,
  step,
  tooltipProps,
}: TooltipRenderProps) {
  return (
    <div
      {...tooltipProps}
      className="w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-5 shadow-2xl"
    >
      {step.title != null && (
        <h3 className="text-sm font-bold tracking-tight">{step.title}</h3>
      )}
      <div className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
        {step.content}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="text-[11px] font-medium tabular-nums text-faint">
          {index + 1} / {size}
        </span>
        <button
          {...skipProps}
          type="button"
          className="ml-2 text-[12px] font-medium text-faint hover:text-foreground"
        >
          Skip tour
        </button>
        <div className="ml-auto flex items-center gap-2">
          {index > 0 && (
            <Button {...backProps} type="button" variant="ghost" size="sm">
              Back
            </Button>
          )}
          <Button {...primaryProps} type="button" size="sm">
            {isLastStep ? "Done" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function GuidedTour() {
  const pathname = usePathname();
  const [active, setActive] = useState<PhaseConfig | null>(null);
  // Bumped when a phase ends so the effect re-arms and can start the next
  // eligible phase on the same route (e.g. materials → analysis).
  const [generation, setGeneration] = useState(0);

  // Reset the tour when navigating away from the phase it belongs to.
  if (
    active &&
    !phasesForPath(pathname).some((p) => p.phase === active.phase)
  ) {
    setActive(null);
  }

  // Tours only start when explicitly requested via the "?" help button.
  useEffect(() => {
    const handler = () => {
      const candidates = phasesForPath(pathname);
      setActive(candidates.find(firstTargetVisible) ?? null);
    };
    window.addEventListener(TOUR_EVENT, handler);
    return () => window.removeEventListener(TOUR_EVENT, handler);
  }, [pathname, generation]);

  const onEvent = (data: EventData) => {
    if (
      data.type === "tour:end" ||
      data.status === "finished" ||
      data.status === "skipped"
    ) {
      if (active) markGuidedTourCompleted(active.phase);
      setActive(null);
      setGeneration((g) => g + 1);
    }
  };

  if (!active) return null;

  return (
    <Joyride
      key={active.phase}
      steps={active.steps}
      run
      continuous
      scrollToFirstStep
      onEvent={onEvent}
      tooltipComponent={TourTooltip}
      options={{
        skipBeacon: true,
        arrowColor: "var(--card)",
        overlayColor: "rgba(20, 16, 41, 0.45)",
        spotlightRadius: 10,
        zIndex: 90,
      }}
    />
  );
}
