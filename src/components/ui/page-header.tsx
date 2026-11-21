import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Mascot, type MascotPose } from "@/components/rewards/mascot";

/** One header for every utility page: optional back link / eyebrow, 26px title, muted subtitle, actions on the right. */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  back,
  actions,
  className,
  mascot,
}: {
  /** Optional cat standing beside the title (the redesign's livelier pages). */
  mascot?: MascotPose;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: string;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("life-rise mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex min-w-0 items-center gap-3.5">
        {mascot && (
          <Mascot pose={mascot} className="cat-peek h-[68px] shrink-0 self-end" />
        )}
        <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-[12px] font-semibold text-faint hover:text-accent">
            <ArrowLeft className="size-3.5" />
            {back.label}
          </Link>
        )}
        {eyebrow && !back && <div className="text-[12px] font-semibold text-faint">{eyebrow}</div>}
        <h1 className={cn("text-[26px] leading-tight tracking-tight", mascot ? "text-[30px] font-extrabold sm:text-[34px]" : "font-bold")}>{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Centred content column for utility pages (flashcards, shared, settings, review, pricing, export). */
export const pageShellClass = "mx-auto w-full max-w-[960px] px-6 pb-12 pt-6";
