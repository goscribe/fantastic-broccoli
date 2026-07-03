"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Settings, UserPlus, Bell, Palette, LogOut, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TopBar({ showLogo = false }: { showLogo?: boolean }) {
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
          {showLogo ? (
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground text-sm font-bold">
                S
              </span>
              <span className="font-bold tracking-tight">Scribe</span>
            </Link>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-1.5">
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
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card shadow-soft-lg py-1.5 animate-fade-up">
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
                  <div className="my-1.5 border-t border-border" />
                  <button
                    type="button"
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-muted text-left text-muted-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>

            <div className="ml-1 h-7 w-7 rounded-full bg-accent-soft border border-accent/20 flex items-center justify-center text-xs font-bold text-accent">
              A
            </div>
          </div>
        </div>
      </div>

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-soft-lg p-6 animate-fade-up">
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
