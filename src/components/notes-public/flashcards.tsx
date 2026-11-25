"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Lightbulb, Lock, RotateCcw, RotateCw, Shuffle, X } from "lucide-react";
import { useAuthUser } from "@/lib/api/auth";
import { trackNoteEvent } from "@/lib/api/public-notes";
import { FREE_FLASHCARDS, type FlashcardKind, type FlashcardSet, type RenderedFlashcard } from "@/lib/notes-public/flashcard-deck";
import { cn } from "@/lib/utils";
import { Confetti, Sparkles } from "./practice";

/**
 * The flashcard deck on a topic page: a stack of cards that flip with a bouncy
 * 3D turn, then fly off right ("Got it") or left ("Still learning") by button,
 * arrow key or swipe. Cards you are still learning come round again. The first
 * three cards are free (in the page's HTML); the rest come from
 * /api/notes-flashcards once the visitor is signed in, and until then the last
 * card in the stack is a sign-in card. Card text arrives as HTML rendered on
 * the server (maths included), so no KaTeX ships to the browser.
 */

type Result = "got" | "again";

const KIND_LABEL: Record<FlashcardKind, string> = {
  term: "Key term",
  concept: "Concept",
  formula: "Formula",
  process: "Process",
  mistake: "Common mistake",
  example: "Try it",
};

const SWIPE = 90;
const EXIT_MS = 380;

function useDeckCards(courseId: string, topicId: string, initial: FlashcardSet | null | undefined) {
  const { user, loading } = useAuthUser();
  const [set, setSet] = useState<FlashcardSet | null | undefined>(initial);
  const [failed, setFailed] = useState(false);
  const signedIn = !!user;
  const needAll = signedIn && (set === undefined || (!!set && set.cards.length < set.total));
  const needPreview = !loading && !signedIn && set === undefined;
  const fetching = (needAll || needPreview) && !failed;
  useEffect(() => {
    if (!fetching) return;
    let live = true;
    fetch(`/api/notes-flashcards/${encodeURIComponent(courseId)}/${encodeURIComponent(topicId)}${needAll ? "?all=1" : ""}`)
      .then((r) => {
        // No deck for this topic: nothing to show.
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<FlashcardSet>;
      })
      .then((s) => {
        if (live) setSet((old) => s ?? old ?? null);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [courseId, topicId, needAll, fetching]);
  const gate: GateState = fetching || loading ? "loading" : signedIn ? "error" : "signin";
  return { set, signedIn, gate };
}

type GateState = "loading" | "signin" | "error";

export function Flashcards({
  courseId,
  topicId,
  topicName,
  initial,
  signupHref,
  loginHref,
}: {
  courseId: string;
  topicId: string;
  topicName: string;
  /** The free cards, server-rendered into the page; absent in the in-app reader (it fetches). */
  initial?: FlashcardSet | null;
  signupHref: string;
  loginHref: string;
}) {
  const { set, signedIn, gate } = useDeckCards(courseId, topicId, initial);
  if (!set || set.cards.length === 0) return null;
  return (
    <section id="flashcards" className="mt-16 scroll-mt-4" aria-labelledby="h-flashcards">
      <div className="nl-panel relative overflow-hidden px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8" data-nl-reveal="">
        <Image src="/design/cat3-book.webp" alt="" width={363} height={400} unoptimized loading="lazy" className="absolute -bottom-2 right-3 h-[92px] w-auto sm:right-7 sm:h-[132px]" />
        <h2 id="h-flashcards" className="pr-[84px] text-[30px] font-black leading-[1.05] text-foreground sm:pr-[120px] sm:text-[38px]">
          Flashcards
        </h2>
        <p className="mt-2.5 max-w-[440px] pr-[84px] text-read font-semibold text-foreground/75 sm:pr-[120px]">
          {set.total} cards on {topicName}. Flip each one, then say whether you knew it. The ones you are still learning come round again.
          {set.cards.length < set.total && !signedIn ? ` The first ${FREE_FLASHCARDS} are free; sign in to study all ${set.total}.` : ""}
        </p>
      </div>
      <Deck
        key={set.cards.length}
        courseId={courseId}
        topicId={topicId}
        cards={set.cards}
        total={set.total}
        locked={set.cards.length < set.total}
        gateState={gate}
        signupHref={signupHref}
        loginHref={loginHref}
      />
    </section>
  );
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Deck({
  courseId,
  topicId,
  cards,
  total,
  locked,
  gateState,
  signupHref,
  loginHref,
}: {
  courseId: string;
  topicId: string;
  cards: RenderedFlashcard[];
  total: number;
  locked: boolean;
  gateState: GateState;
  signupHref: string;
  loginHref: string;
}) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const [order, setOrder] = useState(() => cards.map((c) => c.id));
  const [pos, setPos] = useState(0);
  const [round, setRound] = useState(1);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [flipped, setFlipped] = useState(false);
  const [hint, setHint] = useState(false);
  const [exiting, setExiting] = useState<Result | null>(null);
  const [dx, setDx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [burst, setBurst] = useState(0);
  const [everFlipped, setEverFlipped] = useState(false);
  const drag = useRef<{ x: number; id: number; moved: boolean } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLButtonElement>(null);
  // Keyboard users stay on the deck: focus moves to the card when the button they pressed goes away.
  const focusCard = useRef(false);
  useEffect(() => {
    if (!focusCard.current) return;
    focusCard.current = false;
    cardRef.current?.focus({ preventScroll: true });
  }, [pos, round, flipped]);
  const holdFocus = () => {
    focusCard.current = !!stageRef.current?.contains(document.activeElement);
  };

  const current = pos < order.length ? byId.get(order[pos]) : undefined;
  const roundDone = pos >= order.length;
  const again = order.filter((id) => results[id] === "again");
  const gotCount = cards.filter((c) => results[c.id] === "got").length;
  const showGate = roundDone && locked && round === 1;

  const decide = useCallback(
    (r: Result) => {
      if (!current || exiting || !flipped) return;
      holdFocus();
      setExiting(r);
      setResults((old) => ({ ...old, [current.id]: r }));
      if (r === "got") {
        setStreak((s) => s + 1);
        setBurst((b) => b + 1);
      } else setStreak(0);
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.setTimeout(() => {
        setPos((p) => p + 1);
        setFlipped(false);
        setHint(false);
        setExiting(null);
        setDx(0);
      }, still ? 0 : EXIT_MS);
    },
    [current, exiting, flipped],
  );

  const flip = () => {
    if (exiting) return;
    holdFocus();
    setFlipped((f) => !f);
    setEverFlipped(true);
  };

  const restart = (ids: string[], keep: boolean) => {
    setOrder(ids);
    setPos(0);
    setRound((r) => r + 1);
    setFlipped(false);
    setHint(false);
    setStreak(0);
    if (!keep) setResults({});
    stageRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!flipped) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      decide("got");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      decide("again");
    }
  };

  // Swipe: the card follows the finger; past the threshold (once flipped) it is decided.
  const onPointerDown = (e: PointerEvent) => {
    if (exiting || e.button !== 0) return;
    drag.current = { x: e.clientX, id: e.pointerId, moved: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const x = e.clientX - d.x;
    if (!d.moved && Math.abs(x) > 8) {
      d.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (d.moved) setDx(flipped ? x : x * 0.25);
  };
  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return;
    e.preventDefault();
    if (flipped && Math.abs(dx) > SWIPE) decide(dx > 0 ? "got" : "again");
    else setDx(0);
  };

  const tilt = exiting ? undefined : ({ "--dx": `${dx}px`, "--rot": `${dx / 18}deg` } as CSSProperties);
  const dragging = dx !== 0 && !exiting;
  // Cards still waiting under the top one (the sign-in card counts as one).
  const behind = Math.min(2, order.length - pos - 1 + (locked && round === 1 ? 1 : 0));

  return (
    <div className="mt-5" ref={stageRef} onKeyDown={onKeyDown}>
      <Progress cards={cards} total={total} order={order} pos={pos} round={round} results={results} />

      <div className="nl-fc-stage mt-4">
        {/* The stack: up to two cards peek out under the top one. */}
        {!roundDone &&
          Array.from({ length: Math.max(0, behind) }, (_, i) => (
            <div key={`peek-${i}`} aria-hidden="true" className="nl-fc-peek" style={{ "--depth": i + 1 } as CSSProperties} />
          ))}

        {current && (
          <div
            key={`${round}-${current.id}`}
            className={cn("nl-fc-card", exiting === "got" && "nl-fc-out-right", exiting === "again" && "nl-fc-out-left", dragging && "nl-fc-dragging", !everFlipped && pos === 0 && round === 1 && "nl-fc-nudge")}
            style={tilt}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              drag.current = null;
              setDx(0);
            }}
          >
            <span className="nl-fc-stamp" data-dir="got" style={{ opacity: flipped ? Math.min(1, Math.max(0, dx / SWIPE)) : 0 }} aria-hidden="true">
              Got it
            </span>
            <span className="nl-fc-stamp" data-dir="again" style={{ opacity: flipped ? Math.min(1, Math.max(0, -dx / SWIPE)) : 0 }} aria-hidden="true">
              Again
            </span>
            <button
              ref={cardRef}
              type="button"
              className="nl-fc-inner"
              data-flipped={flipped}
              onClick={(e) => {
                if (e.detail > 0 && dx !== 0) return;
                flip();
              }}
            >
              <span className="nl-fc-face" aria-hidden={flipped} inert={flipped}>
                <CardTop card={current} n={pos + 1} of={order.length} round={round} />
                <span className="nl-fc-text text-[21px] font-extrabold leading-snug text-foreground sm:text-[24px]">
                  <span dangerouslySetInnerHTML={{ __html: current.front }} />
                </span>
                <span className="flex items-center justify-center gap-1.5 text-small font-bold text-muted-foreground">
                  <RotateCw className="size-3.5" strokeWidth={2.75} aria-hidden="true" /> Tap to flip<span className="sr-only"> and see the answer</span>
                </span>
              </span>
              <span className="nl-fc-face nl-fc-back" aria-hidden={!flipped} inert={!flipped}>
                <CardTop card={current} n={pos + 1} of={order.length} round={round} answer />
                <span className="nl-fc-text text-read font-semibold leading-relaxed text-foreground">
                  <span dangerouslySetInnerHTML={{ __html: current.back }} />
                </span>
                <span className="flex items-center justify-center gap-1.5 text-small font-bold text-muted-foreground">
                  <RotateCcw className="size-3.5" strokeWidth={2.75} aria-hidden="true" /> Tap to see the question
                </span>
              </span>
            </button>
          </div>
        )}

        {showGate && <SignInCard courseId={courseId} topicId={topicId} remaining={total - cards.length} state={gateState} signupHref={signupHref} loginHref={loginHref} got={gotCount} />}

        {roundDone && !showGate && <DoneCard total={cards.length} got={gotCount} again={again.length} onAgain={() => restart(again, true)} onRestart={() => restart(shuffle(cards.map((c) => c.id)), false)} />}

        {burst > 0 && (
          <span key={burst} className="pointer-events-none absolute left-1/2 top-2 -ml-5" aria-hidden="true">
            <Sparkles />
          </span>
        )}
      </div>

      {current && (
        <div className="mt-5 flex min-h-[48px] flex-wrap items-center justify-center gap-3">
          {!flipped ? (
            <>
              <button type="button" onClick={flip} className="nl-btn min-w-[180px]">
                Show answer
              </button>
              {current.hint &&
                (hint ? (
                  <p className="nl-up w-full text-center text-ui font-semibold text-foreground/80 sm:w-auto">
                    <Lightbulb className="mr-1 inline size-4 text-[var(--flame)]" strokeWidth={2.5} aria-hidden="true" />
                    <span dangerouslySetInnerHTML={{ __html: current.hint }} />
                  </p>
                ) : (
                  <button type="button" onClick={() => setHint(true)} className="nl-btn-ghost">
                    <Lightbulb className="size-4" strokeWidth={2.5} aria-hidden="true" /> Hint
                  </button>
                ))}
            </>
          ) : (
            <>
              <button type="button" onClick={() => decide("again")} className="nl-btn-ghost nl-fc-choice min-w-[150px]" data-dir="again">
                <X className="size-4" strokeWidth={3} aria-hidden="true" /> Still learning
              </button>
              <button type="button" onClick={() => decide("got")} className="nl-btn nl-fc-choice min-w-[150px]" data-dir="got">
                <Check className="size-4" strokeWidth={3} aria-hidden="true" /> Got it
              </button>
            </>
          )}
        </div>
      )}
      {current && (
        <p className="mt-2 min-h-5 text-center text-small font-semibold text-muted-foreground">
          {streak >= 2 ? (
            <span key={streak} className="nl-pop inline-block font-extrabold text-[var(--flame-ink)]">
              {streak} in a row
            </span>
          ) : flipped ? (
            <span className="hidden sm:inline">Swipe, or use ← and → on your keyboard</span>
          ) : null}
        </p>
      )}
    </div>
  );
}

function CardTop({ card, n, of, round, answer }: { card: RenderedFlashcard; n: number; of: number; round: number; answer?: boolean }) {
  return (
    <span className="flex items-center justify-between gap-3 text-small font-extrabold">
      <span className="nl-fc-kind" data-kind={card.kind}>
        {answer ? "Answer" : KIND_LABEL[card.kind]}
      </span>
      <span className="tabular-nums text-muted-foreground">
        {round > 1 ? "Again · " : ""}
        {n} / {of}
      </span>
    </span>
  );
}

function Progress({ cards, total, order, pos, round, results }: { cards: RenderedFlashcard[]; total: number; order: string[]; pos: number; round: number; results: Record<string, Result> }) {
  const lockedCount = total - cards.length;
  const currentId = order[pos];
  const got = cards.filter((c) => results[c.id] === "got").length;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-ui font-extrabold">
        <span aria-live="polite">
          <span className="text-[22px] font-black tabular-nums text-foreground">{got}</span>
          <span className="text-muted-foreground"> of {total} known</span>
        </span>
        {round > 1 && <span className="text-small font-bold text-muted-foreground">Round {round}</span>}
      </div>
      <ol className="nl-fc-meter mt-2" aria-hidden="true">
        {cards.map((c) => (
          <li key={c.id} data-s={results[c.id] ?? (c.id === currentId ? "now" : "open")} />
        ))}
        {Array.from({ length: lockedCount }, (_, i) => (
          <li key={`l${i}`} data-s="locked" />
        ))}
      </ol>
    </div>
  );
}

function SignInCard({ courseId, topicId, remaining, state, signupHref, loginHref, got }: { courseId: string; topicId: string; remaining: number; state: GateState; signupHref: string; loginHref: string; got: number }) {
  const shown = useRef(false);
  useEffect(() => {
    if (state !== "signin" || shown.current) return;
    shown.current = true;
    trackNoteEvent("notes.signup_prompt_shown", courseId, topicId, { answered: FREE_FLASHCARDS });
  }, [state, courseId, topicId]);
  const clicked = () => trackNoteEvent("notes.signup_clicked", courseId, topicId, { answered: FREE_FLASHCARDS });
  if (state === "error")
    return (
      <div className="nl-fc-card nl-fc-gate" role="alert">
        <div className="nl-fc-face items-center text-center">
          <p className="text-read font-extrabold text-foreground">We couldn&apos;t load the rest of the deck.</p>
          <button type="button" onClick={() => window.location.reload()} className="nl-btn-ghost">
            Reload the page
          </button>
        </div>
      </div>
    );
  if (state === "loading")
    return (
      <div className="nl-fc-card nl-fc-gate" aria-busy="true">
        <div className="nl-fc-face">
          <span className="mx-auto h-6 w-2/3 animate-pulse rounded bg-muted" />
          <span className="mx-auto h-6 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  return (
    <div className="nl-fc-card nl-fc-gate">
      <div className="nl-fc-face items-center text-center">
        <span className="nl-fc-lock mx-auto grid size-14 place-items-center rounded-full bg-foreground text-white" aria-hidden="true">
          <Lock className="size-6" strokeWidth={2.75} />
        </span>
        <div>
          <p className="text-[28px] font-black leading-[1.06] text-foreground sm:text-[36px]">
            {remaining} more {remaining === 1 ? "card" : "cards"} to go
          </p>
          <p className="mx-auto mt-2 max-w-[380px] text-ui font-semibold text-muted-foreground">
            {got > 0 ? `You knew ${got} of the first ${FREE_FLASHCARDS}. ` : ""}Create a free account to flip the whole deck. No plan needed.
          </p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-2.5 sm:flex-row sm:justify-center">
          <Link href={signupHref} onClick={clicked} className="nl-btn">
            Create a free account
          </Link>
          <Link href={loginHref} onClick={clicked} className="nl-btn-ghost">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

function DoneCard({ total, got, again, onAgain, onRestart }: { total: number; got: number; again: number; onAgain: () => void; onRestart: () => void }) {
  const perfect = again === 0;
  return (
    <div className="nl-fc-card nl-fc-done" role="status">
      <div className="nl-fc-face items-center text-center">
        <span className="relative mx-auto block h-[96px] w-[96px]">
          {perfect && <Confetti count={28} />}
          <Image src={perfect ? "/design/cat3-trophy.webp" : "/design/cat3-cheer.webp"} alt="" width={383} height={400} unoptimized className="nl-cat-in relative h-full w-auto" />
        </span>
        <div>
          <p className="text-[28px] font-black leading-[1.06] text-foreground sm:text-[36px]">{perfect ? "Deck done!" : "Round done!"}</p>
          <p className="mt-1.5 text-ui font-semibold text-muted-foreground">
            {perfect ? `You know all ${total} cards.` : `${got} of ${total} known. ${again} still to learn.`}
          </p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-2.5 sm:flex-row sm:justify-center">
          {!perfect && (
            <button type="button" onClick={onAgain} className="nl-btn">
              Go over the {again === 1 ? "last one" : `${again} again`}
            </button>
          )}
          <button type="button" onClick={onRestart} className={perfect ? "nl-btn" : "nl-btn-ghost"}>
            <Shuffle className="size-4" strokeWidth={2.75} aria-hidden="true" /> Shuffle and start over
          </button>
        </div>
      </div>
    </div>
  );
}
