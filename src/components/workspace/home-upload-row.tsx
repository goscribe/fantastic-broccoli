"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { UPLOAD_ACCEPT } from "@/lib/uploads";
import { startWorkspaceFromUploads } from "@/lib/start-from-uploads";
import { toastError } from "@/lib/toast";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";
import { cn } from "@/lib/utils";

/** Full-width drop row on the home stats card: files → workspace + session. */
export function HomeUploadRow() {
  const router = useRouter();
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const run = async (files: File[]) => {
    if (files.length === 0 || busy) return;
    setBusy(true);
    try {
      const { workspaceId, session } = await startWorkspaceFromUploads(files);
      if (session) {
        router.push(`/workspace/${workspaceId}/session/${session.id}`);
      } else {
        router.push(`/workspace/${workspaceId}`);
      }
    } catch (err) {
      toastError(err, t("misc.couldNotStartSession"));
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void run(files);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void run(Array.from(e.dataTransfer.files ?? []));
        }}
        className={cn(
          "flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left transition-colors",
          busy
            ? "cursor-wait bg-muted/40"
            : dragOver
              ? "bg-accent-soft"
              : "hover:bg-muted/50",
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">
            {busy ? t("misc.buildingFromFiles") : t("misc.uploadNotes")}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {t("misc.uploadNotesHint")}
          </span>
        </span>
      </button>
    </>
  );
}
