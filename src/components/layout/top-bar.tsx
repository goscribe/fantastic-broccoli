"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Settings, UserPlus, Bell, Palette, LogOut, Check, X, Menu, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScribeLogo } from "@/components/graphics/logo";
import { signOut, useAuthUser } from "@/lib/api/auth";
import { useCredits } from "@/lib/credits";

export function TopBar({
  showLogo = false,
  onMenuClick,
}: {
  showLogo?: boolean;
  onMenuClick?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthUser();
  const credits = useCredits();

  const sectionLabel = pathname.startsWith("/workspace")
    ? "Workspace"
    : pathname.startsWith("/folder")
      ? "Folders"
      : pathname === "/shared"
        ? "Shared with me"
        : pathname === "/settings"
          ? "Settings"
          : "Home";
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invited, setInvited] = useState<string[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const sendInvite = () => {
    if (!inviteEmail.trim()) return;
    setInvited((prev) => [...prev, inviteEmail.trim()]);
    setInviteEmail("");
  };

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur-md">
        <div className="px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onMenuClick && (
              <button
                type="button"
                aria-label="Open sidebar"
                onClick={onMenuClick}
                className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted md:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
            )}
            {showLogo && (
              <Link href="/">
                <ScribeLogo />
              </Link>
            )}
            <span className="hidden sm:flex items-center gap-2 text-[13px] text-muted-foreground">
              {showLogo && <span className="text-faint">/</span>}
              {sectionLabel}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {pathname.startsWith("/workspace") && (
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Share
              </button>
            )}
            <span
              title="Credits — earned by completing study sessions"
              className="flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent tabular-nums"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {credits}
            </span>
            <button
              type="button"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
            </button>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Account menu"
                className="ml-1 h-7 w-7 rounded-full bg-accent-soft border border-accent/20 flex items-center justify-center text-xs font-bold text-accent hover:border-accent/50"
              >
                {(user?.name ?? "?").charAt(0).toUpperCase()}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card py-1.5 animate-fade-up">
                  <div className="px-3.5 py-2 border-b border-border mb-1.5">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-[11px] text-faint">
                      {user?.email ?? "Personal workspace"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setInviteOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-muted text-left"
                  >
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                    Invite people
                  </button>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-muted text-left"
                  >
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    Appearance
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      router.push("/settings");
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-muted text-left"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    Settings
                  </button>
                  <div className="my-1.5 border-t border-border" />
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-muted text-left text-muted-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 animate-fade-up">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold tracking-tight">
                Invite people
              </h2>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Invite classmates to study together and share materials.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                placeholder="name@school.edu"
                className="flex-1 h-10 rounded-xl border border-border bg-background px-3.5 text-sm focus:outline-none focus:border-accent/50 placeholder:text-faint"
              />
              <Button size="md" onClick={sendInvite} disabled={!inviteEmail.trim()}>
                Invite
              </Button>
            </div>
            {invited.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {invited.map((email) => (
                  <div
                    key={email}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Check className="h-3.5 w-3.5 text-success" />
                    Invited {email}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
