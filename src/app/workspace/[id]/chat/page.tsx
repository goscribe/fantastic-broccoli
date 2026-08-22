"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUp,
  FileText,
  Loader2,
  Paperclip,
  Sparkles,
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
  /** Study session created by the bot in this turn (renders an open CTA). */
  sessionId?: string;
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
- When they upload files, acknowledge them and ask what to focus on.
- Use manage_workspace when they ask to rename the workspace, change its description, or tell you how confident they feel about a topic.
- Keep replies short (under 4 sentences unless explaining or quizzing).`;

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
          `- "${s.title}": ${s.status}, ${s.progress}% complete${s.generating ? " (generating)" : ""}`,
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
            sessionId: result.createdSessionId,
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
                  setPendingFiles((prev) => prev.filter((_, j) => j !== i))
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
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-10 w-2/3 rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell workspace={workspace} flush>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-5">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto pb-4">
          {/* Spacer pushes a short conversation down next to the composer
              without breaking scroll-to-top when it overflows. */}
          <div aria-hidden className="flex-1" />

          {messages.length === 0 && (
            <div className="mb-2 text-center animate-fade-up">
              <video
                src="/illustrations/blob-hello.mp4"
                poster="/illustrations/blob-hello-poster.jpg"
                autoPlay
                loop
                muted
                playsInline
                aria-hidden
                className="pointer-events-none mx-auto mb-4 h-32 w-32 select-none object-cover mix-blend-multiply [mask-image:radial-gradient(circle_closest-side,black_68%,transparent_100%)] [-webkit-mask-image:radial-gradient(circle_closest-side,black_68%,transparent_100%)]"
              />
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
                {m.role === "bot" && m.sessionId && (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/workspace/${workspaceId}/session/${m.sessionId}`,
                      )
                    }
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-accent-foreground transition-opacity hover:opacity-90"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {t("ws.chat.openSession")}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
                {m.files && m.files.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.files.map((name, j) => (
                      <span
                        key={`${name}-${j}`}
                        className={cn(
                          "inline-flex max-w-[12rem] items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium",
                          m.role === "user"
                            ? "bg-white/15 text-white"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="truncate">{name}</span>
                      </span>
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
    </WorkspaceShell>
  );
}
