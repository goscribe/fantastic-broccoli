"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type BannerVariant = "info" | "accent" | "warning" | "success" | "error";

const variantClasses: Record<BannerVariant, string> = {
  info: "border-sky/40 bg-sky/10 text-foreground",
  accent: "border-accent/30 bg-accent-soft text-foreground",
  warning: "border-warning/40 bg-warning/10 text-foreground",
  success: "border-success/30 bg-success/10 text-foreground",
  error: "border-rose/40 bg-rose/10 text-foreground",
};

const iconClasses: Record<BannerVariant, string> = {
  info: "text-sky",
  accent: "text-accent",
  warning: "text-warning",
  success: "text-success",
  error: "text-rose",
};

const linkClasses: Record<BannerVariant, string> = {
  info: "text-sky hover:text-sky/80",
  accent: "text-accent hover:text-accent-dim",
  warning: "text-warning hover:text-warning/80",
  success: "text-success hover:text-success/80",
  error: "text-rose hover:text-rose/80",
};

const icons: Record<BannerVariant, React.ComponentType<{ className?: string }>> = {
  info: Info,
  accent: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: AlertCircle,
};

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function storageKey(dismissKey: string): string {
  return `banner-dismissed:${dismissKey}`;
}

interface BannerProps {
  variant?: BannerVariant;
  children: React.ReactNode;
  action?: { label: string; href: string };
  /** When set, dismissal persists in localStorage under this key. */
  dismissKey?: string;
  onDismiss?: () => void;
  dismissible?: boolean;
  className?: string;
}

export function Banner({
  variant = "info",
  children,
  action,
  dismissKey,
  onDismiss,
  dismissible = true,
  className,
}: BannerProps) {
  const [hidden, setHidden] = useState(false);
  const storedDismissed = useSyncExternalStore(
    subscribe,
    () =>
      dismissKey
        ? window.localStorage.getItem(storageKey(dismissKey)) === "1"
        : false,
    () => Boolean(dismissKey),
  );

  if (hidden || storedDismissed) return null;

  const IconComponent = icons[variant];

  const dismiss = () => {
    setHidden(true);
    if (dismissKey) {
      window.localStorage.setItem(storageKey(dismissKey), "1");
      for (const listener of listeners) listener();
    }
    onDismiss?.();
  };

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-2.5 text-xs sm:items-center sm:text-sm",
        variantClasses[variant],
        className,
      )}
    >
      <IconComponent className={cn("h-4 w-4 shrink-0", iconClasses[variant])} />
      <p className="flex-1 min-w-0">
        {children}
        {action && (
          <Link
            href={action.href}
            className={cn("ml-2 font-semibold hover:underline", linkClasses[variant])}
          >
            {action.label}
          </Link>
        )}
      </p>
      {dismissible && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
