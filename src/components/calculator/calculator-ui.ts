/** Styles the calculator's three modes share, so Graph and Stats look like the same device as Calculate. */
import { cn } from "@/lib/utils";

export const chipClass = (on: boolean) =>
  cn(
    "h-9 touch-manipulation whitespace-nowrap rounded-[10px] border px-2.5 text-small font-bold transition-colors disabled:opacity-40",
    on ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:bg-muted",
  );

/** The calculator's display: the part that reads like a screen, shared by all three modes. */
export const SCREEN =
  "rounded-2xl border border-border bg-[color-mix(in_srgb,var(--muted)_55%,var(--card))] shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]";

/** A text field inside the calculator. */
export const FIELD =
  "h-11 rounded-xl border border-border bg-card px-3 text-ui tabular-nums text-foreground placeholder:text-faint focus:border-foreground focus:outline-none";
