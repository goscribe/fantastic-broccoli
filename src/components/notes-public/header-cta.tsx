"use client";

import Link from "next/link";
import { useAuthUser } from "@/lib/api/auth";

/** Signed out: "Sign in" + "Start free". Signed in: "Open Scribe". Same width either way, so nothing shifts. */
export function HeaderCta() {
  const { user, loading } = useAuthUser();
  if (!loading && user)
    return (
      <Link href="/" className="nl-btn nl-btn-sm min-w-[132px]">
        Open Scribe
      </Link>
    );
  return (
    <div className="flex items-center gap-1">
      <Link href="/login" className="hidden h-10 items-center rounded-full px-3 text-[14px] font-extrabold text-muted-foreground hover:text-foreground sm:inline-flex">
        Sign in
      </Link>
      <Link href="/signup?from=notes" className="nl-btn nl-btn-sm min-w-[132px]">
        Start free
      </Link>
    </div>
  );
}
