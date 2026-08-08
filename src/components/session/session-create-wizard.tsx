"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SessionDepth, ExamBoard } from "@/types";
import {
  Sparkles,
  Clock,
  Brain,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";

interface SessionConfig {
  title: string;
  description: string;
  depth: SessionDepth;
  durationMinutes: number;
  examBoard: ExamBoard | "";
  syllabus: string;
  topics: string;
}

interface SessionCreateWizardProps {
  workspaceTitle: string;
  creating?: boolean;
  onClose: () => void;
  onCreate: (config: SessionConfig) => void;
}

const depthOptions: { value: SessionDepth; label: string; description: string; icon: React.ElementType }[] = [
  {
    value: "light",
    label: "Light review",
    description: "Quick pass — flashcards, key terms, short MCQs",
    icon: BookOpen,
  },
  {
    value: "moderate",
    label: "Moderate",
    description: "Balanced mix of reading, MCQs, and comprehension checks",
    icon: Clock,
  },
  {
    value: "deep",
    label: "Deep study",
    description: "Thorough coverage with extended comprehension loops and harder questions",
    icon: Brain,
  },
];

const examBoards: { value: ExamBoard; label: string }[] = [
  { value: "IB", label: "IB" },
  { value: "AP", label: "AP" },
  { value: "GCSE", label: "GCSE" },
  { value: "A_LEVEL", label: "A-Level" },
  { value: "SAT", label: "SAT" },
  { value: "OTHER", label: "Other" },
];

const durationOptions = [15, 30, 45, 60, 90, 120];

function defaultSessionTitle(): string {
  const now = new Date();
  const date = now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
  const time = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} ${time} Study session`;
}

export function SessionCreateWizard({
  workspaceTitle,
  creating = false,
  onClose,
  onCreate,
}: SessionCreateWizardProps) {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<SessionConfig>({
    title: defaultSessionTitle(),
    description: "",
    depth: "moderate",
    durationMinutes: 30,
    examBoard: "",
    syllabus: "",
    topics: "",
  });

  const steps = [
    // Step 0: What to study
    <div key="what" className="space-y-4">
      <div>
        <p className="text-lg font-semibold">What are you studying?</p>
        <p className="text-sm text-muted-foreground mt-1">
          Tell us about the topic for {workspaceTitle}
        </p>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">
            Session title
          </label>
          <input
            type="text"
            value={config.title}
            onChange={(e) => setConfig({ ...config, title: e.target.value })}
            placeholder="e.g., Atomic Structure & Periodicity"
            className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">
            Topics or syllabus points (optional)
          </label>
          <textarea
            value={config.topics}
            onChange={(e) => setConfig({ ...config, topics: e.target.value })}
            placeholder="e.g., Electron configuration, periodic trends, ionization energy..."
            className="w-full h-20 rounded-lg border border-border bg-card p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">
            Exam board
          </label>
          <div className="flex flex-wrap gap-2">
            {examBoards.map((board) => (
              <button
                key={board.value}
                type="button"
                onClick={() =>
                  setConfig({
                    ...config,
                    examBoard: config.examBoard === board.value ? "" : board.value,
                  })
                }
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm border",
                  config.examBoard === board.value
                    ? "border-accent bg-accent/10 text-accent font-medium"
                    : "border-border hover:border-accent/30 text-muted-foreground",
                )}
              >
                {board.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,

    // Step 1: How to study
    <div key="how" className="space-y-4">
      <div>
        <p className="text-lg font-semibold">How do you want to study?</p>
        <p className="text-sm text-muted-foreground mt-1">
          Choose your intensity and time
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
          Study depth
        </label>
        {depthOptions.map((opt) => {
          const Icon = opt.icon;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setConfig({ ...config, depth: opt.value })}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border text-left",
                config.depth === opt.value
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-accent/20",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 flex-shrink-0",
                  config.depth === opt.value
                    ? "text-accent"
                    : "text-muted-foreground",
                )}
              />
              <div>
                <span className="text-sm font-medium">{opt.label}</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {opt.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
          Session duration
        </label>
        <div className="flex flex-wrap gap-2">
          {durationOptions.map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => setConfig({ ...config, durationMinutes: mins })}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm border tabular-nums",
                config.durationMinutes === mins
                  ? "border-accent bg-accent/10 text-accent font-medium"
                  : "border-border hover:border-accent/30 text-muted-foreground",
              )}
            >
              {mins < 60 ? `${mins}m` : `${mins / 60}h`}
            </button>
          ))}
        </div>
      </div>
    </div>,
  ];

  const isLastStep = step === steps.length - 1;
  const canProceed = step === 0 ? config.title.trim().length > 0 : true;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <Card
        data-tour="session-wizard"
        className="w-full max-w-lg sm:rounded-xl rounded-t-xl rounded-b-none sm:rounded-b-xl max-h-[85vh] overflow-y-auto p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm font-medium text-muted-foreground">
            New study session
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Cancel
          </button>
        </div>

        {steps[step]}

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 w-6 rounded-full",
                  i <= step ? "bg-accent" : "bg-muted",
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-3 w-3 mr-1" />
                Back
              </Button>
            )}
            {!isLastStep ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setStep(step + 1)}
                disabled={!canProceed}
              >
                Next
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onCreate(config)}
                disabled={!canProceed || creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Generating plan…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Generate plan
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
