"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile widget, shown only when the server asks for it (the
 * cheap anonymous limits are under pressure). Needs
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY; without it callers fall back to the
 * "create a free account" card.
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("turnstile failed to load"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function Turnstile({ onToken, onError }: { onToken: (token: string) => void; onError?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const tokenCb = useRef(onToken);
  const errorCb = useRef(onError);
  useEffect(() => {
    tokenCb.current = onToken;
    errorCb.current = onError;
  });

  useEffect(() => {
    let id: string | null = null;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => tokenCb.current(token),
          "error-callback": () => errorCb.current?.(),
        });
      })
      .catch(() => errorCb.current?.());
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, []);

  return <div ref={ref} className="flex min-h-[65px] justify-center" />;
}
