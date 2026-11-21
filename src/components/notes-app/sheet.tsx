"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * The dialog the notes pickers open in: a centred card on a desk, a sheet
 * from the bottom on a phone. Header and footer stay put; the list scrolls.
 */
export function Sheet({ title, sub, onClose, footer, children, labelId = "notes-sheet-title" }: { title: ReactNode; sub?: ReactNode; onClose: () => void; footer?: ReactNode; children: ReactNode; labelId?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-border bg-white pb-[env(safe-area-inset-bottom)] sm:max-h-[min(720px,88dvh)] sm:max-w-[560px] sm:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
          <div className="min-w-0">
            <h2 id={labelId} className="text-[20px] font-extrabold leading-tight">
              {title}
            </h2>
            {sub && <p className="mt-1 text-[14px] leading-snug text-muted-foreground">{sub}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1.5 -mt-1 grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
        {footer && <div className="border-t border-border px-5 py-3.5 sm:px-6">{footer}</div>}
      </div>
    </div>
  );
}
