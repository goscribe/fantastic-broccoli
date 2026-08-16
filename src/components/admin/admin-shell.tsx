"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  ArrowLeft,
  CreditCard,
  DollarSign,
  FileText,
  LayoutDashboard,
  Library,
  ScrollText,
  Sparkles,
  Users,
} from "lucide-react";
import { ScribeLogo } from "@/components/graphics/logo";
import { FullScreenLoader } from "@/components/layout/full-screen-loader";
import { useAuthUser } from "@/lib/api/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/workspaces", label: "Workspaces", icon: Library },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/quality", label: "Quality", icon: Sparkles },
  { href: "/admin/logs", label: "Activity logs", icon: ScrollText },
  { href: "/admin/invoices", label: "Invoices", icon: FileText },
  { href: "/admin/plans", label: "Plans", icon: CreditCard },
  { href: "/admin/costs", label: "Costs", icon: DollarSign },
];

/**
 * Chrome for the admin panel. Renders nothing for non-admins and sends them
 * back to the app — the server rejects `admin.*` calls regardless, this only
 * keeps the UI honest.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuthUser();
  const allowed = user?.isAdmin === true;

  useEffect(() => {
    if (!loading && user && !allowed) router.replace("/");
  }, [loading, user, allowed, router]);

  if (loading) return <FullScreenLoader />;
  if (!allowed) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="px-5 py-4">
          <Link href="/admin" aria-label="Admin overview">
            <ScribeLogo />
          </Link>
          <p className="mt-1 text-[12px] text-faint">Admin console</p>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/admin" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Scribe
          </Link>
          <p className="px-3 pt-2 text-[11px] text-faint">
            {user?.email ?? user?.name}
          </p>
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto">
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </div>
    </div>
  );
}
