import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Mascot, type MascotPose } from "@/components/rewards/mascot";

/** One header for every utility page: optional back link / eyebrow, the page title (.page-h1), muted subtitle, actions on the right. */
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
        <h1 className="page-h1 [overflow-wrap:anywhere]">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Centred content column (the admin pages). App pages use <PageShell>. */
export const pageShellClass = "mx-auto w-full max-w-[960px] px-6 pb-12 pt-6";

/**
 * The frame of every signed-in page that is not home or a subject: the SAME
 * outer column as home (max 1180, same gutters and top padding), so page
 * titles start on one left edge whatever the page. Content is left-aligned in
 * it and capped at `max` (a reading width for lists and forms).
 */
export function PageShell({
  children,
  max = "max-w-[960px]",
  className,
  as: Tag = "main",
}: {
  children: React.ReactNode;
  /** Tailwind max-width for the content column; "max-w-none" fills the frame. */
  max?: string;
  className?: string;
  as?: "main" | "div";
}) {
  return (
    <Tag className="mx-auto w-full max-w-[1180px] px-4 pb-12 pt-5 sm:px-6 sm:pt-6">
      <div className={cn("w-full", max, className)}>{children}</div>
    </Tag>
  );
}

/** A section's title inside a page: one size and weight everywhere (.page-h2), optional aside on the right. */
export function SectionTitle({ children, aside, className, id }: { children: React.ReactNode; aside?: React.ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn("mb-3 flex items-baseline justify-between gap-3", className)}>
      <h2 id={id} className="page-h2">{children}</h2>
      {aside}
    </div>
  );
}
