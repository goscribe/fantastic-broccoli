import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** One header for every utility page: optional back link / eyebrow, 26px title, muted subtitle, actions on the right. */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  back,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: string;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-[12px] font-semibold text-faint hover:text-accent">
            <ArrowLeft className="size-3.5" />
            {back.label}
          </Link>
        )}
        {eyebrow && !back && <div className="text-[12px] font-semibold text-faint">{eyebrow}</div>}
        <h1 className="text-[26px] font-bold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Centred content column for utility pages (flashcards, shared, settings, review, pricing, export). */
export const pageShellClass = "mx-auto w-full max-w-[960px] px-6 pb-12 pt-6";
