"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUp,
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

const READY_RE = /enough|start study session|ready to (start|go|begin)/i;

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
  const [uploadedCount, setUploadedCount] = useState(0);

  const started = messages.length > 0;
  const lastBot = [...messages].reverse().find((m) => m.role === "bot");
  const botSaysReady = !!lastBot && READY_RE.test(lastBot.text);
  const userTurns = messages.filter((m) => m.role === "user").length;
  const ready = botSaysReady || userTurns >= 2 || uploadedCount > 0;

  const scrollDown = () =>
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );

  const send = async () => {
    const text = input.trim();
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
        setUploadedCount((n) => n + files.length);
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
    <div className="w-full">
      {pendingFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {pendingFiles.map((f, i) => (
            <span
              key={`${f.name}-${i}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium"
            >
              {f.name}
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
        className="relative"
      >
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
          aria-label="Attach files"
          onClick={() => fileInputRef.current?.click()}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-faint hover:bg-muted hover:text-foreground"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            started
              ? "Reply to the study bot…"
              : "I need to practice IB Math AA integration by parts…"
          }
          className="h-12 w-full rounded-full border border-border bg-card pl-11 pr-12 text-sm shadow-sm placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={busy || (!input.trim() && pendingFiles.length === 0)}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </button>
      </form>
    </div>
  );

  if (!started) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft">
            <MessageCircle className="h-6 w-6 text-accent" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            What do you need to study?
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Tell the bot your subject and topics, drop in notes or past papers
            — it&apos;ll set up a study session for you.
          </p>
          <div className="mt-6">{composer}</div>
          <p className="mt-3 text-[11px] text-faint">
            Chatting is free · generating the session costs 20 tokens
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6">
        <div className="flex items-center justify-between gap-3 pb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-accent" />
            <h1 className="text-sm font-semibold">Study bot</h1>
          </div>
          {hasWorkspace && (
            <Button
              size="sm"
              onClick={() => void startSession()}
              disabled={starting}
              className={cn(ready && !starting && "animate-pulse")}
            >
              {starting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Building your session…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  Start study session · 20 tokens
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto pb-4">
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
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-accent text-white"
                    : "border border-border bg-card",
                )}
              >
                {m.text ||
                  (m.role === "bot" && (
                    <Loader2 className="h-4 w-4 animate-spin text-faint" />
                  ))}
                {m.files && m.files.length > 0 && (
                  <p
                    className={cn(
                      "mt-1 text-[11px]",
                      m.role === "user" ? "text-white/70" : "text-faint",
                    )}
                  >
                    {m.files.join(", ")}
                  </p>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="sticky bottom-0 bg-background pb-2 pt-2">
          {composer}
        </div>
      </div>
    </main>
  );
}
