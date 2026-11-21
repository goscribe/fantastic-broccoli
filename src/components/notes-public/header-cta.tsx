"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { libraryPathFor } from "@/lib/notes";
import { useAuthUser } from "@/lib/api/auth";

/** Signed out: "Sign in" + "Start free". Signed in: "Open in Scribe" (this page, in the app). Same width either way, so nothing shifts. */
export function HeaderCta() {
  const { user, loading } = useAuthUser();
  const pathname = usePathname();
  // Signed in: the same course or note inside the app (their subjects, sessions and Mistakes are there). The public page itself is never redirected, for visitors and crawlers alike.
  if (!loading && user)
    return (
      <Link href={libraryPathFor(pathname ?? "") ?? "/"} className="nl-btn nl-btn-sm min-w-[132px]">
        Open in Scribe
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
