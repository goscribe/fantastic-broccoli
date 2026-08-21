import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScribeMark } from "@/components/graphics/logo";
import {
  AudioArt,
  NoteArt,
  PdfArt,
  SlidesArt,
} from "@/components/graphics/material-art";
import type { ArtSide, ArtTint, FeatureScene, SceneMock } from "@/app/landing/data";
import { cn } from "@/lib/utils";

const TINTS: Record<ArtTint, string> = {
  accent: "bg-accent-soft/80",
  sky: "bg-sky/15",
  rose: "bg-rose/12",
  amber: "bg-amber/15",
};

const ART_POS: Record<ArtSide, string> = {
  right: "-bottom-8 -right-6 sm:-bottom-10 sm:-right-10",
  left: "-bottom-8 -left-6 sm:-bottom-10 sm:-left-10",
  bottom: "-bottom-10 left-1/2 -translate-x-1/2",
};

const ART_SIZE = {
  sm: "w-32 sm:w-40",
  md: "w-44 sm:w-56",
  lg: "w-56 sm:w-72",
};

/** Tinted panel the 3D art bleeds off — same idea as the in-app empty states. */
export function ArtStage({
  src,
  tint = "accent",
  side = "right",
  size = "md",
  children,
  className,
}: {
  src: string;
  tint?: ArtTint;
  side?: ArtSide;
  size?: keyof typeof ART_SIZE;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl",
        TINTS[tint],
        className,
      )}
    >
      {children ? (
        <div className="relative z-10">{children}</div>
      ) : (
        <div className="h-44 sm:h-48" />
      )}
      <Image
        src={src}
        alt=""
        width={880}
        height={880}
        className={cn(
          "pointer-events-none absolute select-none object-contain drop-shadow-[0_18px_36px_rgba(105,82,224,0.18)]",
          ART_POS[side],
          ART_SIZE[size],
        )}
      />
    </div>
  );
}

export function ProductCard({
  children,
  className,
  eyebrow,
}: {
  children: React.ReactNode;
  className?: string;
  eyebrow?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      {eyebrow ? (
        <div className="border-b border-border px-4 py-2.5">
          <p className="truncate text-[11px] font-medium text-muted-foreground">
            {eyebrow}
          </p>
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function SessionMock({ className }: { className?: string }) {
  return (
    <div className={cn("bg-background", className)}>
      <div className="px-5 pb-4 pt-5">
        <p className="text-[11px] font-semibold text-accent">Activity 3 of 6</p>
        <p className="mt-2 text-[15px] font-semibold leading-snug">
          What does K<sub>m</sub> represent in Michaelis–Menten kinetics?
        </p>
        <ul className="mt-4 space-y-2">
          {[
            { label: "Maximum reaction velocity", ok: false },
            { label: "Substrate concentration at half-Vmax", ok: true },
            { label: "The enzyme’s molecular weight", ok: false },
            { label: "A unitless equilibrium constant", ok: false },
          ].map((opt) => (
            <li
              key={opt.label}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] ${
                opt.ok
                  ? "border-accent/50 bg-accent-soft font-medium text-accent"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {opt.ok ? (
                <Check className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <span className="size-3.5 shrink-0 rounded-full border border-border-strong" />
              )}
              {opt.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-3 border-t border-border bg-card px-4 py-3">
        <span className="text-[10px] tabular-nums text-muted-foreground">
          3/6
        </span>
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="absolute inset-y-0 left-0 w-[48%] rounded-full bg-accent" />
        </div>
        <span className="text-[10px] font-semibold tabular-nums">48%</span>
      </div>
    </div>
  );
}

function QuizMock() {
  return (
    <div className="space-y-3 bg-background p-5">
      <p className="text-[11px] font-semibold text-muted-foreground">
        Worksheet · part (b)
      </p>
      <p className="text-sm font-semibold">
        Explain why doubling [E] doubles the observed rate.
      </p>
      <div className="rounded-xl border border-border bg-card px-3.5 py-3 text-[13px] text-muted-foreground">
        Rate doubles because there are twice as many active sites…
      </div>
      <div className="rounded-xl border border-accent/30 bg-accent-soft px-3.5 py-3 text-[13px]">
        <p className="font-semibold text-accent">+1 of 2 marks</p>
        <p className="mt-1 text-muted-foreground">
          Link it to enzyme concentration — the markscheme wants the causal
          step, not just “it doubles.”
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-accent">
          <FileText className="h-3 w-3" />
          lecture-04.pdf · p.12
        </p>
      </div>
    </div>
  );
}

function CopilotMock() {
  return (
    <div className="bg-background p-5">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <ScribeMark className="h-5 w-5" />
        <span className="text-[13px] font-semibold">Copilot</span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          Grounded in this workspace
        </span>
      </div>
      <div className="mt-4 space-y-3">
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-[13px] font-medium text-accent-foreground">
          Why did I lose a mark on part (b)?
        </div>
        <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2.5 text-[13px] text-muted-foreground">
          You stated the rate doubles but didn’t link it to enzyme
          concentration. The scheme wants the causal step.
          <span className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-accent">
            <FileText className="h-3 w-3" />
            lecture-04.pdf · p.12
          </span>
        </div>
      </div>
    </div>
  );
}

function UploadMock() {
  return (
    <div className="bg-background p-5">
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { art: PdfArt, label: "Textbook PDFs" },
          { art: SlidesArt, label: "Lecture slides" },
          { art: AudioArt, label: "Lecture audio" },
          { art: NoteArt, label: "Notes & handouts" },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-3"
          >
            <item.art className="h-9 w-9 shrink-0" />
            <span className="text-[12px] font-medium leading-tight">
              {item.label}
            </span>
          </div>
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {[
          { name: "lecture-04.pdf", state: "Parsed · 18 figures" },
          { name: "Week 4 slides.pptx", state: "Parsed · 42 slides" },
          { name: "seminar-audio.m4a", state: "Transcribed" },
        ].map((f) => (
          <li
            key={f.name}
            className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-[12px]"
          >
            <span className="font-medium">{f.name}</span>
            <span className="text-accent">{f.state}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlashcardMock() {
  return (
    <div className="flex flex-col items-center bg-background px-5 py-7">
      <p className="text-[11px] font-semibold text-muted-foreground">
        Card 7 of 18
      </p>
      <div className="relative mt-4 w-full max-w-xs">
        <div className="absolute inset-x-3 top-2 h-full rounded-2xl border border-border bg-muted" />
        <div className="relative rounded-2xl border border-border bg-card px-5 py-8 text-center shadow-sm">
          <p className="text-base font-semibold">What does Kₘ represent?</p>
          <p className="mt-3 text-[12px] text-muted-foreground">
            Tap to reveal answer
          </p>
        </div>
      </div>
    </div>
  );
}

const MOCKS: Record<SceneMock, () => React.ReactNode> = {
  session: () => <SessionMock />,
  quiz: () => <QuizMock />,
  copilot: () => <CopilotMock />,
  upload: () => <UploadMock />,
  flashcards: () => <FlashcardMock />,
};

export function FeatureSplit({ scene }: { scene: FeatureScene }) {
  const mock = MOCKS[scene.mock]();
  const visual = scene.art ? (
    <ArtStage
      src={scene.art}
      tint={scene.artTint}
      side={scene.artSide ?? (scene.reverse ? "left" : "right")}
      size="lg"
      className="p-5 sm:p-7"
    >
      <ProductCard eyebrow={scene.url} className="max-w-md shadow-md">
        {mock}
      </ProductCard>
    </ArtStage>
  ) : (
    <ProductCard eyebrow={scene.url}>{mock}</ProductCard>
  );
  const copy = (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
        {scene.title}
      </h2>
      <p className="mt-3 max-w-lg text-muted-foreground text-pretty">
        {scene.body}
      </p>
      <ul className="mt-6 space-y-3">
        {scene.bullets.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft">
              <Check className="h-3 w-3 text-accent" />
            </span>
            <span className="text-muted-foreground">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
      <div className={scene.reverse ? "lg:order-2" : undefined}>{copy}</div>
      <div className={scene.reverse ? "lg:order-1" : undefined}>{visual}</div>
    </div>
  );
}

export function CtaBand({
  title = "Ready to study smarter?",
  subtitle = "Turn a lecture PDF into a session you can actually finish — in minutes.",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="border-t border-border py-10 md:py-16">
      <div className="mx-auto max-w-6xl px-6">
        <ArtStage
          src="/illustrations/marketing/mkt-celebrate.png"
          tint="accent"
          side="right"
          size="lg"
          className="px-8 py-12 sm:px-12 sm:py-16"
        >
          <div className="relative z-10 max-w-lg">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
              {title}
            </h2>
            <p className="mt-3 max-w-md text-muted-foreground">{subtitle}</p>
            <Link href="/signup" className="mt-8 inline-block">
              <Button size="lg" className="gap-2">
                Start studying
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="mt-3 text-xs text-faint">
              Free to start · No credit card required
            </p>
          </div>
        </ArtStage>
      </div>
    </section>
  );
}
