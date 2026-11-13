"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Volume2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const SEEN_KEY = "scribe.tour.v2";
const VIDEO = "/onboarding/tour.mp4";
const POSTER = "/onboarding/tour-poster.jpg";
const BACKDROP = "/onboarding/backdrop.mp4";
const BACKDROP_POSTER = "/onboarding/backdrop.jpg";

/** Chapters of the walkthrough video; `at` is where each starts, in seconds. */
const CHAPTERS = [
  { at: 0, title: "Make a subject", text: "One subject per course. Everything for that course lives inside it." },
  { at: 7, title: "Add your notes", text: "Drop slides, PDFs, photos of notes or a YouTube link into the subject." },
  { at: 17.5, title: "Organise them", text: "Scribe regroups your files by topic, with the key points of each." },
  { at: 25.5, title: "Study a session", text: "A session mixes reading, questions and flashcards built from your notes." },
  { at: 35.3, title: "Plan your week", text: "The planner fits sessions around your calendar and keeps your streak going." },
] as const;

let open = false;
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const notify = () => listeners.forEach((l) => l());

export function markAppTourSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "seen");
  } catch {}
}

function hasSeenAppTour(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "seen";
  } catch {
    return true;
  }
}

/** Opens the walkthrough from anywhere (the sidebar's "How Scribe works"). */
export function requestAppTour() {
  open = true;
  notify();
}

function closeAppTour() {
  open = false;
  markAppTourSeen();
  notify();
}

/** The narrated walkthrough video with its chapters: click one to jump there; the current one is described underneath. */
export function TourVideo({ autoPlay = false, className }: { autoPlay?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [muted, setMuted] = useState(true);
  const active = CHAPTERS.reduce((cur, c, i) => (time >= c.at ? i : cur), 0);

  // Browsers only start a video with sound after a click on the page; otherwise it starts muted with a "Turn sound on" button.
  useEffect(() => {
    const v = ref.current;
    if (!v || !autoPlay) return;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      void v.play().catch(() => {});
    });
  }, [autoPlay]);

  const jump = (at: number) => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = at;
    setTime(at);
    void v.play().catch(() => {});
  };

  const unmute = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = false;
    void v.play().catch(() => {});
  };

  return (
    <div className={className}>
      <div
        className="relative overflow-hidden rounded-xl border border-border bg-muted bg-cover bg-center p-2 sm:p-4"
        style={{ backgroundImage: `url(${BACKDROP_POSTER})` }}
      >
        <video
          src={BACKDROP}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none absolute inset-0 size-full object-cover motion-reduce:hidden"
        />
        <video
          ref={ref}
          src={VIDEO}
          poster={POSTER}
          width={1280}
          height={800}
          controls
          muted
          playsInline
          preload={autoPlay ? "auto" : "metadata"}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
          aria-label="Narrated walkthrough of Scribe: subjects, notes, study sessions and the planner"
          className="relative aspect-[16/10] w-full rounded-lg border border-border bg-card"
        />
        {muted && (
          <button
            type="button"
            onClick={unmute}
            className="absolute right-3.5 top-3.5 inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[12px] font-semibold text-foreground hover:border-border-strong sm:right-6 sm:top-6 sm:h-9 sm:px-3.5 sm:text-[13px]"
          >
            <Volume2 className="size-4" /> Turn sound on
          </button>
        )}
      </div>
      <ol className="mt-3 flex flex-wrap gap-1.5">
        {CHAPTERS.map((c, i) => (
          <li key={c.title}>
            <button
              type="button"
              onClick={() => jump(c.at)}
              aria-current={i === active ? "step" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors",
                i === active ? "border-accent bg-accent-soft text-accent" : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
              )}
            >
              <span className="tabular-nums opacity-70">{i + 1}</span>
              {c.title}
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-2.5 min-h-[40px] text-[14px] leading-snug text-foreground/80">{CHAPTERS[active].text}</p>
    </div>
  );
}

/** Mounted once in the shell: the walkthrough dialog, opened by `requestAppTour()` or `<AppTourAuto />`. */
export function AppTourHost() {
  const isOpen = useSyncExternalStore(subscribe, () => open, () => false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAppTour();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/30 p-4" onClick={closeAppTour}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-tour-title"
        className="w-full max-w-[720px] rounded-2xl border border-border bg-card p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="app-tour-title" className="text-[20px] font-bold tracking-tight">How Scribe works</h2>
            <p className="mt-0.5 text-[13.5px] text-muted-foreground">50 seconds: subjects, your notes, study sessions and the planner.</p>
          </div>
          <button type="button" onClick={closeAppTour} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-lg text-faint hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <TourVideo autoPlay />
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={closeAppTour} className="inline-flex h-10 items-center rounded-xl bg-accent px-5 text-[14px] font-semibold text-white hover:bg-accent-dim">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shows the walkthrough once to someone who has not seen it (rendered on Home for people past first-run). */
export function AppTourAuto() {
  useEffect(() => {
    if (!hasSeenAppTour()) requestAppTour();
  }, []);
  return null;
}
