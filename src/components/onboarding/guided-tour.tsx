"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { EventData, Step, TooltipRenderProps } from "react-joyride";
import { Button } from "@/components/ui/button";
import {
  hasCompletedGuidedTour,
  hasCompletedOnboarding,
  markGuidedTourCompleted,
  type GuidedTourPhase,
} from "@/lib/onboarding";

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
    target: '[data-tour="new-workspace"]',
    title: "Create something new",
    content:
      "Add a new workspace or folder any time with these buttons — or the buttons on the home page.",
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
      "Generating content uses monthly tokens — keep an eye on your balance here. Settings and your account live here too. Next up: open a workspace and we'll show you around inside.",
    placement: "right-end",
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
    title: "Upload or record",
    content:
      "Upload PDFs, slides, and audio files — or record a lecture live. Scribe transcribes and analyzes everything automatically.",
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

type PhaseConfig = {
  phase: GuidedTourPhase;
  steps: Step[];
  /** Wait for the "What's new" modal before starting. */
  waitForOnboarding: boolean;
};

function phaseForPath(pathname: string): PhaseConfig | null {
  if (pathname === "/") {
    return { phase: "home", steps: homeSteps, waitForOnboarding: true };
  }
  if (/^\/workspace\/[^/]+\/study\/?$/.test(pathname)) {
    return { phase: "study", steps: studySteps, waitForOnboarding: false };
  }
  if (/^\/workspace\/[^/]+\/materials\/?$/.test(pathname)) {
    return {
      phase: "materials",
      steps: materialsSteps,
      waitForOnboarding: false,
    };
  }
  return null;
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

  // Reset the tour when navigating away from the phase it belongs to.
  if (active && phaseForPath(pathname)?.phase !== active.phase) {
    setActive(null);
  }

  useEffect(() => {
    const config = phaseForPath(pathname);
    if (!config || hasCompletedGuidedTour(config.phase)) return;
    // Wait until any blocking modal has been dismissed, the tour targets have
    // rendered, and the viewport is wide enough for them to be visible.
    const timer = setInterval(() => {
      if (config.waitForOnboarding && !hasCompletedOnboarding()) return;
      if (!window.matchMedia("(min-width: 768px)").matches) return;
      const firstTarget = config.steps[0].target;
      if (
        typeof firstTarget === "string" &&
        !document.querySelector(firstTarget)
      ) {
        return;
      }
      clearInterval(timer);
      setActive(config);
    }, 500);
    return () => clearInterval(timer);
  }, [pathname]);

  const onEvent = (data: EventData) => {
    if (
      data.type === "tour:end" ||
      data.status === "finished" ||
      data.status === "skipped"
    ) {
      if (active) markGuidedTourCompleted(active.phase);
      setActive(null);
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
