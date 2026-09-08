"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Loader2, Sparkles, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  repairContentBlock,
  type RepairBlockKind,
  type RepairTarget,
} from "@/lib/api/copilot";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/lib/toast";
import "@/lib/i18n/repair";

/**
 * Tells rendered content where it lives so a broken block (mermaid, LaTeX,
 * widget) can be sent to the workspace agent for a fix and saved back.
 * Without a provider, broken blocks fall back to a plain inline notice.
 */
export interface ContentRepairScope {
  workspaceId: string;
  target?: RepairTarget;
  /** Called after a fix is saved server-side so the owner can refetch. */
  onRepaired?: () => void;
}

const ContentRepairContext = createContext<ContentRepairScope | null>(null);

export function ContentRepairProvider({
  scope,
  children,
}: {
  scope: ContentRepairScope | null;
  children: React.ReactNode;
}) {
  return (
    <ContentRepairContext.Provider value={scope}>
      {children}
    </ContentRepairContext.Provider>
  );
}

const WORKSPACE_PATH = /^\/workspace\/([^/?#]+)/;

/**
 * Explicit scope from the nearest provider, else the workspace from the
 * current /workspace/[id]/... route (fix without persistence target).
 */
export function useContentRepairScope(): ContentRepairScope | null {
  const explicit = useContext(ContentRepairContext);
  const pathname = usePathname();
  const fromRoute = useMemo<ContentRepairScope | null>(() => {
    const m = pathname?.match(WORKSPACE_PATH);
    return m ? { workspaceId: decodeURIComponent(m[1]) } : null;
  }, [pathname]);
  return explicit ?? fromRoute;
}

const BROKEN_LABEL: Record<RepairBlockKind, string> = {
  mermaid: "repair.diagramBroken",
  latex: "repair.mathBroken",
  widget: "repair.blockBroken",
  markdown: "repair.blockBroken",
};

interface BrokenBlockProps {
  kind: RepairBlockKind;
  source: string;
  error?: string;
  /** Renders the repaired source in place once the agent returns a fix. */
  renderFixed?: (source: string) => React.ReactNode;
  /** Alternative to `renderFixed`: the owner swaps in the fixed source. */
  onFixed?: (source: string) => void;
  /** Shown under the notice when the user expands the source. */
  sourceView?: React.ReactNode;
  /** Inline (math) or block (diagram/widget) presentation. */
  inline?: boolean;
  /** Rendered instead of the notice when no repair scope is available. */
  fallback?: React.ReactNode;
}

/**
 * In-place notice for a generated block that failed to render, with a
 * "Fix it" action that hands the block to the workspace agent.
 */
export function BrokenBlock({
  kind,
  source,
  error,
  renderFixed,
  onFixed,
  sourceView,
  inline = false,
  fallback,
}: BrokenBlockProps) {
  const { t } = useI18n();
  const scope = useContentRepairScope();
  // Keyed by the source so fresh content from the parent drops a stale fix.
  const [repair, setRepair] = useState<{ of: string; fixed: string } | null>(
    null,
  );
  const [open, setOpen] = useState(false);
  const [showSource, setShowSource] = useState(false);

  const fixed = repair?.of === source ? repair.fixed : null;
  if (fixed !== null && fixed !== source && renderFixed)
    return <>{renderFixed(fixed)}</>;

  const canFix = !!scope;
  if (!canFix && fallback !== undefined) return <>{fallback}</>;

  return (
    <span
      className={
        inline
          ? "inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-md border border-amber-300/70 bg-amber-50 px-2 py-0.5 align-middle text-[12px] text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
          : "block my-2 rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-[13px] text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
      }
      data-broken-block={kind}
    >
      <span
        className={
          inline
            ? "inline-flex items-center gap-1"
            : "flex flex-wrap items-center gap-2"
        }
      >
        <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{t(BROKEN_LABEL[kind])}</span>
        {canFix && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-[12px] font-semibold text-accent-foreground shadow-sm transition hover:brightness-105"
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            {t("repair.fixIt")}
          </button>
        )}
        {!inline && (
          <button
            type="button"
            onClick={() => setShowSource((v) => !v)}
            className="text-[12px] underline-offset-2 hover:underline"
          >
            {showSource ? t("repair.hideSource") : t("repair.showSource")}
          </button>
        )}
      </span>
      {!inline && showSource && (
        <span className="block mt-2 text-foreground">
          {sourceView ?? (
            <code className="block overflow-x-auto whitespace-pre rounded bg-muted/60 px-2 py-1.5 font-mono text-[12px]">
              {source}
            </code>
          )}
        </span>
      )}
      {open && scope && (
        <RepairDialog
          scope={scope}
          kind={kind}
          source={source}
          error={error}
          onClose={() => setOpen(false)}
          onFixed={(next) => {
            setOpen(false);
            if (onFixed) onFixed(next);
            else setRepair({ of: source, fixed: next });
          }}
        />
      )}
    </span>
  );
}

type RepairState =
  | { status: "idle" }
  | { status: "fixing" }
  | { status: "failed"; message: string };

function RepairDialog({
  scope,
  kind,
  source,
  error,
  onClose,
  onFixed,
}: {
  scope: ContentRepairScope;
  kind: RepairBlockKind;
  source: string;
  error?: string;
  onClose: () => void;
  onFixed: (source: string) => void;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<RepairState>({ status: "idle" });

  const run = async () => {
    setState({ status: "fixing" });
    try {
      const result = await repairContentBlock({
        workspaceId: scope.workspaceId,
        target: scope.target,
        block: { kind, source, error },
      });
      if (result.persisted) scope.onRepaired?.();
      toast.success(
        result.persisted ? t("repair.fixed") : t("repair.fixedNotSaved"),
      );
      onFixed(result.source);
    } catch (err) {
      setState({
        status: "failed",
        message:
          err instanceof Error && err.message ? err.message : t("repair.failed"),
      });
    }
  };

  // Only ever mounted after a click, so document is available.
  const busy = state.status === "fixing";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-foreground/40 px-4 backdrop-blur-sm"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 text-left shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label={t("repair.cancel")}
          className="absolute right-4 top-4 rounded-full p-1 text-faint hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Sparkles className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-xl font-bold tracking-tight text-foreground">
          {t("repair.title")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("repair.body")}</p>
        {error && (
          <p className="mt-3 max-h-20 overflow-y-auto rounded-md bg-muted/60 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
            {error}
          </p>
        )}
        {state.status === "failed" && (
          <p className="mt-3 text-sm text-rose">{state.message}</p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={run} disabled={busy} className="w-full">
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("repair.fixing")}
              </>
            ) : state.status === "failed" ? (
              t("repair.tryAgain")
            ) : (
              t("repair.fixIt")
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={busy}
            className="w-full"
          >
            {t("repair.cancel")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
