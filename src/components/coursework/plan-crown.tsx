import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one mark on a locked Coursework entry: a small crown in muted gold
 * (never the purple accent), meaning "comes with a plan". Decorative: the
 * entry's own text says it is locked.
 */
export function PlanCrown({ className }: { className?: string }) {
  return <Crown aria-hidden="true" data-plan-crown className={cn("size-3.5 shrink-0 text-[#a8842c]", className)} strokeWidth={2.2} />;
}
