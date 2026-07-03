import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "muted"
  | "violet"
  | "sky"
  | "energy";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-foreground/10 text-foreground",
  accent: "bg-accent-soft text-accent border border-accent/15",
  energy: "bg-energy-soft text-energy border border-energy/20",
  success: "bg-success/10 text-success border border-success/20",
  warning: "bg-warning/10 text-warning border border-warning/20",
  violet: "bg-violet/10 text-violet border border-violet/20",
  sky: "bg-sky/10 text-sky border border-sky/20",
  muted: "bg-muted text-muted-foreground border border-border",
};

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
