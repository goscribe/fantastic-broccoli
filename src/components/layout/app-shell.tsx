"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { usePageViewTracking } from "@/lib/use-page-view-tracking";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { isPublicPath, useAuthUser } from "@/lib/api/auth";
import { FullScreenLoader } from "@/components/layout/full-screen-loader";
import { GuidedTour } from "@/components/onboarding/guided-tour";
import { MonthlyRatingPrompt } from "@/components/rating/monthly-rating-prompt";
import { SubscribeWall } from "@/components/billing/subscribe-wall";
import { ConversionTracker } from "@/components/billing/conversion-tracker";
import { BILLING_PAUSED } from "@/lib/billing-paused";
import { NewShell } from "@/components/layout/new-shell";
import { useNewUi } from "@/lib/new-ui";
import "@/app/design/design.css";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuthUser();
  usePageViewTracking(user !== null);
  const newUi = useNewUi();
  const isSession = /^\/workspace\/[^/]+\/session\//.test(pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isPublicPath(pathname) || pathname.startsWith("/admin")) {
    return <>{children}</>;
  }

  if (loading) {
    return <FullScreenLoader />;
  }

  if (isSession && newUi) {
    return (
      <div className="design-root flex h-dvh flex-col overflow-hidden bg-white text-foreground">
        {children}
        {!BILLING_PAUSED && <SubscribeWall />}
        <ConversionTracker />
      </div>
    );
  }

  if (newUi) {
    return (
      <>
        <NewShell>{children}</NewShell>
        <MonthlyRatingPrompt />
        {!BILLING_PAUSED && <SubscribeWall />}
        <ConversionTracker />
      </>
    );
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
      {!BILLING_PAUSED && <SubscribeWall />}
        <ConversionTracker />
    </div>
  );
}
