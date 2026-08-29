"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowUp, FileText, Loader2, Paperclip, X } from "lucide-react";
import { createWorkspace } from "@/lib/api/workspace";
import { analyzeFiles, uploadFiles } from "@/lib/api/materials";
import { emitTreeChanged } from "@/lib/tree-events";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";
import { toastError } from "@/lib/toast";

/**
 * Intake entry point: the first message creates a workspace, uploads any
 * attached files into it, and hands the conversation off to the workspace's
 * chat assistant (`/workspace/[id]/chat`), where it continues.
 */

const SUGGESTION_KEYS = [
  "misc.suggestionIntegration",
  "misc.suggestionBio",
  "misc.suggestionChem",
  "misc.suggestionSpanish",
];

export default function StudyBotPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const send = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if ((!text && pendingFiles.length === 0) || busy) return;
    const files = pendingFiles;
    setBusy(true);
    try {
      const title =
        text.length > 0
          ? text.slice(0, 60)
          : files[0]?.name.replace(/\.[^.]+$/, "").slice(0, 60) ||
            "Study session";
      const id = await createWorkspace(title);
      if (!id) throw new Error(t("misc.couldNotCreateWorkspace"));
      emitTreeChanged();

      if (files.length > 0) {
        const fileIds = await uploadFiles(id, files);
        // Analysis runs in the background; the chat can start meanwhile.
        analyzeFiles(id, fileIds).catch(() => {});
      }

      const message =
        text ||
        `I just uploaded ${files.length} file(s): ${files.map((f) => f.name).join(", ")}`;
      router.replace(`/workspace/${id}/chat?q=${encodeURIComponent(message)}`);
    } catch (err) {
      toastError(err, t("misc.studyBotError"));
      setBusy(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-card px-6 py-10">
      <div className="w-full max-w-xl animate-fade-up">
        <div className="text-center">
          <Image
            src="/illustrations/blob-hello-poster.png"
            alt=""
            width={200}
            height={200}
            priority
            className="pointer-events-none mx-auto mb-5 h-28 w-28 select-none object-cover [mask-image:radial-gradient(circle_closest-side,black_68%,transparent_100%)] [-webkit-mask-image:radial-gradient(circle_closest-side,black_68%,transparent_100%)]"
          />
          <h1 className="text-[26px] font-bold tracking-tight sm:text-3xl">
            {t("misc.studyBotTitle")}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            {t("misc.studyBotSubtitle")}
          </p>
        </div>

        <div className="mt-7">
          <div className="w-full rounded-2xl border border-border bg-card p-2.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
            {pendingFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5 px-1 pt-1">
                {pendingFiles.map((f, i) => (
                  <span
                    key={`${f.name}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1 text-[11px] font-medium"
                  >
                    <FileText className="h-3 w-3 text-accent" />
                    <span className="max-w-[10rem] truncate">{f.name}</span>
                    <button
                      type="button"
                      aria-label={`${t("misc.remove")} ${f.name}`}
                      onClick={() =>
                        setPendingFiles((prev) =>
                          prev.filter((_, j) => j !== i),
                        )
                      }
                      className="text-faint hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <textarea
                value={input}
                rows={2}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={t("misc.studyBotExample")}
                className="block w-full resize-none bg-transparent px-2 py-1.5 text-sm placeholder:text-faint focus:outline-none"
              />
              <div className="flex items-center justify-between pt-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="application/pdf,image/*,audio/*,video/*,.doc,.docx,.ppt,.pptx,.txt,.md"
                  className="hidden"
                  onChange={(e) => {
                    const chosen = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (chosen.length > 0)
                      setPendingFiles((prev) => [...prev, ...chosen]);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {t("misc.attachNotes")}
                </button>
                <button
                  type="submit"
                  aria-label={t("misc.send")}
                  disabled={busy || (!input.trim() && pendingFiles.length === 0)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {SUGGESTION_KEYS.map((key) => {
            const s = t(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => void send(s)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-dim"
              >
                {s}
              </button>
            );
          })}
        </div>
        <p className="mt-5 text-center text-[11px] text-faint">
          {t("misc.studyBotFooter")}
        </p>
      </div>
    </main>
  );
}
