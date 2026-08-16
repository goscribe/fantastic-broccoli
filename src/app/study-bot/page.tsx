"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUp,
  FileText,
  Loader2,
  MessageCircle,
  Paperclip,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createWorkspace } from "@/lib/api/workspace";
import { createStudySession } from "@/lib/api/study";
import { analyzeFiles, uploadFiles } from "@/lib/api/materials";
import { askCopilotStream, createConversation } from "@/lib/api/copilot";
import { emitTreeChanged } from "@/lib/tree-events";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { MarkdownText } from "@/components/ui/markdown-text";

interface ChatMessage {
  role: "user" | "bot";
  text: string;
  files?: string[];
}

/**
 * Intake brief passed as the copilot's document context on every turn: turns
 * the workspace copilot into a short-form study-intake assistant.
 */
const INTAKE_BRIEF = `You are Scribe's study intake bot. The user is setting up a new study session by chatting with you. Your job:
- Find out what they need to study: subject, exam board/level if any, the specific topics or units, and what they struggle with.
- Ask ONE short follow-up question at a time. Keep every reply under 3 sentences.
- If they upload files, acknowledge them and ask what to focus on.
- Once you know the subject and at least one concrete topic, tell them you have enough and that they should press "Start study session" to begin.
Do not generate study content yourself — the session generator does that.`;

const SUGGESTIONS = [
  "Practice IB Math AA integration by parts",
  "Quiz me on AP Bio cellular respiration",
  "Help me revise GCSE chemistry bonding",
  "Drill Spanish preterite vs imperfect",
];

export default function StudyBotPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Workspace + conversation are created lazily on the first message.
  const workspaceIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | undefined>(undefined);
  const workspaceTitleRef = useRef<string>("");
  const [hasWorkspace, setHasWorkspace] = useState(false);

  const started = messages.length > 0;

  const scrollDown = () =>
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );

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
        text: text || "(uploaded files)",
        files: files.map((f) => f.name),
      },
    ]);
    scrollDown();
    try {
      if (!workspaceIdRef.current) {
        const title =
          text.length > 0
            ? text.slice(0, 60)
            : files[0]?.name.replace(/\.[^.]+$/, "").slice(0, 60) || "Study session";
        const id = await createWorkspace(title);
        if (!id) throw new Error("Could not create a workspace");
        workspaceIdRef.current = id;
        workspaceTitleRef.current = title;
        setHasWorkspace(true);
        emitTreeChanged();
      }
      const workspaceId = workspaceIdRef.current;

      if (files.length > 0) {
        const fileIds = await uploadFiles(workspaceId, files);
        // Analysis runs in the background; the bot can keep chatting.
        analyzeFiles(workspaceId, fileIds).catch(() => {});
      }

      if (!conversationIdRef.current) {
        const conversation = await createConversation(
          workspaceId,
          "Study bot",
        );
        conversationIdRef.current = conversation.id;
      }

      setMessages((prev) => [...prev, { role: "bot", text: "" }]);
      const message =
        text ||
        `I just uploaded ${files.length} file(s): ${files.map((f) => f.name).join(", ")}`;
      const result = await askCopilotStream(
        {
          workspaceId,
          conversationId: conversationIdRef.current,
          message,
          documentContent: INTAKE_BRIEF,
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
          next[next.length - 1] = { ...last, text: result.answer };
        return next;
      });
      scrollDown();
    } catch (err) {
      toastError(err, "The study bot hit an error — try again.");
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

  const startSession = async () => {
    const workspaceId = workspaceIdRef.current;
    if (!workspaceId || starting) return;
    setStarting(true);
    try {
      const topics = messages
        .filter((m) => m.role === "user")
        .map((m) => m.text)
        .join("; ")
        .slice(0, 2000);
      const session = await createStudySession({
        workspaceId,
        title: workspaceTitleRef.current || "Study session",
        depth: "moderate",
        durationMinutes: 30,
        topics: topics || undefined,
      });
      if (session) {
        router.push(`/workspace/${workspaceId}/session/${session.id}`);
      } else {
        router.push(`/workspace/${workspaceId}`);
      }
    } catch (err) {
      toastError(err, "Could not start the session");
      setStarting(false);
    }
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
                aria-label={`Remove ${f.name}`}
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
          rows={started ? 1 : 2}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={
            started
              ? "Reply to the study bot…"
              : "I need to practice IB Math AA integration by parts…"
          }
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
            Attach notes
          </button>
          <button
            type="submit"
            aria-label="Send"
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

  if (!started) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl animate-fade-up">
          <div className="text-center">
            <h1 className="text-[26px] font-bold tracking-tight sm:text-3xl">
              What do you need to study?
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Tell the bot your subject and topics, or drop in notes and past
              papers — it&apos;ll set up a study session for you.
            </p>
          </div>
          <div className="mt-7">{composer}</div>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-dim"
              >
                {s}
              </button>
            ))}
          </div>
          <p className="mt-5 text-center text-[11px] text-faint">
            Chatting is free · generating the session costs 20 tokens
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-5">
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-accent" />
            <h1 className="text-sm font-semibold">Study bot</h1>
          </div>
          {hasWorkspace && (
            <Button
              size="sm"
              onClick={() => void startSession()}
              disabled={starting}
              className="shrink-0"
            >
              {starting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Building your session…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Start session · 20 tokens
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto pb-4">
          {/* Spacer pushes a short conversation down next to the composer
              without breaking scroll-to-top when it overflows. */}
          <div aria-hidden className="flex-1" />
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
                    Thinking…
                  </span>
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
          {composer}
        </div>
      </div>
    </main>
  );
}
