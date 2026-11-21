"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ScribeLogo } from "@/components/graphics/logo";
import { Menu, X } from "lucide-react";

/** The header's primary action: the app's button, small. */
const headerCta =
  "btn-chunky items-center justify-center bg-accent px-5 text-[14.5px] font-extrabold text-white hover:bg-accent-dim h-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2";

const navLinks = [
  { href: "/landing", label: "Home" },
  { href: "/landing/features", label: "Features" },
  { href: "/landing/how-it-works", label: "How it works" },
  { href: "/landing/pricing", label: "Pricing" },
  { href: "/notes", label: "Free notes" },
  { href: "/landing/blog", label: "Blog" },
  { href: "/landing/about", label: "About" },
];

export function LandingHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-white pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-[60px] max-w-[1160px] items-center justify-between px-4 sm:h-[68px] sm:px-6">
        <Link href="/landing" onClick={() => setOpen(false)}>
          <ScribeLogo />
        </Link>
        <nav className="hidden items-center gap-0.5 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={`rounded-full px-3.5 py-2 text-[14.5px] font-bold transition-colors ${
                pathname === link.href
                  ? "bg-[var(--accent-tint)] text-accent-dim"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-full px-4 py-2 text-[14.5px] font-bold text-muted-foreground hover:text-foreground sm:inline"
          >
            Sign in
          </Link>
          <Link href="/signup" className={`${headerCta} hidden sm:inline-flex`}>
            Start studying
          </Link>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-full text-foreground hover:bg-muted lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
      </div>
      {open && (
        <div className="border-t border-border px-4 py-4 sm:px-6 lg:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`flex min-h-11 items-center rounded-[var(--r-control)] px-3 text-[15.5px] font-bold ${
                  pathname === link.href
                    ? "bg-[var(--accent-tint)] text-accent-dim"
                    : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center rounded-[var(--r-control)] px-3 text-[15.5px] font-bold text-muted-foreground"
            >
              Sign in
            </Link>
            <Link href="/signup" onClick={() => setOpen(false)} className={`${headerCta} mt-2 h-12 w-full`}>
              Start studying
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-[1160px] px-4 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <ScribeLogo />
            <p className="mt-3 max-w-xs text-[14px] text-muted-foreground">
              Your course materials, turned into personalized study sessions.
            </p>
          </div>
          {[
            {
              heading: "Product",
              links: [
                ...navLinks.filter((l) => l.href !== "/landing"),
                { label: "Questions", href: "/landing/faq" },
              ],
            },
            {
              heading: "Account",
              links: [
                { label: "Sign in", href: "/login" },
                { label: "Create account", href: "/signup" },
                { label: "Reset password", href: "/forgot-password" },
              ],
            },
            {
              heading: "Legal",
              links: [
                { label: "Privacy policy", href: "/privacy" },
                { label: "Terms of service", href: "/terms" },
              ],
            },
          ].map((column) => (
            <div key={column.heading}>
              <p className="text-[13px] font-extrabold text-foreground">{column.heading}</p>
              <ul className="mt-2 space-y-0.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-9 items-center text-[14px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex items-center justify-between border-t border-border pt-6 text-[13.5px] text-muted-foreground">
          <span>© 2026 Scribe</span>
          <span>Study smarter, not harder.</span>
        </div>
      </div>
    </footer>
  );
}
