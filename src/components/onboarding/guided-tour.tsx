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
} from "@/lib/onboarding";

const Joyride = dynamic(
  () => import("react-joyride").then((m) => m.Joyride),
  { ssr: false },
);

const steps: Step[] = [
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
      "Generating content uses monthly tokens — keep an eye on your balance here. Settings and your account live here too.",
    placement: "right-end",
  },
];

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
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (pathname !== "/" || hasCompletedGuidedTour()) return;
    // Wait until the "What's new" modal has been dismissed and only run the
    // tour on viewports where the sidebar targets are visible.
    const timer = setInterval(() => {
      if (!hasCompletedOnboarding()) return;
      if (!window.matchMedia("(min-width: 768px)").matches) return;
      clearInterval(timer);
      setRun(true);
    }, 500);
    return () => clearInterval(timer);
  }, [pathname]);

  const onEvent = (data: EventData) => {
    if (
      data.type === "tour:end" ||
      data.status === "finished" ||
      data.status === "skipped"
    ) {
      markGuidedTourCompleted();
      setRun(false);
    }
  };

  if (!run) return null;

  return (
    <Joyride
      steps={steps}
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
