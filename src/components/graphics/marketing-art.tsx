import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfettiDots } from "@/components/graphics/floating-decor";
import { ScribeMark } from "@/components/graphics/logo";
import type { FeatureScene, SceneMock } from "@/app/landing/data";
import { cn } from "@/lib/utils";

export function GlossyArt({
  src,
  alt = "",
  className,
  imgClassName,
  priority,
  width = 880,
  height = 880,
}: {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  width?: number;
  height?: number;
}) {
  return (
    <div className={cn("relative", className)}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={cn(
          "h-auto w-full select-none object-contain drop-shadow-[0_18px_40px_rgba(105,82,224,0.22)]",
          imgClassName,
        )}
      />
    </div>
  );
}

export function DeviceFrame({
  children,
  url = "scribe.study",
  className,
}: {
  children: React.ReactNode;
  url?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_-24px_rgba(23,19,32,0.35)]",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <span className="size-2.5 rounded-full bg-rose/80" />
        <span className="size-2.5 rounded-full bg-amber/80" />
        <span className="size-2.5 rounded-full bg-success/80" />
        <span className="ml-2 min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-0.5 text-[10px] text-faint">
          {url}
        </span>
      </div>
      {children}
    </div>
  );
}

export function SessionMock({ className }: { className?: string }) {
  const steps = [
    "/illustrations/icons/act-reading.png",
    "/illustrations/icons/act-comprehension.png",
    "/illustrations/icons/act-mcq.png",
    "/illustrations/icons/act-worksheet.png",
    "/illustrations/icons/act-flashcards.png",
    "/illustrations/icons/act-cloze.png",
  ];
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
        <div className="relative flex-1">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
          <div className="absolute left-0 top-1/2 h-1.5 w-[48%] -translate-y-1/2 rounded-full bg-accent" />
          <div className="relative flex items-center justify-between">
            {steps.map((src, i) => (
              <Image
                key={src}
                src={src}
                alt=""
                width={40}
                height={40}
                className={`h-7 w-7 object-contain ${i === 2 ? "h-8 w-8" : i > 2 ? "opacity-40" : ""}`}
              />
            ))}
          </div>
        </div>
        <span className="text-[10px] font-semibold tabular-nums">48%</span>
      </div>
    </div>
  );
}

function QuizMock() {
  return (
    <div className="space-y-3 bg-background p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
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
        <div className="flex gap-2">
          <Image
            src="/illustrations/bot.png"
            alt=""
            width={36}
            height={36}
            className="mt-1 h-8 w-8 shrink-0 object-contain"
          />
          <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2.5 text-[13px] text-muted-foreground">
            You stated the rate doubles but didn’t link it to enzyme
            concentration. The scheme wants the causal step.
            <span className="mt-2 block text-[11px] font-medium text-accent">
              lecture-04.pdf · p.12
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadMock() {
  return (
    <div className="bg-background p-5">
      <div className="rounded-2xl border-2 border-dashed border-accent/30 bg-accent-soft/40 px-4 py-8 text-center">
        <Image
          src="/illustrations/marketing/mkt-upload.png"
          alt=""
          width={120}
          height={120}
          className="mx-auto h-20 w-auto"
        />
        <p className="mt-3 text-sm font-semibold">Drop files here</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          PDFs, slides, notes, lecture audio
        </p>
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
      <p className="text-[11px] font-semibold text-faint">FLASHCARD 7 / 18</p>
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
  const art = (
    <div className="relative pb-6 sm:pb-10">
      <DeviceFrame url="scribe.study/session" className="relative z-10">
        {mock}
      </DeviceFrame>
      <GlossyArt
        src={scene.art}
        className={cn(
          "pointer-events-none absolute -bottom-4 z-20 w-32 sm:-bottom-8 sm:w-48",
          scene.reverse ? "-left-2 sm:-left-10" : "-right-2 sm:-right-10",
          scene.artClassName,
        )}
        imgClassName="animate-float"
      />
    </div>
  );
  const copy = (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">
        {scene.kicker}
      </p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-balance sm:text-3xl">
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
      <div className={scene.reverse ? "lg:order-1" : undefined}>{art}</div>
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
    <section className="relative overflow-hidden border-t border-border py-16 md:py-24">
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="text-center lg:text-left">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            {title}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground lg:mx-0">
            {subtitle}
          </p>
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
        <div className="relative mx-auto max-w-md">
          <ConfettiDots />
          <GlossyArt
            src="/illustrations/marketing/mkt-celebrate.png"
            width={880}
            height={485}
            className="relative"
          />
        </div>
      </div>
    </section>
  );
}
