"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  X,
  ArrowUp,
  Search,
  CalendarClock,
  ListPlus,
  Check,
  Loader2,
  ChevronDown,
  FileText,
  Wand2,
} from "lucide-react";

type ToolName =
  | "search_materials"
  | "update_plan"
  | "add_activity"
  | "generate_summary";

interface ToolCallPart {
  kind: "tool";
  id: string;
  tool: ToolName;
  label: string;
  args: string;
  result: string;
  status: "running" | "done";
}

interface TextPart {
  kind: "text";
  id: string;
  text: string;
  done: boolean;
}

type MessagePart = ToolCallPart | TextPart;

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
}

const toolMeta: Record<ToolName, { icon: React.ElementType; color: string }> = {
  search_materials: { icon: Search, color: "text-sky" },
  update_plan: { icon: CalendarClock, color: "text-violet" },
  add_activity: { icon: ListPlus, color: "text-accent" },
  generate_summary: { icon: FileText, color: "text-amber" },
};

interface ScriptStep {
  type: "text" | "tool";
  text?: string;
  tool?: ToolName;
  label?: string;
  args?: string;
  result?: string;
}

function scriptFor(input: string): ScriptStep[] {
  const q = input.toLowerCase();
  if (q.includes("search") || q.includes("find")) {
    return [
      { type: "text", text: "Let me look through your materials." },
      {
        type: "tool",
        tool: "search_materials",
        label: "Searching materials",
        args: `query: "${input.slice(0, 60)}"`,
        result:
          "Found 3 matches — 'Atomic Structure Overview' (reading), 'Periodic Trends Quiz' (MCQ), and 2 flashcards on ionization energy.",
      },
      {
        type: "text",
        text: "I found 3 relevant items. The reading on atomic structure covers this directly — want me to add it to today's session?",
      },
    ];
  }
  if (q.includes("add") || q.includes("more") || q.includes("practice")) {
    return [
      { type: "text", text: "Good call — adding extra practice on your weakest topic." },
      {
        type: "tool",
        tool: "search_materials",
        label: "Checking weak topics",
        args: "source: comprehension scores, last 7 days",
        result: "Weakest topic: Hund's rule & orbital filling (avg score 64/100).",
      },
      {
        type: "tool",
        tool: "add_activity",
        label: "Adding activity",
        args: "type: MCQ drill · topic: orbital filling · 6 questions",
        result: "Added 'Orbital Filling Drill' (est. 5 min) after your current activity.",
      },
      {
        type: "text",
        text: "Done — I added a 6-question drill on orbital filling right after your current activity. Your session is now ~50 minutes.",
      },
    ];
  }
  if (
    q.includes("plan") ||
    q.includes("reschedul") ||
    q.includes("move") ||
    q.includes("shorter") ||
    q.includes("time")
  ) {
    return [
      { type: "text", text: "Sure — let me restructure your plan." },
      {
        type: "tool",
        tool: "update_plan",
        label: "Updating plan",
        args: "session: Atomic Structure & Periodicity · constraint: 25 min",
        result:
          "Trimmed to 25 min: kept comprehension check + MCQs, moved flashcards to tomorrow's queue.",
      },
      {
        type: "text",
        text: "Your session now fits in 25 minutes. I kept the comprehension check (you're mid-loop) and the quiz, and pushed flashcards to tomorrow.",
      },
    ];
  }
  if (q.includes("summar") || q.includes("explain") || q.includes("what")) {
    return [
      {
        type: "tool",
        tool: "generate_summary",
        label: "Generating summary",
        args: "scope: current activity · style: concise",
        result: "Summary generated from 'Atomic Structure Overview'.",
      },
      {
        type: "text",
        text: "Quick version: electrons fill lowest-energy orbitals first (Aufbau), max 2 per orbital with opposite spins (Pauli), and they spread across equal-energy orbitals before pairing (Hund). Radius shrinks across a period because nuclear charge grows.",
      },
    ];
  }
  return [
    { type: "text", text: "Let me check your plan and see what makes sense." },
    {
      type: "tool",
      tool: "update_plan",
      label: "Reviewing plan",
      args: "session: current · signal: recent scores + schedule",
      result:
        "Plan is on track — 35% done, exam in 9 days. Suggested: 20 min/day on Topic 2.",
    },
    {
      type: "text",
      text: "You're on track — 35% through with 9 days to the exam. I'd suggest 20 focused minutes a day on Topic 2. Want me to schedule that?",
    },
  ];
}

let idCounter = 0;
const nextId = () => `m-${++idCounter}-${Date.now()}`;

function ToolCallChip({ part }: { part: ToolCallPart }) {
  const [expanded, setExpanded] = useState(false);
  const meta = toolMeta[part.tool];
  const Icon = meta.icon;

  return (
    <div className="my-1.5 rounded-xl border border-border bg-muted/60 overflow-hidden animate-fade-up">
      <button
        type="button"
        onClick={() => part.status === "done" && setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left"
      >
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-lg bg-card border border-border shrink-0",
            meta.color,
          )}
        >
          {part.status === "running" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Icon className="h-3.5 w-3.5" />
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold">
            {part.status === "running" ? (
              <span className="animate-shimmer">{part.label}…</span>
            ) : (
              part.label
            )}
          </span>
          <span className="block text-[11px] text-muted-foreground font-mono truncate">
            {part.args}
          </span>
        </span>
        {part.status === "done" && (
          <>
            <Check className="h-3.5 w-3.5 text-success shrink-0" />
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-faint shrink-0 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </>
        )}
      </button>
      {expanded && part.status === "done" && (
        <div className="px-3 pb-2.5 pt-0.5 text-xs text-muted-foreground border-t border-border/60 mt-0.5">
          <p className="pt-2">{part.result}</p>
        </div>
      )}
    </div>
  );
}

const suggestions = [
  "Make today's session shorter",
  "Add more practice on my weak topics",
  "Search my notes for ionization energy",
];

export function Copilot({
  open,
  onClose,
  context,
}: {
  open: boolean;
  onClose: () => void;
  context?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const runScript = useCallback(async (steps: ScriptStep[], assistantId: string) => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (const step of steps) {
      if (step.type === "tool") {
        const toolId = nextId();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  parts: [
                    ...m.parts,
                    {
                      kind: "tool",
                      id: toolId,
                      tool: step.tool!,
                      label: step.label!,
                      args: step.args!,
                      result: step.result!,
                      status: "running",
                    },
                  ],
                }
              : m,
          ),
        );
        await wait(1100 + Math.random() * 600);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  parts: m.parts.map((p) =>
                    p.id === toolId ? { ...p, status: "done" as const } : p,
                  ),
                }
              : m,
          ),
        );
      } else {
        const textId = nextId();
        const full = step.text!;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  parts: [...m.parts, { kind: "text", id: textId, text: "", done: false }],
                }
              : m,
          ),
        );
        const words = full.split(" ");
        for (let i = 0; i < words.length; i += 3) {
          await wait(60);
          const chunk = words.slice(0, i + 3).join(" ");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    parts: m.parts.map((p) =>
                      p.id === textId ? { ...p, text: chunk } : p,
                    ),
                  }
                : m,
            ),
          );
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  parts: m.parts.map((p) =>
                    p.id === textId ? { ...p, text: full, done: true } : p,
                  ),
                }
              : m,
          ),
        );
      }
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return;
      setInput("");
      setBusy(true);
      const userMsg: ChatMessage = {
        id: nextId(),
        role: "user",
        parts: [{ kind: "text", id: nextId(), text, done: true }],
      };
      const assistantId = nextId();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: "assistant", parts: [] },
      ]);
      await runScript(scriptFor(text), assistantId);
      setBusy(false);
    },
    [busy, runScript],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] flex flex-col bg-card border-l border-border shadow-2xl animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 border border-accent/25">
          <Sparkles className="h-4 w-4 text-accent" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Scribe Copilot</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {context ?? "Can search, edit your plan, and add activities"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="pt-8 text-center space-y-5">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 border border-accent/20">
              <Wand2 className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold">What do you need?</p>
              <p className="text-xs text-muted-foreground mt-1">
                I can reshape your plan, dig through your materials, or quiz you.
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

        {messages.map((msg) =>
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
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 h-11 pl-4 pr-5 rounded-full bg-accent text-accent-foreground font-semibold text-sm shadow-[0_8px_30px_-6px_var(--accent)] hover:bg-accent-dim active:scale-95 transition-all"
    >
      <Sparkles className="h-4 w-4" />
      Ask Scribe
    </button>
  );
}
