"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import type { EventData, Step } from "react-joyride";
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
      locale={{ last: "Done", skip: "Skip tour" }}
      options={{
        skipBeacon: true,
        showProgress: true,
        buttons: ["back", "close", "primary", "skip"],
        primaryColor: "#7c5cfc",
        overlayColor: "rgba(20, 16, 41, 0.45)",
        spotlightRadius: 10,
        zIndex: 90,
      }}
      styles={{
        tooltip: { borderRadius: 14, fontSize: 14 },
        tooltipTitle: { fontSize: 15, fontWeight: 700 },
        buttonPrimary: { borderRadius: 8, fontSize: 13, fontWeight: 600 },
        buttonBack: { fontSize: 13 },
        buttonSkip: { fontSize: 13 },
      }}
    />
  );
}
