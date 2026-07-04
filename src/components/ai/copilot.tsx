"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Sparkles, X, ArrowUp, Wand2, Plus } from "lucide-react";
import { EquationEmbed, GraphEmbed, CitationEmbed } from "@/components/ai/embeds";
import {
  InteractiveWidget,
  WidgetId,
  widgetRegistry,
} from "@/components/interactive";
import {
  ChatMessage,
  EmbedPart,
  suggestions,
} from "@/components/ai/chat-types";
import { ToolCallChip } from "@/components/ai/tool-call-chip";
import {
  askCopilot,
  createConversation,
  listConversations,
} from "@/lib/api/copilot";

let idCounter = 0;
const nextId = () => `m-${++idCounter}-${Date.now()}`;

const availableWidgets = (
  Object.keys(widgetRegistry) as WidgetId[]
).map((id) => ({ id, description: widgetRegistry[id].label }));

interface ChatTab {
  id: string;
  title: string;
}

export function Copilot({
  open,
  onClose,
  context,
  workspaceId,
}: {
  open: boolean;
  onClose: () => void;
  context?: string;
  workspaceId: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chats, setChats] = useState<ChatTab[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chatsLoading, setChatsLoading] = useState(true);

  useEffect(() => {
    listConversations(workspaceId)
      .then((rows) => {
        setChats(rows);
        setActiveChat(rows[0]?.id ?? null);
      })
      .catch(() => {})
      .finally(() => setChatsLoading(false));
  }, [workspaceId]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const resizing = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      e.preventDefault();
      const w = window.innerWidth - e.clientX;
      setWidth(Math.min(Math.max(w, 380), Math.round(window.innerWidth * 0.75)));
    };
    const onUp = () => {
      resizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return;
      setInput("");
      setBusy(true);
      const pendingChatId = activeChat ?? "pending";
      const userMsg: ChatMessage = {
        id: nextId(),
        chatId: pendingChatId,
        role: "user",
        parts: [{ kind: "text", id: nextId(), text, done: true }],
      };
      const assistantId = nextId();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, chatId: pendingChatId, role: "assistant", parts: [] },
      ]);
      try {
        let conversationId = activeChat;
        if (!conversationId) {
          const conv = await createConversation(workspaceId);
          conversationId = conv.id;
          setChats((prev) => [...prev, conv]);
          setMessages((prev) =>
            prev.map((m) =>
              m.chatId === pendingChatId ? { ...m, chatId: conv.id } : m,
            ),
          );
          setActiveChat(conv.id);
        }
        const result = await askCopilot({
          workspaceId,
          conversationId,
          message: text,
          documentContent: context,
          availableWidgets,
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  parts: [
                    {
                      kind: "text",
                      id: nextId(),
                      text: result.answer,
                      done: true,
                    },
                    ...result.widgets
                      .filter((id): id is WidgetId => id in widgetRegistry)
                      .map(
                        (id) =>
                          ({
                            kind: "embed",
                            id: nextId(),
                            embed: "widget",
                            widget: id,
                          }) as EmbedPart,
                      ),
                  ],
                }
              : m,
          ),
        );
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  parts: [
                    {
                      kind: "text",
                      id: nextId(),
                      text:
                        err instanceof Error
                          ? err.message
                          : "Something went wrong — try again.",
                      done: true,
                    },
                  ],
                }
              : m,
          ),
        );
      }
      setBusy(false);
    },
    [busy, activeChat, workspaceId, context],
  );

  const chatMessages = messages.filter(
    (m) => (m.chatId ?? "pending") === (activeChat ?? "pending"),
  );

  const newChat = async () => {
    try {
      const conv = await createConversation(workspaceId);
      setChats((prev) => [...prev, conv]);
      setActiveChat(conv.id);
    } catch {
      // keep current chat; the next send retries conversation creation
    }
  };

  if (!open) return null;

  return (
    <div
      className="relative self-stretch shrink-0 hidden sm:flex flex-col bg-card border-l border-border min-h-0"
      style={width ? { width } : { width: "25vw", minWidth: 380 }}
    >
      {/* Resize handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize copilot panel"
        onMouseDown={() => {
          resizing.current = true;
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
        }}
        className="absolute left-0 inset-y-0 w-1.5 -translate-x-1/2 cursor-col-resize z-10 hover:bg-accent/40 active:bg-accent/60 transition-colors"
      />
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-12 border-b border-border shrink-0">
        <p className="text-sm font-semibold shrink-0">Copilot</p>
        <div className="flex items-center gap-1 ml-1 flex-1 min-w-0 overflow-x-auto">
          {chatsLoading &&
            [0, 1].map((i) => (
              <span
                key={i}
                className="h-5 w-14 rounded-full bg-muted animate-pulse shrink-0"
              />
            ))}
          {chats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveChat(c.id)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0",
                c.id === activeChat
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {c.title}
            </button>
          ))}
          <button
            type="button"
            aria-label="New chat"
            onClick={() => void newChat()}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {chatMessages.length === 0 && (
          <div className="pt-8 text-center space-y-5">
            <Wand2 className="h-7 w-7 text-accent mx-auto" />
            <div>
              <p className="text-sm font-semibold">What do you need?</p>
              <p className="text-xs text-muted-foreground mt-1">
                {context ? `${context} — ` : ""}I can reshape your plan, dig
                through your materials, or quiz you.
              </p>
            </div>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="block w-full text-left text-xs px-3.5 py-2.5 rounded-xl border border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:border-border-strong"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg) =>
          msg.role === "user" ? (
            <div key={msg.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent text-accent-foreground px-3.5 py-2 text-sm font-medium">
                {msg.parts[0].kind === "text" && msg.parts[0].text}
              </div>
            </div>
          ) : (
            <div key={msg.id} className="space-y-0.5">
              {msg.parts.length === 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
                  Thinking…
                </div>
              )}
              {msg.parts.map((part) =>
                part.kind === "tool" ? (
                  <ToolCallChip key={part.id} part={part} />
                ) : part.kind === "embed" ? (
                  part.embed === "equation" ? (
                    <EquationEmbed
                      key={part.id}
                      latex={part.latex}
                      caption={part.caption}
                    />
                  ) : part.embed === "graph" ? (
                    <GraphEmbed key={part.id} data={part.graph} />
                  ) : part.embed === "widget" ? (
                    <InteractiveWidget key={part.id} id={part.widget} />
                  ) : (
                    <CitationEmbed key={part.id} data={part.citation} />
                  )
                ) : (
                  <p key={part.id} className="text-sm leading-relaxed px-1 py-1">
                    {part.text}
                    {!part.done && (
                      <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-accent align-middle animate-pulse-dot" />
                    )}
                  </p>
                ),
              )}
            </div>
          ),
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2 rounded-2xl border border-border-strong bg-muted/50 px-3 py-2 focus-within:border-accent/50"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask, search, or change your plan…"
            className="flex-1 resize-none bg-transparent text-sm focus:outline-none placeholder:text-faint py-1"
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground disabled:opacity-30 shrink-0"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

export function CopilotTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 h-11 pl-4 pr-5 rounded-full bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent-dim active:scale-95 transition-all"
    >
      <Sparkles className="h-4 w-4" />
      Ask Scribe
    </button>
  );
}
