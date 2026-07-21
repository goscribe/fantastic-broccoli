import { cn } from "@/lib/utils";

/** Paper-sheet chrome shared by study guides, bank items and flashcards. */
export const paperClass =
  "rounded-sm border border-border-strong/60 bg-paper shadow-lg";

/**
 * A sheet of paper with a few more sheets fanned out behind it,
 * matching the study-guide A4 stack aesthetic.
 */
export function PaperStack({
  depth = 2,
  className,
  sheetClassName,
  children,
}: {
  depth?: number;
  className?: string;
  sheetClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("relative", className)}>
      {Array.from({ length: Math.max(0, depth) }).map((_, d) => (
        <div
          key={d}
          aria-hidden
          className="absolute inset-0 rounded-sm border border-border-strong/60 bg-paper shadow-md"
          style={{
            transform: `translateY(${(d + 1) * 5}px) rotate(${
              (d % 2 === 0 ? 1 : -1) * (d + 1) * 0.9
            }deg)`,
            zIndex: -(d + 1),
          }}
        />
      ))}
      <div className={cn("relative", paperClass, sheetClassName)}>
        {children}
      </div>
    </div>
  );
}
