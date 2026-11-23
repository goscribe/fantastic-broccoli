"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { studySessionApi } from "@/lib/api/study-session";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/practice-paper";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { PAPER_BOARDS, boardLabel, formatPaperMinutes, type PaperBoard } from "@/lib/practice-paper";

/**
 * "Practice a paper": the subject's board (from its course, its last session
 * or its materials; the learner can switch), the papers in that board's
 * format for the subject, full or short. Starting one opens its session,
 * which shows the loading screen while the paper is written.
 */
export function PaperPicker({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [board, setBoard] = useState<PaperBoard | undefined>(undefined);
  const [paperId, setPaperId] = useState<string | null>(null);
  const [length, setLength] = useState<"full" | "short">("full");
  const [starting, setStarting] = useState(false);

  const options = useQuery({
    queryKey: ["paper-options", workspaceId, board ?? "auto"],
    queryFn: () => studySessionApi.paperOptions({ workspaceId, board }),
    staleTime: 60_000,
  });
  const papers = options.data?.papers ?? [];
  const shownBoard = board ?? (options.data?.board as PaperBoard | null) ?? undefined;
  const chosen = papers.find((p) => p.id === paperId) ?? papers[0];
  const labels = { min: t("paper.min"), h: t("paper.hour") };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !starting && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, starting]);

  const start = async () => {
    if (!chosen || starting) return;
    setStarting(true);
    try {
      const session = await studySessionApi.createPaper({ workspaceId, paperId: chosen.id, length });
      router.push(`/workspace/${workspaceId}/session/${session.id}`);
    } catch (e) {
      toastError(e, t("paper.failed"));
      setStarting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/30 sm:items-center sm:p-4" onClick={() => !starting && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paper-picker-title"
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[28px] border border-border bg-card px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-xl animate-fade-up sm:rounded-[28px] sm:px-6 sm:pb-6 sm:pt-5"
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border sm:hidden" aria-hidden />
        <button type="button" onClick={onClose} disabled={starting} aria-label={t("session.cancel")} className="absolute right-3.5 top-3.5 rounded-full p-1.5 text-muted-foreground hover:bg-muted">
          <X className="size-4" />
        </button>
        <h2 id="paper-picker-title" className="text-[20px] font-bold leading-tight tracking-tight">{t("paper.title")}</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">{t("paper.sub")}</p>

        <p className="mt-4 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">{t("paper.board")}</p>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t("paper.board")}>
          {PAPER_BOARDS.map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={shownBoard === b}
              onClick={() => {
                setBoard(b);
                setPaperId(null);
              }}
              className={cn(
                "min-h-10 rounded-full px-4 text-[14px] font-bold ring-inset",
                shownBoard === b ? "bg-[color-mix(in_srgb,var(--accent)_10%,#fff)] ring-2 ring-accent" : "bg-muted hover:bg-[var(--edge)]",
              )}
            >
              {boardLabel(b)}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2" role="radiogroup" aria-label={t("paper.title")}>
          {options.isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : papers.length === 0 ? (
            <p className="py-3 text-[14px] text-muted-foreground">{t("paper.none")}</p>
          ) : (
            papers.map((p) => {
              const on = chosen?.id === p.id;
              const size = length === "short" ? p.short : p.full;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPaperId(p.id)}
                  className={cn(
                    "w-full rounded-2xl px-4 py-3 text-left ring-inset",
                    on ? "bg-[color-mix(in_srgb,var(--accent)_8%,#fff)] ring-2 ring-accent" : "bg-muted hover:bg-[var(--edge)]",
                  )}
                >
                  <span className="block text-[15px] font-extrabold">{p.name}</span>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">{p.blurb}</span>
                  <span className="mt-1 block text-[12.5px] font-semibold tabular-nums text-muted-foreground">
                    {formatPaperMinutes(size.minutes, labels)} · {size.marks} {t("paper.marks")} · {t("paper.questions").replace("{n}", String(size.questions))}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {papers.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup">
            {(["full", "short"] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={length === l}
                onClick={() => setLength(l)}
                className={cn("min-h-11 rounded-full text-[14px] font-bold ring-inset", length === l ? "bg-foreground text-background" : "bg-muted hover:bg-[var(--edge)]")}
              >
                {t(l === "full" ? "paper.full" : "paper.short")}
              </button>
            ))}
          </div>
        )}

        <Button size="lg" className="mt-5 w-full text-[15px]" disabled={!chosen || starting} onClick={() => void start()}>
          {starting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {t("paper.starting")}
            </>
          ) : (
            t("paper.start")
          )}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
