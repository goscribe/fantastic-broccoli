import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { FAMILY_ART_SIZE, familyArtSrc, familyFor, familyVars, type SubjectFamily } from "@/lib/subject-family";
import { cn } from "@/lib/utils";

/** The family illustration, positioned by the tile/band it sits in. Decorative. */
export function SubjectArt({ family, eager = false, className }: { family: SubjectFamily; eager?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={familyArtSrc(family)}
      alt=""
      width={FAMILY_ART_SIZE}
      height={FAMILY_ART_SIZE}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={cn("subject-tile__art", className)}
    />
  );
}

export interface SubjectTileProps {
  /** Shown as the title; also picks the family unless `family` or `match` is given. */
  title: ReactNode;
  /** Text to pick the family from when the title is not a plain subject name. */
  match?: string;
  family?: SubjectFamily;
  sub?: ReactNode;
  /** Label for the white pill ("Continue", "Open"). */
  action?: ReactNode;
  /** 0–1: draws a white track above the pill. */
  progress?: number | null;
  /** A short row (phone lists, the course picker) instead of a card. */
  row?: boolean;
  /** Replaces the row's chevron (a spinner, a badge). */
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Above the fold: load the art eagerly. */
  eager?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * A subject or course as a full-bleed tile in its family's colour with its
 * illustration bleeding off the right edge: the app's colour carrier. White
 * title, white pill action, progress on the card when there is some.
 */
export function SubjectTile({ title, match, family, sub, action, progress, row, trailing, href, onClick, disabled, eager, className, style }: SubjectTileProps) {
  const fam = family ?? familyFor(match ?? (typeof title === "string" ? title : ""));
  const body = (
    <>
      <SubjectArt family={fam} eager={eager} />
      {row ? (
        <span className="flex w-full items-center gap-3">
          <span className="subject-tile__text min-w-0 flex-1">
            <span className="block text-[16px] font-extrabold leading-snug">{title}</span>
            {sub && <span className="subject-tile__sub mt-0.5 block text-[12.5px] font-semibold leading-snug">{sub}</span>}
          </span>
        </span>
      ) : (
        <>
          <span className="subject-tile__text block">
            <span className="line-clamp-3 block text-[19px] font-extrabold leading-[1.18] sm:text-[20px]">{title}</span>
            {sub && <span className="subject-tile__sub mt-1 line-clamp-2 block text-[13px] font-semibold leading-snug">{sub}</span>}
          </span>
          <span className="mt-4 block">
            {progress != null && (
              <span className="subject-track mb-3 block w-[52%]" aria-hidden>
                <span className="fill-grow" style={{ width: `${Math.min(100, Math.max(progress > 0 ? 6 : 0, progress * 100))}%` }} />
              </span>
            )}
            {action && (
              <span className="subject-pill">
                {action}
                <ChevronRight className="size-4" strokeWidth={2.6} />
              </span>
            )}
          </span>
        </>
      )}
      {row && (trailing ?? <ChevronRight className="absolute right-3 top-1/2 size-5 -translate-y-1/2 opacity-0" aria-hidden />)}
    </>
  );
  const cls = cn(
    "subject-tile text-left",
    row ? "subject-tile--row min-h-[76px] w-full justify-center px-4 py-3" : "min-h-[156px] p-[18px] sm:min-h-[176px] sm:p-5",
    disabled && "opacity-70",
    className,
  );
  const vars = { ...familyVars(fam), ...style } as CSSProperties;
  if (href) {
    return (
      <Link href={href} className={cls} style={vars} onClick={onClick}>
        {body}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} style={vars}>
      {body}
    </button>
  );
}

/**
 * A header band in the subject's colour with its illustration (a course's
 * page, the picker once a course is chosen, the result screen). The body
 * under it stays white.
 */
export function SubjectBand({ match, family, children, className, artClassName, eager = true }: { match?: string; family?: SubjectFamily; children: ReactNode; className?: string; artClassName?: string; eager?: boolean }) {
  const fam = family ?? familyFor(match);
  return (
    <div className={cn("subject-band", className)} style={familyVars(fam) as CSSProperties}>
      <SubjectArt family={fam} eager={eager} className={artClassName} />
      {children}
    </div>
  );
}
