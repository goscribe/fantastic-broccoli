import { cn } from "@/lib/utils";
import { forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-foreground font-bold shadow-[0_4px_0_0_var(--accent-dim)] hover:brightness-110 active:translate-y-[3px] active:shadow-none",
  secondary:
    "bg-muted text-foreground font-bold border border-border-strong shadow-[0_3px_0_0_var(--border-strong)] hover:bg-border active:translate-y-[3px] active:shadow-none",
  outline:
    "bg-card text-foreground font-bold border-2 border-border-strong shadow-[0_3px_0_0_var(--border-strong)] hover:border-accent hover:text-accent active:translate-y-[3px] active:shadow-none",
  ghost: "text-muted-foreground hover:text-foreground hover:bg-muted",
  danger:
    "bg-rose/10 text-rose font-bold border border-rose/30 shadow-[0_3px_0_0_color-mix(in_srgb,var(--rose)_45%,transparent)] hover:bg-rose/20 active:translate-y-[3px] active:shadow-none",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm rounded-2xl",
  md: "h-11 px-5 text-sm rounded-2xl",
  lg: "h-12 px-7 text-base rounded-2xl",
  icon: "h-10 w-10 rounded-2xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-[transform,box-shadow,filter,background-color,border-color,color] duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:opacity-40 disabled:pointer-events-none",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        disabled={disabled}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
