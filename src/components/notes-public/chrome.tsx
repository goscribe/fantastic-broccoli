import Link from "next/link";
import { ScribeLogo } from "@/components/graphics/logo";
import { HeaderCta } from "./header-cta";

/** Slim header for the public note pages (server-rendered; only the account button is a client island). */
export function NotesHeader() {
  return (
    <header className="pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-[1120px] items-center justify-between gap-3 px-4 sm:h-[68px] sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/landing" aria-label="Scribe home">
            <ScribeLogo />
          </Link>
          <Link href="/notes" className="hidden rounded-full px-3 py-1.5 text-[14px] font-extrabold text-muted-foreground transition-colors hover:bg-accent-soft hover:text-accent sm:inline">
            Notes &amp; practice
          </Link>
        </div>
        <HeaderCta />
      </div>
    </header>
  );
}

export function NotesFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--edge)] py-10">
      <div className="mx-auto max-w-[1120px] px-4 text-[13px] text-muted-foreground sm:px-6">
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 font-semibold">
          <Link href="/notes" className="hover:text-foreground">All courses</Link>
          <Link href="/landing" className="hover:text-foreground">Scribe</Link>
          <Link href="/landing/how-it-works" className="hover:text-foreground">How it works</Link>
          <Link href="/landing/pricing" className="hover:text-foreground">Pricing</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
        </nav>
        <p className="mt-5 max-w-[640px] leading-snug text-faint">
          Notes and questions are written by Scribe in our own words. Topic codes follow the official course numbering so you
          can find your place. Not produced or endorsed by the IB, College Board, AQA, OCR, Pearson Edexcel or any exam board.
        </p>
        <p className="mt-3 text-faint">© 2026 Scribe</p>
      </div>
    </footer>
  );
}
