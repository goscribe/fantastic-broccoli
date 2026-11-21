import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { FAMILY_ART_SIZE, familyArtSrc, familyVars, hueFamilyFor, resolveSubjectFamily, type SubjectFamily } from "@/lib/subject-family";
import { cn } from "@/lib/utils";

/** The family illustration, positioned by the tile/band it sits in. Decorative. */
export function SubjectArt({ family, eager = false, neutral = false, className }: { family: SubjectFamily; eager?: boolean; /** The art sits on a hue that is not its own: drawn white-grey. */ neutral?: boolean; className?: string }) {
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
      className={cn("subject-tile__art", neutral && "subject-tile__art--neutral", className)}
    />
  );
}

export interface SubjectTileProps {
  /** Shown as the title; also picks the family unless `family`, `stored` or `match` is given. */
  title: ReactNode;
  /** Text to pick the family from when the title is not a plain subject name. */
  match?: string;
  family?: SubjectFamily;
  /** The family the server stored for this subject (`Workspace.subjectFamily`); wins over the name rules. */
  stored?: string | null;
  /** A stable key (the workspace id) that gives a subject matching no family its own hue. */
  seed?: string;
  sub?: ReactNode;
  /** A small badge before the second line: the course a subject follows ("IB Biology · HL"). */
  badge?: string;
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
 *
 * Titles are whatever the student (or an upload's file name) made them, so
 * the tile's height is fixed and never follows the text: the title clamps to
 * two lines, the line under it to one, and the art is sized from the tile.
 */
export function SubjectTile({ title, match, family, stored, seed, sub, badge, action, progress, row, trailing, href, onClick, disabled, eager, className, style }: SubjectTileProps) {
  const text = typeof title === "string" ? title.trim() : null;
  const fam = family ?? resolveSubjectFamily(stored, match ?? text ?? "");
  const neutral = hueFamilyFor(fam, seed) !== fam;
  // An empty name still gets a tile you can read and tap.
  const shownTitle = text === "" ? "Untitled" : title;
  // A long name steps down a size before it clamps, so more of it is read.
  const long = (text ?? match ?? "").length > 22;
  const subLine =
    badge || sub ? (
      <>
        {badge && <span className="mr-1.5 inline-block rounded-full bg-white/25 px-2 py-px align-[1px] text-[11px] font-extrabold leading-[16px] text-white">{badge}</span>}
        {sub}
      </>
    ) : null;
  const body = (
    <>
      <SubjectArt family={fam} eager={eager} neutral={neutral} />
      {row ? (
        <span className="flex w-full items-center gap-3">
          <span className="subject-tile__text min-w-0 flex-1">
            <span className="subject-tile__title text-[16px] font-extrabold leading-snug text-white">{shownTitle}</span>
            {subLine && <span className="subject-tile__sub subject-tile__sub--line mt-0.5 block text-[12.5px] font-semibold leading-snug">{subLine}</span>}
          </span>
        </span>
      ) : (
        <>
          <span className="subject-tile__text block">
            {/* No display utility here: `block` would undo the clamp (it is what let real titles run to five lines). */}
            <span className={cn("subject-tile__title font-extrabold text-white", long ? "text-[16px] leading-[1.22] sm:text-[16.5px]" : "text-[19px] leading-[1.18] sm:text-[20px]")}>{shownTitle}</span>
            {subLine && <span className="subject-tile__sub subject-tile__sub--line mt-1 block text-[13px] font-semibold leading-snug">{subLine}</span>}
          </span>
          <span className="block shrink-0">
            {progress != null && (
              <span className="subject-track mb-2.5 block w-[52%]" aria-hidden>
                <span className="fill-grow" style={{ width: `${Math.min(100, Math.max(progress > 0 ? 6 : 0, progress * 100))}%` }} />
              </span>
            )}
            {action && (
              <span className="subject-pill">
                <span className="truncate">{action}</span>
                <ChevronRight className="size-4 shrink-0" strokeWidth={2.6} />
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
    row ? "subject-tile--row min-h-[76px] w-full justify-center px-4 py-3" : "h-[156px] p-[18px] sm:h-[176px] sm:p-5",
    disabled && "opacity-70",
    className,
  );
  const vars = { ...familyVars(fam, seed), ...style } as CSSProperties;
  if (href) {
    return (
      <Link href={href} className={cls} style={vars} onClick={onClick} title={text && text.length > 22 ? text : undefined}>
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
export function SubjectBand({ match, family, stored, seed, children, className, artClassName, eager = true }: { match?: string; family?: SubjectFamily; /** As on SubjectTile: the family the server stored for the subject. */ stored?: string | null; /** As on SubjectTile: keeps an unmatched subject the colour its tile had. */ seed?: string; children: ReactNode; className?: string; artClassName?: string; eager?: boolean }) {
  const fam = family ?? resolveSubjectFamily(stored, match);
  return (
    <div className={cn("subject-band", className)} style={familyVars(fam, seed) as CSSProperties}>
      <SubjectArt family={fam} eager={eager} neutral={hueFamilyFor(fam, seed) !== fam} className={artClassName} />
      {children}
    </div>
  );
}
