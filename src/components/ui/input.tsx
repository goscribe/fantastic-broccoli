import { cn } from "@/lib/utils";
import { forwardRef } from "react";

/** One field look for the whole app: 40px, 12px radius, 1px border, violet focus. */
export const inputClass =
  "h-10 w-full rounded-xl border border-border bg-card px-3.5 text-[14px] text-foreground transition-colors placeholder:text-faint focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:text-muted-foreground";

export const textareaClass =
  "w-full resize-none rounded-xl border border-border bg-card px-3.5 py-2.5 text-[14px] leading-relaxed text-foreground transition-colors placeholder:text-faint focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:text-muted-foreground";

/** Container for composed fields (icon/avatar + bare input + send button). Children use `bareInputClass`. */
export const inputBoxClass =
  "flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15";

export const bareInputClass =
  "min-w-0 flex-1 bg-transparent text-[14px] text-foreground placeholder:text-faint focus:outline-none";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(inputClass, className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(textareaClass, className)} {...props} />,
);
Textarea.displayName = "Textarea";
