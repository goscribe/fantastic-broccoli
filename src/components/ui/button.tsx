import { cn } from "@/lib/utils";
import { forwardRef } from "react";

/**
 * The app's buttons. One primary shape: the chunky accent button with a lip
 * that presses down (`.btn-chunky`, design.css), in three sizes. One secondary:
 * white with a hairline. `soft` is the quiet grey fill (e.g. "Review now"),
 * `ghost` a text button, `danger` a destructive secondary.
 *
 * Keyboard focus is the soft accent outline from tokens.css; this component
 * adds no ring of its own.
 *
 * For a link that should look like a button use `buttonClass()` on the <Link>.
 */
export type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "btn-chunky bg-accent text-white font-extrabold hover:bg-accent-dim",
  secondary: "border border-border bg-white text-foreground font-bold hover:border-border-strong hover:bg-muted active:scale-[0.98]",
  // Kept as a name for older call sites: same as `secondary`.
  outline: "border border-border bg-white text-foreground font-bold hover:border-border-strong hover:bg-muted active:scale-[0.98]",
  soft: "bg-muted text-foreground font-bold hover:bg-border active:scale-[0.98]",
  ghost: "text-muted-foreground font-bold hover:bg-muted hover:text-foreground active:scale-[0.98]",
  danger: "border border-rose-200 bg-white text-rose-600 font-bold hover:bg-rose-50 active:scale-[0.98]",
};

/** Height, padding, type size and radius step together; the radius is ~30% of the height. */
const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13.5px] rounded-[12px]",
  md: "h-11 px-5 text-[15px] rounded-[14px]",
  lg: "h-[52px] px-7 text-[16px] rounded-[16px]",
  icon: "size-10 rounded-[12px]",
};

/** The primary's lip is shallower on the small sizes so the button keeps its proportions. */
const lipClasses: Partial<Record<ButtonSize, string>> = {
  sm: "shadow-[0_3px_0_0_var(--accent-edge)] active:shadow-[0_1px_0_0_var(--accent-edge)]",
  md: "shadow-[0_3px_0_0_var(--accent-edge)] active:shadow-[0_1px_0_0_var(--accent-edge)]",
  icon: "shadow-[0_3px_0_0_var(--accent-edge)] active:shadow-[0_1px_0_0_var(--accent-edge)]",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  return cn(
    // Marker classes (no styles of their own): design.css uses them to keep the old landing's buttons as they were.
    `ui-btn ui-btn--${variant} ui-btn--${size}`,
    "inline-flex select-none items-center justify-center transition-[background-color,border-color,color,transform,box-shadow] duration-150",
    "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
    variantClasses[variant],
    sizeClasses[size],
    variant === "primary" && lipClasses[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => (
    <button ref={ref} className={buttonClass({ variant, size, className })} {...props} />
  ),
);
Button.displayName = "Button";
