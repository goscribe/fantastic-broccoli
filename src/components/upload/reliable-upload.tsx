"use client";

import { useCallback, useRef, useState } from "react";
import { ClipboardPaste, RotateCcw } from "lucide-react";
import { Mascot } from "@/components/rewards/mascot";
import { Button } from "@/components/ui/button";
import { WaitScreen } from "@/components/ui/wait-screen";
import { retryUpload, uploadFiles } from "@/lib/api/materials";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/uploads";
import { cn } from "@/lib/utils";
import {
  UploadCancelledError,
  fillCopy,
  isUploadIncomplete,
  uploadStatus,
  type UploadIncompleteError,
  type UploadProgress,
} from "@/lib/upload-transfer";

/**
 * The upload every "upload notes" entry uses (first run, new subject, the
 * create menu): bytes go up with retries and resume after the phone returns
 * from the background (lib/upload-transfer.ts). When a file still doesn't
 * land, `run` does not reject: the screen shows "Your upload didn't finish —
 * try again" with Try again and Paste text instead, and `run` resolves once a
 * retry gets every file in. "Paste text instead" rejects with
 * `UploadCancelledError`.
 */
export function useReliableUpload() {
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [failure, setFailure] = useState<UploadIncompleteError | null>(null);
  const [retrying, setRetrying] = useState(false);
  const pending = useRef<{
    workspaceId: string;
    resolve: (ids: string[]) => void;
    reject: (err: unknown) => void;
  } | null>(null);

  const settle = useCallback((work: Promise<string[]>) => {
    work.then(
      (ids) => {
        const p = pending.current;
        pending.current = null;
        setFailure(null);
        setRetrying(false);
        p?.resolve(ids);
      },
      (err: unknown) => {
        setRetrying(false);
        if (isUploadIncomplete(err)) {
          setFailure(err as UploadIncompleteError);
          return;
        }
        const p = pending.current;
        pending.current = null;
        p?.reject(err);
      },
    );
  }, []);

  const run = useCallback(
    (workspaceId: string, files: File[]) =>
      new Promise<string[]>((resolve, reject) => {
        pending.current = { workspaceId, resolve, reject };
        setFailure(null);
        setProgress(null);
        settle(uploadFiles(workspaceId, files, setProgress));
      }),
    [settle],
  );

  const retry = useCallback(() => {
    const p = pending.current;
    if (!p || !failure) return;
    setRetrying(true);
    setFailure(null);
    settle(retryUpload(p.workspaceId, failure, setProgress));
  }, [failure, settle]);

  const giveUp = useCallback(() => {
    const p = pending.current;
    pending.current = null;
    setFailure(null);
    setProgress(null);
    p?.reject(new UploadCancelledError());
  }, []);

  return { run, retry, giveUp, failure, retrying, progress };
}

export type ReliableUpload = ReturnType<typeof useReliableUpload>;

/** The wait screen's "what is happening now" line for an upload in flight. */
export function useUploadStatusLine(progress: UploadProgress | null): string | null {
  const { t } = useI18n();
  if (!progress) return null;
  const { key, vars } = uploadStatus(progress);
  return fillCopy(t(key), vars);
}

/** "Your upload didn't finish — try again": never a silent disappearance. */
export function UploadFailedPanel({
  failure,
  onRetry,
  onPaste,
  compact = false,
  className,
}: {
  failure: UploadIncompleteError;
  onRetry: () => void;
  onPaste: () => void;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const names = failure.failed.map((f) => f.file.name);
  const body =
    names.length === 1
      ? fillCopy(t("upload.failedBody"), { name: `“${names[0]}”` })
      : fillCopy(t("upload.failedBodyMany"), { count: names.length });
  return (
    <section
      role="alert"
      className={cn("mx-auto flex w-full max-w-[440px] flex-col items-center text-center", compact ? "py-6" : "py-10 sm:py-14", className)}
    >
      <Mascot pose="think" className={compact ? "h-[72px]" : "h-[96px] sm:h-[112px]"} />
      <h2 className={cn("text-balance font-extrabold leading-tight", compact ? "mt-4 text-[18px]" : "mt-5 text-[22px] sm:text-[24px]")}>
        {t("upload.failedTitle")}
      </h2>
      <p className="mt-2 max-w-[360px] text-balance text-ui text-muted-foreground [overflow-wrap:anywhere]">{body}</p>
      <div className="mt-6 flex w-full max-w-[320px] flex-col gap-2">
        <Button size="lg" onClick={onRetry} className="w-full gap-2">
          <RotateCcw className="size-4" aria-hidden />
          {t("upload.tryAgain")}
        </Button>
        <Button size="lg" variant="secondary" onClick={onPaste} className="w-full gap-2">
          <ClipboardPaste className="size-4" aria-hidden />
          {t("upload.pasteInstead")}
        </Button>
      </div>
    </section>
  );
}

/**
 * The upload's whole screen: the shared wait screen with the honest line
 * (files done, retrying, paused), or the failure panel. `fallback` is what the
 * wait screen shows once the bytes are in (saving, building the session).
 */
export function UploadStage({
  upload,
  title,
  fallbackStatus,
  time,
  onPaste,
  compact = false,
}: {
  upload: ReliableUpload;
  title: React.ReactNode;
  fallbackStatus?: React.ReactNode;
  time?: React.ReactNode;
  onPaste: () => void;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const line = useUploadStatusLine(upload.progress);
  if (upload.failure) {
    return <UploadFailedPanel failure={upload.failure} onRetry={upload.retry} onPaste={onPaste} compact={compact} />;
  }
  const uploading = upload.progress !== null && upload.progress.done < upload.progress.total;
  const pct = uploading && upload.progress!.total > 1 ? upload.progress!.done / upload.progress!.total : undefined;
  return (
    <WaitScreen
      compact={compact}
      title={title}
      status={upload.retrying && !line ? t("upload.retryingNow") : uploading ? line : fallbackStatus}
      pct={pct}
      time={uploading ? t("upload.leaveHint") : time}
    />
  );
}
