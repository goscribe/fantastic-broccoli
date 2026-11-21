import type { ReactNode } from "react";
import { LandingCta, landingWrap } from "@/components/design/landing-page";
import { Cat, CopilotMock, FlashcardMock, QuestionMock, UploadMock, WorksheetMock, type CatPose } from "@/components/design/landing-mocks";
import type { FeatureScene, SceneMock } from "@/app/landing/data";
import { cn } from "@/lib/utils";

/**
 * Shared pieces for the /landing sub-pages, in the signed-in app's look:
 * white page, grey text ramp, the time-of-day scene and the cat for colour.
 */

/** A small window onto the hero's landscape with the cat standing in it. Decorative. */
export function Scene({ pose = "wave", className }: { pose?: CatPose; className?: string }) {
  return (
    <div aria-hidden className={cn("landing-scene hero-card relative isolate h-52 overflow-hidden rounded-[var(--r-panel)] border border-border sm:h-60", className)}>
      <div className="hero-field absolute inset-0 -z-10">
        <div className="absolute bottom-[12%] left-1/2 h-[62%] -translate-x-1/2">
          <span className="hero-field__ground" />
          <Cat pose={pose} className="cat-bob relative h-full" />
        </div>
      </div>
    </div>
  );
}

/** A sub-page's opening: the h1 and its lede on the page, the scene beside them from lg up. */
export function PageHero({ title, lede, pose, children, narrow = false }: { title: string; lede: ReactNode; pose?: CatPose; children?: ReactNode; narrow?: boolean }) {
  return (
    <div className={cn(pose && "grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12")}>
      <div className={cn(narrow && "max-w-3xl")}>
        <h1 className="text-balance text-[34px] font-extrabold leading-[1.08] sm:text-[44px] lg:text-[50px]">{title}</h1>
        <div className="mt-4 max-w-xl text-[17px] leading-relaxed text-muted-foreground sm:text-[18px]">{lede}</div>
        {children}
      </div>
      {pose && <Scene pose={pose} className="hidden lg:block" />}
    </div>
  );
}

/** Section wrapper for the sub-pages: one width, one rhythm. */
export function PageSection({ children, className, rule = false }: { children: ReactNode; className?: string; rule?: boolean }) {
  return (
    <section className={cn(rule && "border-t border-border")}>
      <div className={cn(landingWrap, "py-12 sm:py-16", className)}>{children}</div>
    </section>
  );
}

export function FunFeatureCard({
  title,
  description,
  heading: Heading = "h3",
}: {
  title: string;
  description: string;
  heading?: "h2" | "h3";
}) {
  return (
    <li className="life-card p-5 sm:p-6">
      <Heading className="text-[17px] font-extrabold leading-snug">{title}</Heading>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{description}</p>
    </li>
  );
}

/** A plain list: the points themselves, no icon in front of each. */
export function Points({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn("list-disc space-y-2 pl-5 text-[15.5px] leading-relaxed text-muted-foreground marker:text-border-strong", className)}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

const MOCKS: Record<SceneMock, () => ReactNode> = {
  session: () => <QuestionMock />,
  quiz: () => <WorksheetMock />,
  copilot: () => <CopilotMock />,
  upload: () => <UploadMock />,
  flashcards: () => <FlashcardMock />,
};

export function FeatureSplit({ scene }: { scene: FeatureScene }) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
      <div className={scene.reverse ? "lg:order-2" : undefined}>
        <h2 className="text-balance text-[26px] font-extrabold leading-[1.12] sm:text-[32px]">{scene.title}</h2>
        <p className="mt-3 max-w-lg text-[17px] leading-relaxed text-muted-foreground text-pretty">{scene.body}</p>
        <Points items={scene.bullets} className="mt-5" />
      </div>
      <div className={cn("mx-auto w-full max-w-[480px]", scene.reverse && "lg:order-1")}>{MOCKS[scene.mock]()}</div>
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
  return <LandingCta title={title} sub={subtitle} cta="Start studying" note="Free to start · No credit card required" />;
}
