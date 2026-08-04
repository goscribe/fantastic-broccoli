"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScribeMark } from "@/components/graphics/logo";
import {
  hasCompletedOnboarding,
  markOnboarding,
  ONBOARDING_DATE,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";
import { ArrowRight, ArrowLeft, Sparkles, Search, Palette, Coins } from "lucide-react";

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
    id: "welcome",
    title: "Meet the new Scribe",
    body: "August 4th release — a cleaner, smarter study experience.",
    bullets: ["Fresh new look", "Tokens power everything", "Search across sessions"],
    icon: <Sparkles className="h-5 w-5" />,
    animation: <WelcomeAnimation />,
  },
  {
    id: "search",
    title: "Ask across every session",
    body: "Copilot now searches all your study sessions, not only the one you’re in.",
    bullets: ["Session-aware answers", "Find facts across readings / worksheets", "No more losing context"],
    icon: <Search className="h-5 w-5" />,
    animation: <SearchAnimation />,
  },
  {
    id: "theme",
    title: "A unified purple look",
    body: "Scribe and Fantastic Broccoli now share a consistent primary palette.",
    bullets: ["No leftover green gradients", "Cleaner members modal", "Easier-to-read passages"],
    icon: <Palette className="h-5 w-5" />,
    animation: <ThemeAnimation />,
  },
  {
    id: "tokens",
    title: "Tokens, not limits",
    body: "One balance covers flashcards, worksheets, study guides, and podcasts.",
    bullets: ["Monthly token allowance", "Storage stays separate", "Top-ups when you need them"],
    icon: <Coins className="h-5 w-5" />,
    animation: <TokensAnimation />,
  },
];

export function OnboardingTour() {
  const [open, setOpen] = useState(() => !hasCompletedOnboarding());
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"next" | "prev">("next");
  const [autoplay, setAutoplay] = useState(true);

  useEffect(() => {
    if (open) {
      markOnboarding("started");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !autoplay) return;
    const timer = setInterval(() => {
      setStep((s) => {
        if (s >= slides.length - 1) return 0;
        setDir("next");
        return s + 1;
      });
    }, 5200);
    return () => clearInterval(timer);
  }, [open, autoplay]);

  const goNext = useCallback(() => {
    setAutoplay(false);
    setDir("next");
    setStep((s) => Math.min(slides.length - 1, s + 1));
  }, []);

  const goPrev = useCallback(() => {
    setAutoplay(false);
    setDir("prev");
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const finish = useCallback(() => {
    markOnboarding("completed");
    setOpen(false);
  }, []);

  const skip = useCallback(() => {
    markOnboarding("completed");
    setOpen(false);
  }, []);

  if (!open) return null;

  const slide = slides[step];
  const progress = ((step + 1) / slides.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-fade-up md:h-[520px] md:flex-row">
        {/* Progress bar */}
        <div className="absolute inset-x-0 top-0 z-10 h-1 bg-muted">
          <div
            className="h-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Animated stage */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-accent-soft to-background p-8">
          <div className="absolute inset-0 opacity-40">
            <div className="absolute left-[10%] top-[15%] h-32 w-32 rounded-full bg-accent/20 blur-3xl" />
            <div className="absolute bottom-[10%] right-[15%] h-40 w-40 rounded-full bg-accent/15 blur-3xl" />
          </div>
          <div
            key={slide.id}
            className={cn(
              "relative w-full max-w-sm transition-all duration-500",
              dir === "next" ? "animate-fade-up" : "animate-fade-up",
            )}
          >
            {slide.animation}
          </div>
        </div>

        {/* Copy */}
        <div className="flex w-full flex-col justify-between p-8 md:w-[420px] md:p-10">
          <div>
            <div className="flex items-center gap-2 text-accent">
              <ScribeMark className="h-6 w-6" />
              <span className="text-xs font-bold uppercase tracking-widest">What&apos;s new</span>
              <span className="ml-auto text-[11px] text-muted-foreground">{ONBOARDING_DATE}</span>
            </div>

            <div key={slide.id} className="mt-6 animate-fade-up">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                {slide.icon}
              </div>
              <h2 className="text-2xl font-bold tracking-tight">{slide.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{slide.body}</p>
              <ul className="mt-4 space-y-2">
                {slide.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
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
                    setDir(i > step ? "next" : "prev");
                    setStep(i);
                  }}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    i === step ? "w-6 bg-accent" : "w-2 bg-border hover:bg-border-strong",
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
                <Button variant="outline" size="md" className="flex-1" onClick={skip}>
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

function WelcomeAnimation() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-lg">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/10" />
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-accent-soft animate-float" />
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-accent/20" />
          <div className="h-2 w-20 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-6 space-y-3">
        <div className="h-24 rounded-xl bg-muted/60" />
        <div className="h-24 rounded-xl bg-accent-soft/40" />
      </div>
      <div className="mt-2 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-8 flex-1 rounded-lg bg-accent/15"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function SearchAnimation() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-lg">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
        <Search className="h-4 w-4 text-accent" />
        <div className="h-2 w-32 rounded bg-muted" />
      </div>
      <div className="mt-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-xl p-3 transition-opacity duration-500",
              i === 1 ? "bg-accent-soft/50" : "bg-muted/40",
            )}
            style={{ animation: `fade-up 0.6s ease-out ${i * 0.25}s both` }}
          >
            <div className="h-2 w-3/4 rounded bg-accent/20" />
            <div className="mt-2 h-2 w-1/2 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ThemeAnimation() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-4">
        <div className="h-20 w-20 animate-float rounded-2xl bg-accent shadow-lg" />
        <div className="h-20 w-20 animate-float rounded-2xl bg-accent-soft shadow-lg" style={{ animationDelay: "0.2s" }} />
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-lg">
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-8 flex-1 rounded-lg bg-muted transition-colors duration-700"
              style={{ animation: `pulse-dot 1.2s ease-in-out ${i * 0.15}s infinite` }}
            />
          ))}
        </div>
        <div className="mt-3 h-2 w-full rounded bg-accent/10" />
      </div>
    </div>
  );
}

function TokensAnimation() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="rounded-full bg-accent px-3 py-1 text-[10px] font-semibold text-white animate-pulse-dot">
          100 tokens / mo
        </div>
      </div>
      <div className="mt-6 h-3 rounded-full bg-border overflow-hidden">
        <div className="h-full w-2/3 rounded-full bg-accent" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex aspect-square flex-col items-center justify-center rounded-xl bg-accent-soft/50"
            style={{ animation: `float-y 3s ease-in-out ${i * 0.2}s infinite` }}
          >
            <Coins className="h-6 w-6 text-accent" />
          </div>
        ))}
      </div>
    </div>
  );
}
