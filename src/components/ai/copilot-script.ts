import { GraphData, CitationData } from "@/components/ai/embeds";
import { WidgetId } from "@/components/interactive";

export type ToolName =
  | "search_materials"
  | "update_plan"
  | "add_activity"
  | "generate_summary";

export interface ToolCallPart {
  kind: "tool";
  id: string;
  tool: ToolName;
  label: string;
  args: string;
  result: string;
  status: "running" | "done";
}

export interface TextPart {
  kind: "text";
  id: string;
  text: string;
  done: boolean;
}

export type EmbedSpec =
  | { embed: "equation"; latex: string; caption?: string }
  | { embed: "graph"; graph: GraphData }
  | { embed: "widget"; widget: WidgetId; intro?: string; outro?: string }
  | { embed: "citation"; citation: CitationData };

export type EmbedPart = { kind: "embed"; id: string } & EmbedSpec;

export type MessagePart = ToolCallPart | TextPart | EmbedPart;

export interface ChatMessage {
  id: string;
  chatId?: string;
  role: "user" | "assistant";
  parts: MessagePart[];
}

export interface ScriptStep {
  type: "text" | "tool" | "embed";
  text?: string;
  tool?: ToolName;
  label?: string;
  args?: string;
  result?: string;
  spec?: EmbedSpec;
}

export const suggestions = [
  "Plot the ionization energy trend",
  "Show me the energy level equation",
  "Let me play with a density simulation",
  "Simulate the ideal gas law",
  "Show a pendulum I can control",
  "Where do my notes cover shielding?",
];

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

export function scriptFor(input: string): ScriptStep[] {
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
