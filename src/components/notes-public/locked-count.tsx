import { Lock } from "lucide-react";

/** "12 HL topics with a plan · the rest are free", on the subject band of a course or unit page. */
export function LockedCount({ label }: { label: string }) {
  return (
    <p className="nl-rise mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/[0.18] px-3 py-1 text-[13px] font-bold text-white" style={{ "--i": 3 } as React.CSSProperties}>
      <Lock className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
      {label} · the rest are free
    </p>
  );
}
