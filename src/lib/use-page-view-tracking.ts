"use client";

import { useEffect, useRef } from "react";
import { useParams, usePathname } from "next/navigation";
import { apiUrl } from "@/lib/api/config";
import { isPublicPath } from "@/lib/api/auth";
import { rpc } from "@/lib/api/study-session";
import { pageViewFor, pageViewKey } from "@/lib/page-view";

/**
 * Tells the server which page a signed-in user opened, once per page change.
 * Sends a route pattern only (no ids, query string or fragment). The request
 * is not awaited and its failure is ignored, so it can never hold up or break
 * navigation. Public pages and the admin console are not reported.
 */
export function usePageViewTracking(signedIn: boolean): void {
  const pathname = usePathname();
  const params = useParams();
  const lastSent = useRef<string | null>(null);

  const tracked =
    signedIn && Boolean(apiUrl) && !isPublicPath(pathname) && !pathname.startsWith("/admin");
  const view = tracked ? pageViewFor(pathname, params) : null;
  const key = view ? pageViewKey(view) : null;
  const path = view?.path;
  const workspaceId = view?.workspaceId;

  useEffect(() => {
    if (!key || !path) {
      // On an unreported page (public, admin): coming back counts as a new view.
      lastSent.current = null;
      return;
    }
    if (lastSent.current === key) return;
    lastSent.current = key;
    rpc("activity.pageView", "mutation", { path, workspaceId }).catch(() => {});
  }, [key, path, workspaceId]);
}
