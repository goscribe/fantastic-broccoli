"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { useAuthUser } from "@/lib/api/auth";
import { ScribeMark } from "@/components/graphics/logo";
import { Loader2 } from "lucide-react";

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <ScribeMark className="h-10 w-10" />
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isSession) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <TopBar showLogo />
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
        {children}
      </div>
    </div>
  );
}
