"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ScribeLogo } from "@/components/graphics/logo";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { Menu, Moon, Sun, X } from "lucide-react";

const navLinks = [
  { href: "/landing", label: "Home" },
  { href: "/landing/features", label: "Features" },
  { href: "/landing/pricing", label: "Pricing" },
  { href: "/landing/faq", label: "Questions" },
];

export function LandingHeader() {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/landing" onClick={() => setOpen(false)}>
          <ScribeLogo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <nav className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          <Link
            href="/login"
            className="hidden rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline"
          >
            Sign in
          </Link>
          <Link href="/signup" className="hidden sm:inline">
            <Button size="sm">Start studying</Button>
          </Link>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </nav>
      </div>
      {open && (
        <div className="border-t border-border px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-xl px-3 py-2 text-sm font-medium ${
                  pathname === link.href
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground"
            >
              Sign in
            </Link>
            <Link href="/signup" onClick={() => setOpen(false)} className="pt-2">
              <Button size="sm" className="w-full">
                Start studying
              </Button>
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
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-10 sm:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <ScribeLogo />
            <p className="mt-3 max-w-xs text-[13px] text-muted-foreground">
              Your course materials, turned into personalized study sessions.
            </p>
          </div>
          {[
            {
              heading: "Product",
              links: [
                ...navLinks.filter((l) => l.href !== "/landing"),
                { label: "About", href: "/landing/about" },
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
              <p className="text-xs font-semibold text-faint">{column.heading}</p>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex items-center justify-between border-t border-border pt-6 text-[13px] text-faint">
          <span>© 2026 Scribe</span>
          <span>Study smarter, not harder.</span>
        </div>
      </div>
    </footer>
  );
}
