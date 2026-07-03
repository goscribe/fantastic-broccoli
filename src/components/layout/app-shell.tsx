"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSession = /^\/workspace\/[^/]+\/session\//.test(pathname);

  if (isSession) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopBar showLogo />
        {children}
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <TopBar />
        {children}
      </div>
    </div>
  );
}
