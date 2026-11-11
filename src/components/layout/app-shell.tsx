"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { isPublicPath, useAuthUser } from "@/lib/api/auth";
import { FullScreenLoader } from "@/components/layout/full-screen-loader";
import { GuidedTour } from "@/components/onboarding/guided-tour";
import { MonthlyRatingPrompt } from "@/components/rating/monthly-rating-prompt";
import { SubscribeWall } from "@/components/billing/subscribe-wall";
import { PlanLimitDialog } from "@/components/billing/plan-limit-dialog";
import { BILLING_PAUSED } from "@/lib/billing-paused";
import { NewShell } from "@/components/layout/new-shell";
import { useNewUi } from "@/lib/new-ui";
import "@/app/design/design.css";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading } = useAuthUser();
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
        {!BILLING_PAUSED && <PlanLimitDialog />}
      </div>
    );
  }

  if (newUi) {
    return (
      <>
        <NewShell>{children}</NewShell>
        <MonthlyRatingPrompt />
        {!BILLING_PAUSED && <PlanLimitDialog />}
        {!BILLING_PAUSED && <SubscribeWall />}
      </>
    );
  }

  if (isSession) {
    return (
      <div className="h-dvh flex flex-col overflow-hidden">
        <TopBar showLogo />
        {children}
        {!BILLING_PAUSED && <PlanLimitDialog />}
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
      {!BILLING_PAUSED && <PlanLimitDialog />}
      {!BILLING_PAUSED && <SubscribeWall />}
    </div>
  );
}
