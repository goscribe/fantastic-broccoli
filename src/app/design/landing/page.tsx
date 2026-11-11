import { LandingBody } from "@/components/design/landing-page";

const NAV = ["Features", "How it works", "Pricing", "Blog"];
const NAVY = "#1e1b4b";

/** Static landing preview; production /landing renders the same LandingBody inside the site chrome. */
export default function LandingPreview() {
  return (
    <div className="design-root min-h-dvh w-full bg-white text-foreground">
      <header className="mx-auto flex h-[72px] w-full max-w-[1120px] items-center justify-between px-6">
        <span className="text-[22px] font-extrabold tracking-tight text-accent">scribe</span>
        <nav className="hidden gap-8 text-[14px] font-bold text-muted-foreground md:flex">{NAV.map((n) => <span key={n}>{n}</span>)}</nav>
        <span className="inline-flex h-11 items-center rounded-xl bg-accent px-5 text-[13px] font-bold text-white shadow-[0_4px_0_0_rgba(0,0,0,.14)]">Get started</span>
      </header>
      <LandingBody />
      <footer style={{ background: NAVY }} className="text-white/70"><div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-4 px-6 py-8 text-[13px]"><span className="text-[18px] font-extrabold text-white">scribe</span><div className="flex gap-6 font-semibold">{["Features", "Pricing", "Blog", "Privacy", "Terms"].map((l) => <span key={l}>{l}</span>)}</div><span>© 2026 Scribe</span></div></footer>
    </div>
  );
}
