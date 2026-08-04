"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { useAuthUser } from "@/lib/api/auth";
import { ScribeMark } from "@/components/graphics/logo";
import { OnboardingTour } from "@/components/onboarding/onboarding-tour";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading } = useAuthUser();
  const isSession = /^\/workspace\/[^/]+\/session\//.test(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (
    pathname === "/login" ||
    pathname === "/landing" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/privacy" ||
    pathname === "/terms"
  ) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
        <div className="relative animate-float">
          <div className="absolute inset-0 rounded-full bg-accent/40 blur-2xl animate-loader-glow" />
          <ScribeMark className="relative h-12 w-12" />
        </div>
        <span className="text-lg font-bold tracking-tight">Scribe</span>
        <div className="relative h-1 w-40 overflow-hidden rounded-full bg-muted">
          <div className="absolute inset-y-0 rounded-full bg-accent animate-loader-bar" />
        </div>
      </div>
    );
  }

  if (isSession) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <TopBar showLogo />
        {children}
        <OnboardingTour />
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
        {children}
      </div>
      <OnboardingTour />
    </div>
  );
}
