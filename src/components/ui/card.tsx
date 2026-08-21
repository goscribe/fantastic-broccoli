import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  interactive?: boolean;
}

export function Card({
  children,
  className,
  interactive = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5",
        interactive &&
          "cursor-pointer transition-all duration-150 hover:border-border-strong hover:-translate-y-0.5 active:translate-y-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  muted?: boolean;
}

/** Bordered inline surface for nested content (notes, chips, readouts). */
export function Surface({
  children,
  className,
  muted = false,
  ...props
}: SurfaceProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border",
        muted ? "bg-muted/50" : "bg-card",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-3", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-semibold leading-tight tracking-tight", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted-foreground mt-1", className)} {...props}>
      {children}
    </p>
  );
}
