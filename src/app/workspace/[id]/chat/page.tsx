"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { fetchWorkspace } from "@/lib/api/workspace";
import { fetchStudySessions } from "@/lib/api/study";
import { fetchMasteryMatrix } from "@/lib/api/study-session";
import { analyzeFiles, uploadFiles } from "@/lib/api/materials";
import {
  askCopilotStream,
  createConversation,
  getConversationMessages,
  listConversations,
} from "@/lib/api/copilot";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { MarkdownText } from "@/components/ui/markdown-text";
import { Skeleton } from "@/components/ui/skeleton";
import { emitTreeChanged } from "@/lib/tree-events";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/workspace";
import "@/lib/i18n/misc";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "bot";
  text: string;
  files?: string[];
  /** Study sessions created/attached by the bot in this turn (render open CTAs). */
  sessionIds?: string[];
}

/** Title used to find/create the persistent workspace-assistant conversation. */
const CHAT_CONVERSATION_TITLE = "Workspace chat";

/**
 * Assistant brief passed as the copilot's document context on every turn:
 * turns the workspace copilot into the ongoing workspace study assistant.
 */
const ASSISTANT_BRIEF = `You are Scribe's workspace study assistant — the student's ongoing study partner inside this workspace. Your job:
- Help them review: quiz them with short questions on their materials (one question at a time, grade their answer, explain), summarize topics, and answer questions grounded in their uploads and sessions.
- Keep momentum: suggest a concrete next step based on WORKSPACE_STATUS (finish an in-progress session, review a weak topic, or start something new).
- When a full session would serve them better than chat, offer to build one with create_study_session — and let them choose between opening it or practising the questions with you right here.
- When you point them to a specific existing session (finish it, redo it, review it), call attach_study_session with its id from WORKSPACE_STATUS so they get an openable card.
- When they upload files, acknowledge them and ask what to focus on.
- Use manage_workspace when they ask to rename the workspace, change its description, or tell you how confident they feel about a topic.
- Keep replies short (under 4 sentences unless explaining or quizzing).`;

/**
 * Blob mascot: plays the hello video, but falls back to the still poster
 * when autoplay is blocked (mobile low-power mode shows a play glyph
 * over a paused inline video otherwise).
 */
function BlobHello() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [usePoster, setUsePoster] = useState(false);
  const blendClass =
    "pointer-events-none mx-auto mb-4 h-32 w-32 select-none object-cover mix-blend-multiply [mask-image:radial-gradient(circle_closest-side,black_68%,transparent_100%)] [-webkit-mask-image:radial-gradient(circle_closest-side,black_68%,transparent_100%)]";

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => setUsePoster(true));
  }, [usePoster]);

  if (usePoster) {
    return (
      <Image
        src="/illustrations/blob-hello-poster.jpg"
        alt=""
        width={200}
        height={200}
        priority
        aria-hidden
        className={blendClass}
      />
    );
  }
  return (
    <video
      ref={videoRef}
      src="/illustrations/blob-hello.mp4"
      poster="/illustrations/blob-hello-poster.jpg"
      autoPlay
      loop
      muted
      playsInline
      disablePictureInPicture
      aria-hidden
      className={blendClass}
    />
  );
}

/** File chip shown on pending uploads and inside chat messages. */
function FileChip({
  name,
  variant,
  onRemove,
  removeLabel,
}: {
  name: string;
  variant: "user" | "bot" | "pending";
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toUpperCase() : "FILE";
  return (
    <span
      className={cn(
        "inline-flex max-w-[14rem] items-center gap-2 rounded-xl px-2 py-1.5",
        variant === "user"
          ? "bg-white/15"
          : "border border-border bg-muted/60",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          variant === "user" ? "bg-white/20 text-white" : "bg-accent-soft text-accent",
        )}
      >
        <FileText className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate text-[12px] font-semibold leading-tight",
            variant === "user" ? "text-white" : "text-foreground",
          )}
        >
          {stem}
        </span>
        <span
          className={cn(
            "block text-[10px] font-medium leading-tight",
            variant === "user" ? "text-white/70" : "text-faint",
          )}
        >
          {ext}
        </span>
      </span>
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          className="ml-0.5 shrink-0 text-faint hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}

const SUGGESTION_KEYS = [
  "ws.chat.suggestQuiz",
  "ws.chat.suggestSession",
  "ws.chat.suggestReview",
  "ws.chat.suggestExplain",
];

export default function WorkspaceChatPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const workspaceId = params.id as string;

  const { data: workspace, isLoading: workspaceLoading } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => fetchWorkspace(workspaceId),
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ["study-sessions", workspaceId],
    queryFn: () => fetchStudySessions(workspaceId),
  });
  const { data: masteryMatrix = [] } = useQuery({
    queryKey: ["mastery-matrix", workspaceId],
    queryFn: () => fetchMasteryMatrix(workspaceId),
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationIdRef = useRef<string | undefined>(undefined);
  const autoSentRef = useRef(false);

  // Load (or find) the persistent workspace conversation and its history.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const conversations = await listConversations(workspaceId);
        const existing =
          conversations.find((c) => c.title === CHAT_CONVERSATION_TITLE) ??
          conversations.find((c) => c.title === "Study bot");
        if (existing) {
          conversationIdRef.current = existing.id;
          const history = await getConversationMessages(
            workspaceId,
            existing.id,
          );
          if (cancelled) return;
          setMessages(
            history.map((m) => ({
              role: m.role === "user" ? "user" : "bot",
              text: m.content,
            })),
          );
        }
      } catch {
        // Missing history is not fatal — the chat starts fresh.
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const scrollDown = () =>
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );

  /** Live snapshot of the workspace the bot reasons over each turn. */
  const workspaceStatus = () => {
    const materials = (workspace?.materials ?? [])
      .slice(0, 20)
      .map((m) => `- ${m.title}${m.analyzed ? "" : " (still analyzing)"}`)
      .join("\n");
    const sessionLines = sessions
      .slice(0, 12)
      .map(
        (s) =>
          `- [id: ${s.id}] "${s.title}": ${s.status}, ${s.progress}% complete${s.generating ? " (generating)" : ""}`,
      )
      .join("\n");
    const weak = masteryMatrix
      .filter((r) => r.proficiency !== null)
      .sort((a, b) => (a.proficiency ?? 0) - (b.proficiency ?? 0))
      .slice(0, 5)
      .map((r) => `- ${r.topic}: ${r.proficiency}%`)
      .join("\n");
    return [
      "WORKSPACE_STATUS:",
      `Workspace: "${workspace?.title ?? ""}"${workspace?.description ? ` — ${workspace.description}` : ""}`,
      materials ? `Materials:\n${materials}` : "Materials: none uploaded yet.",
      sessionLines
        ? `Study sessions:\n${sessionLines}`
        : "Study sessions: none yet.",
      weak ? `Weakest topics (proficiency):\n${weak}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  };

  const send = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if ((!text && pendingFiles.length === 0) || busy) return;
    const files = pendingFiles;
    setInput("");
    setPendingFiles([]);
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: text || t("misc.uploadedFiles"),
        files: files.map((f) => f.name),
      },
    ]);
    scrollDown();
    try {
      if (files.length > 0) {
        const fileIds = await uploadFiles(workspaceId, files);
        // Analysis runs in the background; the bot can keep chatting.
        analyzeFiles(workspaceId, fileIds).catch(() => {});
        queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      }

      if (!conversationIdRef.current) {
        const conversation = await createConversation(
          workspaceId,
          CHAT_CONVERSATION_TITLE,
        );
        conversationIdRef.current = conversation.id;
      }

      setMessages((prev) => [...prev, { role: "bot", text: "" }]);
      const fileNames = files.map((f) => f.name).join(", ");
      const message = text
        ? files.length > 0
          ? `${text}\n\n[Attached: ${fileNames}]`
          : text
        : `I just uploaded ${files.length} file(s): ${fileNames}`;
      const result = await askCopilotStream(
        {
          workspaceId,
          conversationId: conversationIdRef.current,
          message,
          documentContent: `${ASSISTANT_BRIEF}\n\n${workspaceStatus()}`,
          workspaceAgent: true,
        },
        (delta) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "bot")
              next[next.length - 1] = { ...last, text: last.text + delta };
            return next;
          });
          scrollDown();
        },
      );
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "bot")
          next[next.length - 1] = {
            ...last,
            text: result.answer,
            sessionIds: [
              ...(result.createdSessionId ? [result.createdSessionId] : []),
              ...(result.attachedSessionIds ?? []).filter(
                (id) => id !== result.createdSessionId,
              ),
            ],
          };
        return next;
      });
      if (result.createdSessionId) {
        queryClient.invalidateQueries({
          queryKey: ["study-sessions", workspaceId],
        });
      }
      if (result.workspaceModified) {
        queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
        queryClient.invalidateQueries({ queryKey: ["mastery-matrix", workspaceId] });
        emitTreeChanged();
      }
      scrollDown();
    } catch (err) {
      toastError(err, t("misc.studyBotError"));
      setMessages((prev) =>
        prev[prev.length - 1]?.role === "bot" &&
        prev[prev.length - 1]?.text === ""
          ? prev.slice(0, -1)
          : prev,
      );
    } finally {
      setBusy(false);
    }
  };

  // Intake handoff: /workspace/[id]/chat?q=… auto-sends the first message.
  useEffect(() => {
    const q = searchParams.get("q");
    if (!q || autoSentRef.current || !historyLoaded || !workspace) return;
    autoSentRef.current = true;
    router.replace(`/workspace/${workspaceId}/chat`, { scroll: false });
    void send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, historyLoaded, workspace]);

  /** Proactive opener based on where the student is right now. */
  const welcomeText = () => {
    const resumable = sessions.find(
      (s) => s.status === "active" && s.progress > 0 && !s.generating,
    );
    if (resumable) {
      return t("ws.chat.welcomeResume")
        .replace("{title}", resumable.title)
        .replace("{progress}", String(resumable.progress));
    }
    const weakest = masteryMatrix
      .filter((r) => r.proficiency !== null && r.attempts > 0)
      .sort((a, b) => (a.proficiency ?? 0) - (b.proficiency ?? 0))[0];
    if (weakest) {
      return t("ws.chat.welcomeWeakTopic").replace("{topic}", weakest.topic);
    }
    if ((workspace?.materials ?? []).length > 0 && sessions.length === 0) {
      return t("ws.chat.welcomeFirstSession");
    }
    return t("ws.chat.welcomeEmpty");
  };

  const composer = (
    <div className="w-full rounded-2xl border border-border bg-card p-2.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
      {pendingFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5 px-1 pt-1">
          {pendingFiles.map((f, i) => (
            <FileChip
              key={`${f.name}-${i}`}
              name={f.name}
              variant="pending"
              removeLabel={`${t("misc.remove")} ${f.name}`}
              onRemove={() =>
                setPendingFiles((prev) => prev.filter((_, j) => j !== i))
              }
            />
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
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={t("ws.chat.placeholder")}
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
  );

  if (workspaceLoading || !historyLoaded) {
    return (
      <WorkspaceShell workspace={workspace} loading>
        <div className="flex h-full min-h-[60vh] w-full flex-col items-center justify-center gap-3">
          <Image
            src="/illustrations/blob-hello-poster.jpg"
            alt=""
            width={112}
            height={112}
            priority
            aria-hidden
            className="pointer-events-none h-20 w-20 select-none object-cover opacity-80 mix-blend-multiply [mask-image:radial-gradient(circle_closest-side,black_68%,transparent_100%)] [-webkit-mask-image:radial-gradient(circle_closest-side,black_68%,transparent_100%)]"
          />
          <Skeleton className="h-4 w-40 rounded-full" />
          <Skeleton className="h-3 w-56 rounded-full" />
        </div>
      </WorkspaceShell>
    );
  }

  const latestMaterials = [...(workspace?.materials ?? [])]
    .sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 6);
  const latestSessions = sessions.slice(0, 5);

  const sidebar = (
    <aside className="sticky top-24 hidden w-72 shrink-0 flex-col gap-4 self-start py-5 pr-4 min-[1360px]:flex">
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">{t("ws.materials")}</h2>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Upload className="h-3 w-3" />
            {t("ws.upload")}
          </button>
        </div>
        {latestMaterials.length === 0 ? (
          <p className="text-[12px] text-faint">{t("ws.chat.noMaterials")}</p>
        ) : (
          <ul className="space-y-1">
            {latestMaterials.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/workspace/${workspaceId}/study`}
                  className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <FileText className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-medium">
                      {m.title}
                    </span>
                    {!m.analyzed && (
                      <span className="block text-[10px] text-faint">
                        {t("ws.chat.analyzing")}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold">{t("ws.studySessions")}</h2>
          <Link
            href={`/workspace/${workspaceId}/study?create=1`}
            className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Plus className="h-3 w-3" />
            {t("ws.newSession")}
          </Link>
        </div>
        {latestSessions.length === 0 ? (
          <p className="text-[12px] text-faint">{t("ws.chat.noSessions")}</p>
        ) : (
          <ul className="space-y-1">
            {latestSessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/workspace/${workspaceId}/session/${s.id}`}
                  className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium">
                      {s.title}
                    </span>
                    <span className="block text-[10px] text-faint">
                      {s.generating
                        ? t("ws.chat.generating")
                        : `${s.progress}%`}
                    </span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/workspace/${workspaceId}/study`}
          className="mt-2 inline-flex items-center gap-1 px-2 text-[11px] font-semibold text-accent hover:underline"
        >
          {t("ws.viewAll")}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </section>
    </aside>
  );

  return (
    <WorkspaceShell workspace={workspace} flush>
      <div className="mx-auto flex w-full max-w-6xl flex-1 items-stretch justify-center gap-2">
        <div className="flex w-full min-w-0 max-w-3xl flex-1 flex-col px-4 py-5">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto pb-4">
          {/* Spacer pushes a short conversation down next to the composer
              without breaking scroll-to-top when it overflows. */}
          <div aria-hidden className="flex-1" />

          {messages.length === 0 && (
            <div className="mb-2 text-center animate-fade-up">
              <BlobHello />
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                {workspace?.title}
              </h1>
            </div>
          )}

          {messages.length === 0 && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2.5 text-sm leading-relaxed">
                {welcomeText()}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "rounded-2xl rounded-br-md bg-accent text-accent-foreground whitespace-pre-wrap"
                    : "rounded-2xl rounded-bl-md border border-border bg-card",
                )}
              >
                {m.role === "bot" && m.text ? (
                  <MarkdownText text={m.text} />
                ) : null}
                {m.role !== "bot" && m.text}
                {!m.text && m.role === "bot" && (
                  <span className="inline-flex items-center gap-1.5 text-faint">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("misc.thinking")}
                  </span>
                )}
                {m.role === "bot" && m.sessionIds && m.sessionIds.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {m.sessionIds.map((sid) => {
                      const session = sessions.find((s) => s.id === sid);
                      return (
                        <button
                          key={sid}
                          type="button"
                          onClick={() =>
                            router.push(`/workspace/${workspaceId}/session/${sid}`)
                          }
                          className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90"
                        >
                          <Sparkles className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">
                            {session?.title ?? t("ws.chat.openSession")}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
                {m.files && m.files.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.files.map((name, j) => (
                      <FileChip
                        key={`${name}-${j}`}
                        name={name}
                        variant={m.role === "user" ? "user" : "bot"}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="sticky bottom-0 bg-background pb-2 pt-1.5">
          {messages.length === 0 && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
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
          )}
          {composer}
        </div>
        </div>
        {sidebar}
      </div>
    </WorkspaceShell>
  );
}
