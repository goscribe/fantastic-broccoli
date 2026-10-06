import { AlertCircle, Check, Loader2, Mail } from "lucide-react";
import { IconTile } from "@/components/graphics/icon-tile";
import { cn } from "@/lib/utils";

export type AuthMood = "study" | "celebrate" | "mail" | "invite";
export type AuthFigureState = "idle" | "working" | "success" | "error";

/** Status tile used as the page figure on email-link screens. */
export function AuthFigure({
  state,
  className,
}: {
  state: AuthFigureState;
  className?: string;
}) {
  if (state === "working") {
    return (
      <span
        className={cn(
          "mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent",
          className,
        )}
        aria-hidden
      >
        <Loader2 className="h-5 w-5 animate-spin" />
      </span>
    );
  }
  return (
    <IconTile
      icon={state === "success" ? Check : state === "idle" ? Mail : AlertCircle}
      tone={state === "success" ? "emerald" : state === "idle" ? "purple" : "pink"}
      size="lg"
      className={cn("mx-auto", className)}
    />
  );
}

/** Shared login/signup/email-link chrome: plain white page, single column. */
export function AuthScene({
  children,
}: {
  children: React.ReactNode;
  mood?: AuthMood;
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-background px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <div className="relative z-10 w-full max-w-sm space-y-6 sm:space-y-8">
        {children}
      </div>
    </div>
  );
}
