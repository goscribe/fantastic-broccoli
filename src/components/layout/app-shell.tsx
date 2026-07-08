"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { useAuthUser } from "@/lib/api/auth";
import { useCredits } from "@/lib/credits";
import { Skeleton } from "@/components/ui/skeleton";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading } = useAuthUser();
  const credits = useCredits();
  const isSession = /^\/workspace\/[^/]+\/session\//.test(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (
    pathname === "/login" ||
    pathname === "/landing" ||
    pathname === "/signup" ||
    pathname === "/forgot-password"
  ) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="border-b border-border bg-card">
          <div className="flex h-14 items-center justify-between px-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-7 rounded-full" />
            </div>
          </div>
        </div>
        {credits <= 0 && (
          <div className="border-b border-border bg-accent-soft/30 px-5 py-2.5 text-sm text-muted-foreground">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
              <span>Checking your account and loading your study workspace…</span>
              <Link
                href="/pricing"
                className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                View plans
              </Link>
            </div>
          </div>
        )}
        <div className="flex flex-1">
          <div className="hidden w-72 shrink-0 border-r border-border bg-card md:block">
            <div className="space-y-3 p-4">
              <Skeleton className="h-4 w-28" />
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </div>
          <main className="flex-1 p-6">
            <div className="mx-auto max-w-4xl space-y-4">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-80" />
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          </main>
        </div>
      </div>
    );
  }

  const hasCredits = credits > 0;

  if (isSession) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <TopBar showLogo />
        {!hasCredits && (
          <div className="border-b border-amber-500/20 bg-amber-500/10 px-5 py-2 text-sm text-amber-950 dark:text-amber-100">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
              <span>You&apos;re out of credits. Upgrade to keep generating study sessions.</span>
              <Link
                href="/pricing"
                className="rounded-full border border-amber-500/30 bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                View pricing
              </Link>
            </div>
          </div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-foreground/20 md:hidden"
        />
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        {!hasCredits && (
          <div className="border-b border-amber-500/20 bg-amber-500/10 px-5 py-2 text-sm text-amber-950 dark:text-amber-100">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
              <span>You&apos;re out of credits. Upgrade to keep generating study sessions.</span>
              <Link
                href="/pricing"
                className="rounded-full border border-amber-500/30 bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                View pricing
              </Link>
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
