"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { isPublicPath, useAuthUser } from "@/lib/api/auth";
import { FullScreenLoader } from "@/components/layout/full-screen-loader";
import { GuidedTour } from "@/components/onboarding/guided-tour";
import { MonthlyRatingPrompt } from "@/components/rating/monthly-rating-prompt";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading } = useAuthUser();
  const isSession = /^\/workspace\/[^/]+\/session\//.test(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isPublicPath(pathname) || pathname.startsWith("/admin")) {
    return <>{children}</>;
  }

  if (loading) {
    return <FullScreenLoader />;
  }

  if (isSession) {
    return (
      <div className="h-dvh flex flex-col overflow-hidden">
        <TopBar showLogo />
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
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
      <GuidedTour />
      <MonthlyRatingPrompt />
    </div>
  );
}
