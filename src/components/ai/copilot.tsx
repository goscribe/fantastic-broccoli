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
import {
  EquationEmbed,
  GraphEmbed,
  CitationEmbed,
  GraphData,
  CitationData,
} from "@/components/ai/embeds";
import { InteractiveWidget, WidgetId } from "@/components/interactive";

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

type EmbedSpec =
  | { embed: "equation"; latex: string; caption?: string }
  | { embed: "graph"; graph: GraphData }
  | { embed: "widget"; widget: WidgetId; intro?: string; outro?: string }
  | { embed: "citation"; citation: CitationData };

type EmbedPart = { kind: "embed"; id: string } & EmbedSpec;

type MessagePart = ToolCallPart | TextPart | EmbedPart;

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
  type: "text" | "tool" | "embed";
  text?: string;
  tool?: ToolName;
  label?: string;
  args?: string;
  result?: string;
  spec?: EmbedSpec;
}

const widgetTriggers: {
  keywords: string[];
  id: WidgetId;
  intro: string;
  outro: string;
}[] = [
  {
    keywords: ["density"],
    id: "density",
    intro: "Let's make this hands-on — try it yourself:",
    outro: "Same bottle, more particles → more mass in the same volume → higher density. ρ = m/V in action.",
  },
  {
    keywords: ["gas", "pressure", "piston", "pv=nrt"],
    id: "ideal-gas",
    intro: "Here's a piston you can control — squeeze, heat, or add gas:",
    outro: "Halve the volume at constant T and pressure doubles — Boyle's law falls straight out of PV = nRT.",
  },
  {
    keywords: ["ohm", "circuit", "current", "resist", "voltage"],
    id: "ohms-law",
    intro: "Watch the electrons respond as you change the circuit:",
    outro: "Current speeds up with voltage and slows with resistance — I = V/R.",
  },
  {
    keywords: ["projectile", "trajectory", "launch"],
    id: "projectile",
    intro: "Try different launch angles and speeds:",
    outro: "Notice 45° maximizes range — sin 2θ peaks at θ = 45°.",
  },
  {
    keywords: ["pendulum", "oscillat"],
    id: "pendulum",
    intro: "A live pendulum — change its length or move it to the Moon:",
    outro: "Period only depends on L and g — mass doesn't matter at all.",
  },
  {
    keywords: ["wave", "amplitude", "frequency", "wavelength"],
    id: "wave",
    intro: "Shape this travelling wave yourself:",
    outro: "Amplitude sets the height, wavelength the spacing — energy scales with A².",
  },
  {
    keywords: ["decay", "half-life", "half life", "radioactive", "isotope"],
    id: "half-life",
    intro: "Here's a decay curve you can control:",
    outro: "After every half-life, exactly half remains — that's why the curve never quite reaches zero.",
  },
  {
    keywords: ["spring", "hooke", "elastic"],
    id: "hooke",
    intro: "Stretch the spring and watch the restoring force:",
    outro: "Force grows linearly with displacement — until you exceed the elastic limit.",
  },
  {
    keywords: ["function", "sine", "sin(", "parabola", "grapher"],
    id: "function-grapher",
    intro: "Here's a live Desmos grapher — drag a, b, and c:",
    outro: "a scales the amplitude, b compresses the period, c shifts it vertically.",
  },
  {
    keywords: ["unit circle", "trig", "sin and cos", "radian"],
    id: "unit-circle",
    intro: "Sweep the angle around the unit circle:",
    outro: "sin is the vertical leg, cos the horizontal — Pythagoras keeps them locked to 1.",
  },
  {
    keywords: ["normal", "distribution", "bell curve", "standard deviation"],
    id: "normal-distribution",
    intro: "Play with the bell curve:",
    outro: "μ slides the peak, σ trades height for spread — the area always stays 1.",
  },
  {
    keywords: ["vector"],
    id: "vector-addition",
    intro: "Add the vectors tip-to-tail:",
    outro: "The dashed resultant is the diagonal of the parallelogram — order doesn't matter.",
  },
];

function matchWidget(q: string) {
  for (const trigger of widgetTriggers) {
    if (trigger.keywords.some((k) => q.includes(k))) return trigger;
  }
  if (q.includes("interactive") || q.includes("simulat") || q.includes("play")) {
    return widgetTriggers[0];
  }
  return null;
}

function scriptFor(input: string): ScriptStep[] {
  const q = input.toLowerCase();
  if (q.includes("graph") || q.includes("plot") || q.includes("trend")) {
    return [
      { type: "text", text: "Here's the first ionization energy across Period 3 — note the dips at Al and S." },
      {
        type: "embed",
        spec: {
          embed: "graph",
          graph: {
            title: "First ionization energy — Period 3",
            xLabel: "Element",
            yLabel: "IE₁ (kJ/mol)",
            points: [
              { x: 1, y: 496, label: "Na" },
              { x: 2, y: 738, label: "Mg" },
              { x: 3, y: 578, label: "Al" },
              { x: 4, y: 786, label: "Si" },
              { x: 5, y: 1012, label: "P" },
              { x: 6, y: 1000, label: "S" },
              { x: 7, y: 1251, label: "Cl" },
              { x: 8, y: 1521, label: "Ar" },
            ],
          },
        },
      },
      {
        type: "text",
        text: "The Al dip happens because its 3p electron is easier to remove than Mg's 3s, and the S dip comes from paired-electron repulsion in 3p⁴. Want a quiz question on this?",
      },
    ];
  }
  if (q.includes("equation") || q.includes("formula") || q.includes("math")) {
    return [
      { type: "text", text: "The energy of an electron in a hydrogen-like atom is:" },
      {
        type: "embed",
        spec: {
          embed: "equation",
          latex: "E_n = -\\frac{13.6\\,\\text{eV} \\cdot Z^2}{n^2}",
          caption: "Z = nuclear charge, n = principal quantum number",
        },
      },
      {
        type: "text",
        text: "Energy scales with Z² and falls off with n² — that's why removing inner-shell electrons takes dramatically more energy.",
      },
    ];
  }
  const widgetMatch = matchWidget(q);
  if (widgetMatch) {
    return [
      { type: "text", text: widgetMatch.intro },
      { type: "embed", spec: { embed: "widget", widget: widgetMatch.id } },
      { type: "text", text: widgetMatch.outro },
    ];
  }
  if (q.includes("pdf") || q.includes("source") || q.includes("cite") || q.includes("where") || q.includes("notes")) {
    return [
      {
        type: "tool",
        tool: "search_materials",
        label: "Searching your PDFs",
        args: `query: "${input.slice(0, 50)}"`,
        result: "Best match in 'Topic 2 — Atomic Structure.pdf', page 17.",
      },
      { type: "text", text: "Found it — this is straight from your uploaded notes:" },
      {
        type: "embed",
        spec: {
          embed: "citation",
          citation: {
            source: "Topic 2 — Atomic Structure.pdf",
            page: 17,
            quote:
              "The first ionization energy decreases down a group because the outer electron is progressively further from the nucleus and increasingly shielded by inner shells.",
          },
        },
      },
      {
        type: "text",
        text: "Want me to turn this section into flashcards or a comprehension check?",
      },
    ];
  }
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
        <span className={cn("flex items-center justify-center shrink-0", meta.color)}>
          {part.status === "running" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Icon className="h-4 w-4" />
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
  "Plot the ionization energy trend",
  "Show me the energy level equation",
  "Let me play with a density simulation",
  "Simulate the ideal gas law",
  "Show a pendulum I can control",
  "Where do my notes cover shielding?",
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
  const [width, setWidth] = useState(() =>
    typeof window === "undefined"
      ? 0
      : Math.max(420, Math.round(window.innerWidth / 2)),
  );
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

  const runScript = useCallback(async (steps: ScriptStep[], assistantId: string) => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (const step of steps) {
      if (step.type === "embed") {
        await wait(400);
        const embedPart = { kind: "embed", id: nextId(), ...step.spec! } as EmbedPart;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, parts: [...m.parts, embedPart] }
              : m,
          ),
        );
      } else if (step.type === "tool") {
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
    <div
      className="fixed inset-y-0 right-0 z-50 flex flex-col bg-card border-l border-border shadow-2xl"
      style={{ width: width || "50vw" }}
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
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border">
        <Sparkles className="h-5 w-5 text-accent shrink-0" />
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
            <Wand2 className="h-7 w-7 text-accent mx-auto" />
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
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 h-11 pl-4 pr-5 rounded-full bg-accent text-accent-foreground font-semibold text-sm shadow-soft-lg hover:bg-accent-dim active:scale-95 transition-all"
    >
      <Sparkles className="h-4 w-4" />
      Ask Scribe
    </button>
  );
}
