"use client";

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { useHydrated } from "./reading-store";

/**
 * A worked example you can try first: the problem, then the steps on a line,
 * shown one at a time. The server HTML (and the page with JavaScript off)
 * has every step and the answer in plain view; once this hydrates, the steps
 * after the first are blurred in place until asked for, so revealing one
 * never moves the page.
 */
export function WorkedExample({ title, problem, steps, answer }: { title: ReactNode; problem: ReactNode; steps: ReactNode[]; answer: ReactNode }) {
  const hydrated = useHydrated();
  // Steps shown; steps.length + 1 means the answer too.
  const [shown, setShown] = useState(1);
  const all = steps.length + 1;
  const visible = hydrated ? shown : all;
  const done = visible >= all;
  return (
    <div className="nl-card overflow-hidden" data-nl-reveal="">
      <div className="flex items-center gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="min-w-0">
          <p className="text-small font-extrabold text-muted-foreground">Worked example</p>
          <p className="text-read font-extrabold text-foreground">{title}</p>
        </div>
      </div>
      <div className="nl-well mx-4 mt-3 px-4 py-3 text-read font-semibold text-foreground sm:mx-6">{problem}</div>
      <ol className="nl-steps mt-4 px-4 text-read sm:px-6">
        {steps.map((st, i) => (
          <li key={i} data-veiled={hydrated ? String(i >= visible) : undefined}>
            <span className="nl-stepnum" aria-hidden="true">
              {i + 1}
            </span>
            <div className="nl-veil min-w-0 flex-1 pt-0.5">{st}</div>
          </li>
        ))}
      </ol>
      <div className="mx-4 flex gap-3 rounded-[var(--r-control)] bg-[var(--flame-soft)] px-4 py-3 sm:mx-6" data-veiled={hydrated ? String(!done) : undefined}>
        <span className="nl-stepnum !bg-foreground !text-white" aria-hidden="true">
          <Check className="size-4" strokeWidth={3.5} />
        </span>
        <p className="nl-veil min-w-0 flex-1 pt-0.5 text-read text-foreground">
          <span className="font-extrabold">Answer: </span>
          {answer}
        </p>
      </div>
      <div className="flex min-h-[72px] flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-4 pt-3 sm:px-6">
        {hydrated &&
          (done ? (
            <button type="button" onClick={() => setShown(1)} className="nl-btn-ghost nl-btn-sm">
              Hide the steps and try it yourself
            </button>
          ) : (
            <>
              <button type="button" onClick={() => setShown((s) => s + 1)} className="nl-btn nl-btn-sm">
                {visible >= steps.length ? "Show the answer" : `Show step ${visible + 1}`}
              </button>
              <button type="button" onClick={() => setShown(all)} className="inline-flex min-h-10 items-center gap-1.5 text-[14.5px] font-extrabold text-foreground underline decoration-border-strong underline-offset-4">
                Show all
              </button>
              <span className="ml-auto text-small font-bold tabular-nums text-faint">
                {Math.min(visible, steps.length)}/{steps.length}
              </span>
            </>
          ))}
      </div>
    </div>
  );
}
