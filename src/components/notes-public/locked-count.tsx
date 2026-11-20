import { Lock } from "lucide-react";

/** "12 HL topics with a plan · the rest are free", under a course or unit heading. */
export function LockedCount({ label }: { label: string }) {
  return (
    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[13px] font-semibold text-muted-foreground">
      <Lock className="size-3.5" aria-hidden="true" />
      {label} · the rest are free
    </p>
  );
}
