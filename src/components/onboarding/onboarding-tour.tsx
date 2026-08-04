"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  hasCompletedOnboarding,
  markOnboarding,
  ONBOARDING_DATE,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Layers,
  Coins,
  Globe,
  FileText,
  ListChecks,
  Shapes,
  Mic,
} from "lucide-react";

type Slide = {
  id: string;
  title: string;
  body: string;
  bullets: string[];
  icon: React.ReactNode;
  animation: React.ReactNode;
};

const slides: Slide[] = [
  {
    id: "sessions",
    title: "Study sessions",
    body: "A session is one curated block of studying — readings, flashcards, worksheets, and quizzes generated together, so you don't have to keep switching around to generate content.",
    bullets: [
      "One prompt plans the whole session",
      "Activities are ordered for you",
      "Pick up where you left off",
    ],
    icon: <BookOpen className="h-5 w-5" />,
    animation: <SessionAnimation />,
  },
  {
    id: "features",
    title: "New features & improved diagrams",
    body: "Diagrams and figures from your materials now render cleaner inside readings and worksheets, and Copilot can search across every session in your workspace.",
    bullets: [
      "Sharper figures in readings",
      "Search all sessions from Copilot",
      "Redesigned members & sharing",
    ],
    icon: <Shapes className="h-5 w-5" />,
    animation: <FeaturesAnimation />,
  },
  {
    id: "tokens",
    title: "Token limits",
    body: "Generation now draws from a monthly token balance instead of per-type caps. Your balance is always visible in the sidebar.",
    bullets: [
      "100 tokens / month on the free plan",
      "Sessions ~20, flashcards & worksheets ~5",
      "Storage is tracked separately",
    ],
    icon: <Coins className="h-5 w-5" />,
    animation: <TokensAnimation />,
  },
  {
    id: "legacy",
    title: "The classic Scribe still exists",
    body: "Prefer the previous experience? It lives on at legacy.scribe.study with the same account and data.",
    bullets: [
      "Same login, same workspaces",
      "Nothing was deleted or migrated away",
      "New features land here first",
    ],
    icon: <Globe className="h-5 w-5" />,
    animation: <LegacyAnimation />,
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(() => !hasCompletedOnboarding());
  const [step, setStep] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  useEffect(() => {
    if (open) {
      markOnboarding("started");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !autoplay) return;
    const timer = setInterval(() => {
      setStep((s) => (s >= slides.length - 1 ? 0 : s + 1));
    }, 5200);
    return () => clearInterval(timer);
  }, [open, autoplay]);

  const goNext = useCallback(() => {
    setAutoplay(false);
    setStep((s) => Math.min(slides.length - 1, s + 1));
  }, []);

  const goPrev = useCallback(() => {
    setAutoplay(false);
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const finish = useCallback(() => {
    markOnboarding("completed");
    setOpen(false);
  }, []);

  if (!open) return null;

  const slide = slides[step];
  const progress = ((step + 1) / slides.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-fade-up md:h-[520px] md:flex-row">
        <div className="absolute inset-x-0 top-0 z-10 h-1 bg-muted">
          <div
            className="h-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-accent-soft to-background p-8">
          <div key={slide.id} className="relative w-full max-w-sm animate-fade-up">
            {slide.animation}
          </div>
        </div>

        <div className="flex w-full flex-col justify-between p-8 md:w-[420px] md:p-10">
          <div>
            <div className="flex items-center gap-2 text-accent">
              <span className="text-xs font-semibold">What&apos;s new</span>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {ONBOARDING_DATE}
              </span>
            </div>

            <div key={slide.id} className="mt-6 animate-fade-up">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                {slide.icon}
              </div>
              <h2 className="text-2xl font-bold tracking-tight">{slide.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {slide.body}
              </p>
              <ul className="mt-4 space-y-2">
                {slide.bullets.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-center gap-2">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setAutoplay(false);
                    setStep(i);
                  }}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    i === step
                      ? "w-6 bg-accent"
                      : "w-2 bg-border hover:bg-border-strong",
                  )}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              {step > 0 ? (
                <Button variant="outline" size="md" className="flex-1" onClick={goPrev}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
              ) : (
                <Button variant="outline" size="md" className="flex-1" onClick={finish}>
                  Skip
                </Button>
              )}
              {step < slides.length - 1 ? (
                <Button size="md" className="flex-1" onClick={goNext}>
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button size="md" className="flex-1" onClick={finish}>
                  Get started
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const sessionActivities = [
  { icon: FileText, label: "Reading", meta: "Cell respiration overview" },
  { icon: Layers, label: "Flashcards", meta: "18 cards" },
  { icon: ListChecks, label: "Worksheet", meta: "10 problems" },
  { icon: Mic, label: "Podcast", meta: "8 min recap" },
];

function SessionAnimation() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-lg">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Cellular Respiration</p>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
          Session
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {sessionActivities.map(({ icon: Icon, label, meta }, i) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5"
            style={{ animation: `fade-up 0.5s ease-out ${i * 0.15}s both` }}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium">{label}</p>
              <p className="truncate text-[11px] text-muted-foreground">{meta}</p>
            </div>
            <span className="ml-auto text-[10px] text-faint">{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Smooth rank-2 pattern: block-structured like an SVD compression figure. */
const rerankMatrix = Array.from({ length: 10 }, (_, i) =>
  Array.from({ length: 10 }, (_, j) => {
    const u = i < 5 ? 1 - i * 0.18 : -(1 - (i - 5) * 0.18);
    const v = j < 5 ? 1 - j * 0.18 : -(1 - (j - 5) * 0.18);
    return -u * v;
  }),
);

/** Diverging pastel palette: -1 → sky blue, 0 → white, 1 → soft red. */
function heat(v: number): string {
  const t = Math.max(-1, Math.min(1, v));
  if (t < 0) {
    // white → rgb(94 188 240)
    const a = -t;
    return `rgb(${Math.round(255 - a * (255 - 94))} ${Math.round(255 - a * (255 - 188))} ${Math.round(255 - a * (255 - 240))})`;
  }
  // white → rgb(224 122 133)
  return `rgb(${Math.round(255 - t * (255 - 224))} ${Math.round(255 - t * (255 - 122))} ${Math.round(255 - t * (255 - 133))})`;
}

function FeaturesAnimation() {
  return (
    <div className="mx-auto max-w-[240px] rounded-2xl border border-border bg-card p-4 shadow-lg">
      <p className="text-xs font-semibold">Rerank matrix</p>
      <div className="mt-3 grid grid-cols-10 gap-[3px]">
        {rerankMatrix.flatMap((row, i) =>
          row.map((v, j) => (
            <div
              key={`${i}-${j}`}
              className="aspect-square rounded-[3px]"
              style={{
                backgroundColor: heat(v),
                animation: `fade-up 0.4s ease-out ${(i + j) * 0.04}s both`,
              }}
            />
          )),
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: heat(-1) }} />
          Low relevance
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: heat(1) }} />
          High relevance
        </span>
      </div>
      <div className="mt-3 rounded-lg bg-accent-soft/50 px-3 py-2 text-[11px] text-muted-foreground">
        Figures like this now render inline, sharp at any size.
      </div>
    </div>
  );
}

function TokensAnimation() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-lg">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Monthly tokens</p>
        <span className="rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-semibold text-white">
          62 / 100 left
        </span>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-border">
        <div className="h-full w-[62%] rounded-full bg-accent" />
      </div>
      <div className="mt-4 space-y-2 text-xs">
        {[
          { label: "Study session", cost: "20" },
          { label: "Worksheet", cost: "5" },
          { label: "Flashcard set", cost: "5" },
          { label: "Podcast episode", cost: "25" },
        ].map(({ label, cost }) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
          >
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold text-accent">{cost} tokens</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegacyAnimation() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-lg">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
        <Globe className="h-3.5 w-3.5 text-accent" />
        legacy.scribe.study
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-center text-xs">
        <div className="rounded-xl border border-accent/40 bg-accent-soft p-4">
          <p className="font-semibold text-accent">New Scribe</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Sessions, tokens, new features
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-semibold text-foreground">Classic Scribe</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Same account &amp; data
          </p>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Switch back anytime — your workspaces stay in sync.
      </p>
    </div>
  );
}
