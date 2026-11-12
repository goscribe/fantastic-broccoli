import Image from "next/image";
import { cn } from "@/lib/utils";

/** One empty state everywhere: bordered card, flat cat, title, one line of help, optional action. */
export function EmptyState({
  cat = "wave",
  title,
  body,
  action,
  className,
}: {
  cat?: "wave" | "book" | "sleep" | "think" | "trophy" | "cheer";
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card px-6 py-10 text-center", className)}>
      <Image src={`/design/cat2-${cat}.png`} alt="" width={120} height={110} unoptimized className="mx-auto h-[96px] w-auto select-none" />
      <div className="mt-4 text-[16px] font-semibold">{title}</div>
      {body && <p className="mx-auto mt-1 max-w-md text-[14px] text-muted-foreground">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
