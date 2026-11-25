"use client";

import { Mascot } from "@/components/rewards/mascot";
import { useEffect, useLayoutEffect, useRef, useState, useCallback, type RefObject } from "react";
import { BUBBLE_GAP, bubbleRoom } from "@/lib/copilot-bubble";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useNewUi } from "@/lib/new-ui";
import "@/app/design/design.css";
import { toastError } from "@/lib/toast";
import { ArrowUp, PanelRightClose, PanelRightOpen, Plus, Sparkles, Square, X } from "lucide-react";
import Image from "next/image";
import { EquationEmbed, GraphEmbed, CitationEmbed } from "@/components/ai/embeds";
import {
  InteractiveWidget,
  WidgetId,
  widgetRegistry,
} from "@/components/interactive";
import { HtmlWidget } from "@/components/interactive/html-widget";
import {
  ChatMessage,
  EmbedPart,
  ToolCallPart,
  suggestions,
  WORKSPACE_SUGGESTIONS,
} from "@/components/ai/chat-types";
import { ToolCallChip } from "@/components/ai/tool-call-chip";
import {
  askCopilotStream,
  createConversation,
  getConversationMessages,
  listConversations,
} from "@/lib/api/copilot";
import type {
  CopilotHighlight,
  CopilotToolCall,
  CopilotVisualization,
} from "@/lib/api/copilot";
import { MarkdownText } from "@/components/ui/markdown-text";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/misc";
import { inputBoxClass, bareInputClass } from "@/components/ui/input";

let idCounter = 0;
const nextId = () => `m-${++idCounter}-${Date.now()}`;

/** Completed chips for the tools the server ran while answering. */
function buildToolParts(toolCalls: CopilotToolCall[]): ToolCallPart[] {
  return toolCalls.map((tc) => ({
    kind: "tool",
    id: nextId(),
    tool: tc.name,
    label: tc.label,
    args: tc.detail,
    result: "",
    status: "done",
    sources: tc.sources,
  }));
}

/** Tool chip + widget/visualization embed parts for a set of study aids. */
function buildAidParts(aids: {
  widgets: string[];
  visualizations: CopilotVisualization[];
  highlights: CopilotHighlight[];
}): (ToolCallPart | EmbedPart)[] {
  const aidBits = [
    aids.visualizations.length &&
      `${aids.visualizations.length} visualization${aids.visualizations.length > 1 ? "s" : ""}`,
    aids.widgets.length &&
      `${aids.widgets.length} widget${aids.widgets.length > 1 ? "s" : ""}`,
    aids.highlights.length &&
      `${aids.highlights.length} highlight${aids.highlights.length > 1 ? "s" : ""}`,
  ].filter((b): b is string => Boolean(b));
  const aidDetails = [
    ...aids.visualizations.map((v) => v.title ?? "Custom visualization"),
    ...aids.widgets,
    ...aids.highlights.map((h) => h.label ?? `"${h.text.slice(0, 60)}"`),
  ].join(" · ");
  const toolParts: ToolCallPart[] = aidBits.length
    ? [
        {
          kind: "tool",
          id: nextId(),
          tool: "attach_study_aids",
          label: "Attached study aids",
          args: aidBits.join(" · "),
          result: aidDetails,
          status: "done",
        },
      ]
    : [];
  return [
    ...toolParts,
    ...aids.widgets
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
    ...aids.visualizations.map(
      (v) =>
        ({
          kind: "embed",
          id: nextId(),
          embed: "html",
          html: v.html,
          title: v.title,
        }) as EmbedPart,
    ),
  ];
}

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
  studySessionId,
  activity,
  page,
  initialPrompt,
  draft,
  ask,
  sheet = false,
  variant = "panel",
}: {
  open: boolean;
  /** "page": full-width centred chat (workspace Copilot route) instead of the docked side panel. */
  variant?: "panel" | "page";
  /** Sent once as the first message when the panel is ready (Learn one-offs like "Quiz me on …"). */
  initialPrompt?: string;
  /**
   * Text put in the input (not sent) when `id` changes, e.g. a one-tap
   * "Ask Copilot about what you got wrong" on the end-of-session screen.
   */
  draft?: { text: string; id: number };
  /**
   * A Hint / Why? tap on the question card: sent once per `id`, as `intent`
   * with no typed text; `label` is what the chat shows for it, `pinned` the
   * question it is about (shown at the top of the panel).
   */
  ask?: { intent: "hint" | "why"; id: number; label: string; pinned?: string; prepare?: () => Promise<void> };
  /** Phones: a half-sheet over the bottom of the screen, so the question stays in view. */
  sheet?: boolean;
  onClose: () => void;
  context?: string;
  workspaceId: string;
  studySessionId?: string;
  /** Activity on screen right now, so "question 2" means what the learner sees. */
  activity?: { activityId: string; itemIndex?: number };
  /** Where the learner is in the app (page + position), for the model. */
  page?: string;
}) {
  const { t } = useI18n();
  const newUi = useNewUi();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chats, setChats] = useState<ChatTab[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chatsLoading, setChatsLoading] = useState(true);
  const loadedChats = useRef(new Set<string>());
  const queryClient = useQueryClient();

  useEffect(() => {
    setChatsLoading(true);
    listConversations(workspaceId, studySessionId)
      .then((rows) => {
        setChats(rows);
        setActiveChat(rows[0]?.id ?? null);
      })
      .catch(() => {})
      .finally(() => setChatsLoading(false));
  }, [workspaceId, studySessionId]);

  // Hydrate persisted history the first time a conversation becomes active.
  useEffect(() => {
    if (!activeChat || loadedChats.current.has(activeChat)) return;
    loadedChats.current.add(activeChat);
    setHydrating(true);
    getConversationMessages(workspaceId, activeChat)
      .then((history) => {
        const hydrated: ChatMessage[] = history.map((m) => ({
          id: `hist-${m.id}`,
          chatId: activeChat,
          role: m.role,
          parts: [
            ...(m.role === "assistant" ? buildToolParts(m.toolCalls) : []),
            {
              kind: "text",
              id: `hist-part-${m.id}`,
              text: m.content,
              done: true,
            },
            ...(m.role === "assistant" ? buildAidParts(m) : []),
          ],
        }));
        if (!hydrated.length) return;
        // Prepend history; any messages sent while hydrating are newer and stay.
        setMessages((prev) => [...hydrated, ...prev]);
      })
      .catch(() => {
        loadedChats.current.delete(activeChat);
      })
      .finally(() => setHydrating(false));
  }, [activeChat, workspaceId]);
  const [hydrating, setHydrating] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const draftId = useRef<number | null>(null);
  useEffect(() => {
    if (!draft || !open || draftId.current === draft.id) return;
    draftId.current = draft.id;
    setInput(draft.text);
    // After the panel has rendered open; caret at the end so Enter sends.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, [draft, open]);
  const [busy, setBusy] = useState(false);
  // The answer being streamed; aborting it lets the learner interrupt.
  const inFlight = useRef<AbortController | null>(null);
  const stop = useCallback(() => inFlight.current?.abort(), []);
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
    async (text: string, intent?: "hint" | "why") => {
      if (!text.trim()) return;
      // Sending while an answer is still coming in interrupts it.
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
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
      let streamedRef: () => string = () => "";
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, chatId: pendingChatId, role: "assistant", parts: [] },
      ]);
      try {
        let conversationId = activeChat;
        if (!conversationId) {
          const conv = await createConversation(
            workspaceId,
            undefined,
            studySessionId,
          );
          conversationId = conv.id;
          setChats((prev) => [...prev, conv]);
          setMessages((prev) =>
            prev.map((m) =>
              m.chatId === pendingChatId ? { ...m, chatId: conv.id } : m,
            ),
          );
          setActiveChat(conv.id);
        }
        const streamPartId = nextId();
        let streamed = "";
        streamedRef = () => streamed;
        let toolStatus = "";
        const paintStream = () => {
          const textSoFar = streamed;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    parts: [
                      {
                        kind: "text",
                        id: streamPartId,
                        text: textSoFar,
                        done: false,
                        status: toolStatus || undefined,
                      },
                    ],
                  }
                : m,
            ),
          );
        };
        const result = await askCopilotStream(
          {
            workspaceId,
            conversationId,
            // A Hint / Why? tap sends its intent; the server words the question.
            message: intent ? undefined : text,
            intent,
            documentContent: context,
            availableWidgets,
            activity,
            page,
          },
          (delta) => {
            streamed += delta;
            toolStatus = "";
            paintStream();
          },
          (label) => {
            toolStatus = label;
            paintStream();
          },
          controller.signal,
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  parts: [
                    ...buildToolParts(result.toolCalls),
                    {
                      kind: "text",
                      id: streamPartId,
                      text: result.answer,
                      done: true,
                    },
                    ...buildAidParts(result),
                  ],
                }
              : m,
          ),
        );
        if (result.sessionModified && studySessionId) {
          queryClient.invalidateQueries({
            queryKey: ["study-session", studySessionId],
          });
        }
      } catch (err) {
        if (controller.signal.aborted) {
          // Keep what was said so far, marked as cut off.
          const partial = streamedRef().trim();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    parts: [
                      {
                        kind: "text",
                        id: nextId(),
                        text: partial ? `${partial} …` : `*${t("misc.copilotStopped")}*`,
                        done: true,
                      },
                    ],
                  }
                : m,
            ),
          );
          if (inFlight.current === controller) {
            inFlight.current = null;
            setBusy(false);
          }
          return;
        }
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
                          : t("misc.somethingWentWrong"),
                      done: true,
                    },
                  ],
                }
              : m,
          ),
        );
      }
      if (inFlight.current === controller) {
        inFlight.current = null;
        setBusy(false);
      }
    },
    [
      activeChat,
      workspaceId,
      context,
      studySessionId,
      activity,
      page,
      queryClient,
      t,
    ],
  );

  const autoSent = useRef(false);
  useEffect(() => {
    if (!initialPrompt || autoSent.current || chatsLoading || hydrating || busy) return;
    autoSent.current = true;
    void send(initialPrompt);
  }, [initialPrompt, chatsLoading, hydrating, busy, send]);

  // A Hint / Why? tap: once per id, after any history has loaded.
  const askedId = useRef<number | null>(null);
  useEffect(() => {
    if (!ask || !open || askedId.current === ask.id || chatsLoading || hydrating) return;
    askedId.current = ask.id;
    const prepared = ask.prepare ? ask.prepare().catch(() => {}) : Promise.resolve();
    void prepared.then(() => send(ask.label, ask.intent));
  }, [ask, open, chatsLoading, hydrating, send]);

  const chatMessages = messages.filter(
    (m) => (m.chatId ?? "pending") === (activeChat ?? "pending"),
  );

  const newChat = async () => {
    try {
      const conv = await createConversation(
        workspaceId,
        undefined,
        studySessionId,
      );
      setChats((prev) => [...prev, conv]);
      setActiveChat(conv.id);
    } catch (err) {
      // keep current chat; the next send retries conversation creation
      toastError(err, t("misc.couldntStartChat"));
    }
  };

  if (!open) return null;

  return (
    <div
      className={cn(
        "flex flex-col bg-card border-border min-h-0",
        variant === "page"
          ? "relative mx-auto h-full w-full max-w-3xl flex-1"
          : sheet
            ? // Phones: the bottom half only, so the question above stays readable.
              "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-50 max-sm:h-[52dvh] max-sm:w-full max-sm:rounded-t-[22px] max-sm:border-t max-sm:shadow-[0_-18px_40px_-20px_rgba(0,0,0,0.35)] sm:relative sm:self-stretch sm:shrink-0 sm:border-l sm:w-[var(--copilot-width)] sm:min-w-[380px]"
            : "max-sm:fixed max-sm:inset-0 max-sm:z-50 max-sm:w-full sm:relative sm:self-stretch sm:shrink-0 sm:border-l sm:w-[var(--copilot-width)] sm:min-w-[380px]",
      )}
      data-copilot={sheet ? "sheet" : "panel"}
      style={variant === "page" ? undefined : ({ "--copilot-width": width ? `${width}px` : newUi ? "380px" : "40vw" } as React.CSSProperties)}
    >
      {/* Resize handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t("misc.resizeCopilot")}
        onMouseDown={() => {
          resizing.current = true;
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
        }}
        className={cn("absolute left-0 inset-y-0 w-1.5 -translate-x-1/2 cursor-col-resize z-10 hover:bg-accent/40 active:bg-accent/60 transition-colors max-sm:hidden", variant === "page" && "hidden")}
      />
      {/* Header */}
      <div className={cn("flex items-center gap-2 px-3 h-12 border-b border-border shrink-0", variant === "page" && "hidden")}>
        <p className="text-sm font-semibold shrink-0">{t("misc.copilot")}</p>
        <div className={cn("flex items-center gap-1 ml-1 flex-1 min-w-0 overflow-x-auto", newUi && "hidden")}>
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
            aria-label={t("misc.newChat")}
            onClick={() => void newChat()}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn("p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted shrink-0", variant === "page" && "hidden")}
        >
          {newUi ? <PanelRightClose className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </button>
      </div>

      {ask?.pinned && <PinnedQuestion text={ask.pinned} />}

      {/* Messages */}
      <div ref={scrollRef} className={cn("flex-1 overflow-y-auto px-4 py-4 space-y-4", variant === "page" && "px-0 py-6")}>
        {chatMessages.length === 0 && hydrating && (
          <div className="flex flex-col gap-3 px-1 pt-2" aria-busy="true">
            <div className="h-10 w-3/5 animate-pulse rounded-2xl bg-muted" />
            <div className="ml-auto h-9 w-1/2 animate-pulse rounded-2xl bg-muted" />
            <div className="h-14 w-4/5 animate-pulse rounded-2xl bg-muted" />
          </div>
        )}
        {chatMessages.length === 0 && !hydrating && (
          <div className="pt-8 text-center space-y-5">
            {newUi ? (
              <Mascot pose="pencil" className="cat-float pointer-events-none mx-auto block h-24" />
            ) : (
              <Image
                src="/illustrations/bot.png"
                alt=""
                width={160}
                height={160}
                className="pointer-events-none mx-auto h-20 w-20 select-none object-contain"
              />
            )}
            <div>
              <p className="text-sm font-semibold">
                {newUi ? "Stuck? Ask me anything." : t("misc.copilotEmptyTitle")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {newUi
                  ? "I can see what you’re working on and your notes. One chat for the whole session."
                  : `${context ? `${context} — ` : ""}${t("misc.copilotEmptyBlurb")}`}
              </p>
            </div>
            <div className="space-y-2">
              {(studySessionId ? suggestions : WORKSPACE_SUGGESTIONS).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="block w-full text-left text-xs px-4 py-2.5 rounded-full bg-muted text-muted-foreground hover:text-foreground hover:bg-border"
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
            <div key={msg.id} className={cn("space-y-0.5", newUi && "flex gap-2")}>
              {newUi && <Mascot pose="think" className="mt-1.5 h-[26px]" />}
              <div className="min-w-0 flex-1 space-y-0.5">
              {msg.parts.length === 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
                  {t("misc.thinking")}
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
                  ) : part.embed === "html" ? (
                    <HtmlWidget
                      key={part.id}
                      html={part.html}
                      title={part.title}
                      surface="copilot_visualization"
                    />
                  ) : (
                    <CitationEmbed key={part.id} data={part.citation} />
                  )
                ) : (
                  <div key={part.id} className="text-sm leading-relaxed px-1 py-1">
                    {part.text && (
                      // While streaming, the caret sits at the end of the last line (chat-caret, globals.css).
                      <MarkdownText text={part.text} className={cn("block space-y-2.5", !part.done && !part.status && "chat-caret")} />
                    )}
                    {!part.done && part.status && (
                      <p className={cn("flex items-center gap-2 text-[13px] font-semibold text-muted-foreground", part.text && "mt-2")} role="status">
                        <span className="size-1.5 shrink-0 rounded-full bg-accent animate-pulse-dot" aria-hidden />
                        <span className="animate-shimmer">{part.status}…</span>
                      </p>
                    )}
                    {!part.done && !part.text && !part.status && (
                      <span className="inline-block h-3.5 w-1.5 animate-pulse-dot rounded-[1px] bg-accent align-middle" aria-hidden />
                    )}
                  </div>
                ),
              )}
              </div>
            </div>
          ),
        )}
      </div>

      {/* Input */}
      <div className={cn("p-3", variant === "page" && "px-0 pb-6 pt-2")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className={cn(inputBoxClass, "items-end gap-2 py-2")}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            // Grows a little for a pre-filled prompt so it can be read before sending.
            rows={Math.min(4, Math.max(1, Math.ceil(input.length / 52)))}
            placeholder={t("misc.copilotPlaceholder")}
            className={cn(bareInputClass, "resize-none py-1")}
          />
          {busy && !input.trim() ? (
            <button
              type="button"
              onClick={stop}
              aria-label={t("misc.copilotStop")}
              title={t("misc.copilotStop")}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background shrink-0"
            >
              <Square className="h-3 w-3" fill="currentColor" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label={busy ? t("misc.copilotInterrupt") : undefined}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground disabled:opacity-30 shrink-0"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

/**
 * Opens Copilot. New UI: an edge tab on tablets and up; on phones the tab
 * would cover the right edge of the content, so it is hidden there and the
 * player's top bar shows the `compact` button instead.
 */
export function CopilotTrigger({
  onClick,
  compact = false,
  bubble,
}: {
  onClick: () => void;
  compact?: boolean;
  /** New UI edge tab only: the "Stuck? Tap me" bubble, when the page wants it shown. */
  bubble?: { onDismiss: () => void; avoid: RefObject<HTMLElement | null> };
}) {
  const tabRef = useRef<HTMLButtonElement>(null);
  const { t } = useI18n();
  const newUi = useNewUi();
  if (compact) {
    if (!newUi) return null;
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={t("misc.askScribe")}
        title={t("misc.askScribe")}
        className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-accent-soft hover:bg-muted sm:hidden"
      >
        <Mascot pose="wave" className="mt-1.5 h-8" />
      </button>
    );
  }
  if (newUi) {
    return (
      <>
      {bubble && <CopilotBubble tabRef={tabRef} avoid={bubble.avoid} onOpen={onClick} onDismiss={bubble.onDismiss} />}
      <button
        ref={tabRef}
        type="button"
        onClick={onClick}
        aria-label={t("misc.askScribe")}
        // Sits against the docked calculator when there is one, not under it.
        className="fixed right-[var(--calc-dock,0px)] top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-l-2xl border border-r-0 border-border bg-card px-2 py-3 shadow-md hover:bg-muted max-sm:hidden"
      >
        <Mascot pose="wave" className="cat-wiggle h-9" />
        <PanelRightOpen className="h-4 w-4 text-muted-foreground" />
      </button>
      </>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 h-11 pl-4 pr-5 rounded-full bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent-dim active:scale-95 transition-all"
    >
      <Sparkles className="h-4 w-4" />
      {t("misc.askScribe")}
    </button>
  );
}

/** Where the cat's face sits on the edge tab: border + py-3 + half the h-9 cat. */
const TAB_CAT_CENTER = 1 + 12 + 18;

/**
 * A speech bubble from the cat on the edge tab: tapping it opens Copilot, the ×
 * dismisses it. It only renders when it fits in the gutter between the content
 * column and the tab (wrapping to two lines in a narrow one); otherwise it stays
 * away rather than cover the question.
 */
function CopilotBubble({
  tabRef,
  avoid,
  onOpen,
  onDismiss,
}: {
  tabRef: RefObject<HTMLButtonElement | null>;
  avoid: RefObject<HTMLElement | null>;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const { t } = useI18n();
  const [pos, setPos] = useState<{ right: number; top: number; maxWidth: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const tab = tabRef.current?.getBoundingClientRect();
      const column = avoid.current?.getBoundingClientRect();
      // The tab is display:none on phones: no tab, no bubble.
      if (!tab || !tab.width || !column) return setPos(null);
      const room = bubbleRoom(column.right, tab.left);
      if (room === null) return setPos(null);
      setPos({ right: window.innerWidth - tab.left + BUBBLE_GAP, top: tab.top + TAB_CAT_CENTER, maxWidth: room });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [tabRef, avoid]);

  if (!pos) return null;
  return (
    <div
      data-copilot-bubble
      style={{ right: pos.right, top: pos.top, maxWidth: pos.maxWidth }}
      className="animate-bubble-in fixed z-40 flex -translate-y-1/2 items-center rounded-2xl border border-border bg-card shadow-[0_14px_34px_-18px_rgba(0,0,0,0.35)] max-sm:hidden"
    >
      <button
        type="button"
        onClick={onOpen}
        className="rounded-l-2xl py-2.5 pl-4 pr-1 text-left text-[14px] font-bold leading-tight text-foreground hover:text-foreground/80"
      >
        {t("misc.copilotBubble")}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("misc.copilotBubbleDismiss")}
        className="mr-1 grid size-8 shrink-0 place-items-center rounded-full text-faint hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
      {/* The tail, toward the cat. */}
      <span
        aria-hidden
        className="absolute -right-[6px] top-1/2 size-3 -translate-y-1/2 rotate-45 border-r border-t border-border bg-card"
      />
    </div>
  );
}

/**
 * The question a Hint / Why? is about, pinned above the chat. The clamp is on
 * the inner text (padding on an element with line-clamp shows a sliver of
 * the next line); tapping it shows the whole question.
 */
function PinnedQuestion({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  // "Question 3 · A parcel classifier…": the label in bold, the question after it.
  const m = text.match(/^(Question\s+\S+)\s*[·:]\s*([\s\S]*)$/);
  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-expanded={open}
      className="shrink-0 border-b border-border bg-muted/40 px-4 py-2.5 text-left transition-colors hover:bg-muted/70"
      data-pinned
    >
      <span className={cn("block text-[12.5px] leading-[1.45] text-muted-foreground", !open && "line-clamp-2")}>
        {m ? (
          <>
            <span className="font-bold text-foreground">{m[1]}</span>
            <span className="mx-1.5" aria-hidden>·</span>
            {m[2]}
          </>
        ) : (
          text
        )}
      </span>
    </button>
  );
}
