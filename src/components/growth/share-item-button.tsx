"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Loader2, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SHAREABLE_KINDS,
  copyText,
  fetchShareStatus,
  setShared,
  shareOrCopy,
  shareUrl,
} from "@/lib/api/referrals";
import { toast } from "@/lib/toast";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/growth";

/**
 * Opt-in public link for one quiz (MCQ pool) or flashcard deck. Nothing is
 * public until the owner presses "Create link"; "Stop sharing" revokes it
 * (a later share gets a new link). Renders nothing for other item kinds.
 */
export function ShareItemButton({ artifactId, kind, title }: { artifactId: string; kind: string | null | undefined; title: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const qc = useQueryClient();
  const key = ["share-status", artifactId];
  const shareable = !!kind && SHAREABLE_KINDS.includes(kind);

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => fetchShareStatus(artifactId),
    enabled: open && shareable,
  });
  const toggle = useMutation({
    mutationFn: (shared: boolean) => setShared(artifactId, shared),
    onSuccess: (res, shared) => {
      qc.setQueryData(key, res);
      if (!shared) toast.success(t("share.stopped"));
    },
    onError: () => toast.error(t("share.failed")),
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!shareable) return null;
  const url = data?.token ? shareUrl(data.token) : null;

  const onCopy = async () => {
    if (!url) return;
    if (await copyText(url)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } else toast.error(t("growth.copyFailed"));
  };
  const onShare = async () => {
    if (!url) return;
    const res = await shareOrCopy({ title, text: title, url });
    if (res === "copied") toast.success(t("growth.copied"));
    else if (res === "failed") toast.error(t("growth.copyFailed"));
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Share2 className="mr-1.5 h-3.5 w-3.5" />
        {t("share.button")}
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/20 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-dialog-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg animate-fade-up"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="share-dialog-title" className="text-[16px] font-bold tracking-tight">
                {t("share.dialogTitle")}
              </h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={t("share.close")} className="rounded-full p-1 text-muted-foreground hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{t("share.dialogBody")}</p>

            {isLoading ? (
              <div className="mt-4 h-10 animate-pulse rounded-xl bg-muted" />
            ) : url ? (
              <>
                <input
                  readOnly
                  value={url}
                  aria-label={t("share.shareLink")}
                  onFocus={(e) => e.currentTarget.select()}
                  className="mt-4 h-10 w-full truncate rounded-xl border border-border bg-muted/40 px-3 font-mono text-[13px]"
                />
                <div className="mt-3 flex gap-2">
                  <Button className="flex-1" onClick={onShare}>
                    <Share2 className="mr-1.5 h-4 w-4" />
                    {t("share.shareLink")}
                  </Button>
                  <Button variant="outline" onClick={onCopy}>
                    {copied ? <Check className="mr-1.5 h-4 w-4 text-success" /> : <Copy className="mr-1.5 h-4 w-4" />}
                    {t("growth.copy")}
                  </Button>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <p className="text-[12px] leading-snug text-faint">{t("share.offNote")}</p>
                  <Button size="sm" variant="danger" disabled={toggle.isPending} onClick={() => toggle.mutate(false)}>
                    {toggle.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    {t("share.disable")}
                  </Button>
                </div>
              </>
            ) : (
              <Button className="mt-4 w-full" disabled={toggle.isPending} onClick={() => toggle.mutate(true)}>
                {toggle.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Link2 className="mr-1.5 h-4 w-4" />}
                {t("share.enable")}
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
