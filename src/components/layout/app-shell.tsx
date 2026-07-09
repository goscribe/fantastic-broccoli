"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Banner } from "@/components/ui/banner";
import { TopBar } from "@/components/layout/top-bar";
import { useAuthUser } from "@/lib/api/auth";
import { useCredits } from "@/lib/credits";
import { ScribeMark } from "@/components/graphics/logo";
import { Loader2 } from "lucide-react";

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <ScribeMark className="h-10 w-10" />
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasCredits = credits > 0;

  if (isSession) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <TopBar showLogo />
        {!hasCredits && (
          <div>
            <Banner
              variant="warning"
              action={{ label: "View pricing", href: "/pricing" }}
              className="rounded-none border-x-0 border-t-0 px-4 sm:px-5"
            >
              You&apos;re out of credits. Upgrade to keep generating study
              sessions.
            </Banner>
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
          <div>
            <Banner
              variant="warning"
              action={{ label: "View pricing", href: "/pricing" }}
              className="rounded-none border-x-0 border-t-0 px-4 sm:px-8"
            >
              You&apos;re out of credits. Upgrade to keep generating study
              sessions.
            </Banner>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
