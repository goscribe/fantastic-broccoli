"use client";

import Link from "next/link";
import { useAuthUser } from "@/lib/api/auth";

/** Signed out: "Sign in" + "Start free". Signed in: "Open Scribe". Same width either way, so nothing shifts. */
export function HeaderCta() {
  const { user, loading } = useAuthUser();
  if (!loading && user)
    return (
      <Link href="/" className="inline-flex h-9 min-w-[132px] items-center justify-center rounded-full bg-accent px-4 text-[14px] font-bold text-white hover:bg-accent-dim">
        Open Scribe
      </Link>
    );
  return (
    <div className="flex items-center gap-1">
      <Link href="/login" className="hidden h-9 items-center rounded-full px-3 text-[14px] font-semibold text-muted-foreground hover:text-foreground sm:inline-flex">
        Sign in
      </Link>
      <Link href="/signup?from=notes" className="inline-flex h-9 min-w-[132px] items-center justify-center rounded-full bg-accent px-4 text-[14px] font-bold text-white hover:bg-accent-dim">
        Start free
      </Link>
    </div>
  );
}
