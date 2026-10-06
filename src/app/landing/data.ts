import type { LucideIcon } from "lucide-react";
import {
  Atom,
  BookOpen,
  Calculator,
  Dna,
  FlaskConical,
  Landmark,
  Layers,
  ListChecks,
  MessageSquare,
  PenLine,
  Sparkles,
  TextCursorInput,
  Upload,
} from "lucide-react";
import type { Tone } from "@/components/graphics/icon-tile";
import type { SessionActivity } from "@/types";

export const subjects: { name: string; icon: LucideIcon; tone: Tone }[] = [
  { name: "Chemistry", icon: FlaskConical, tone: "purple" },
  { name: "Biology", icon: Dna, tone: "emerald" },
  { name: "Physics", icon: Atom, tone: "sky" },
  { name: "Math", icon: Calculator, tone: "amber" },
  { name: "English", icon: BookOpen, tone: "pink" },
  { name: "History", icon: Landmark, tone: "sky" },
];

export type SceneMock =
  "session" | "quiz" | "copilot" | "upload" | "flashcards";
export type ArtTint = "accent" | "sky" | "rose" | "amber";

export interface Feature {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  description: string;
}

export const features: Feature[] = [
  {
    icon: BookOpen,
    title: "Readings with figures",
    description:
      "Focused readings generated from your materials, with the original figures and diagrams pulled straight from your PDFs.",
    tone: "purple",
  },
  {
    icon: PenLine,
    title: "Worksheets with AI grading",
    description:
      "Exam-style questions marked against an AI markscheme — with per-part feedback, not just right or wrong.",
    tone: "sky",
  },
  {
    icon: Layers,
    title: "Flashcards",
    description:
      "Auto-generated decks that target the definitions, formulas, and concepts you actually need to memorise.",
    tone: "amber",
  },
  {
    icon: TextCursorInput,
    title: "Cloze passages",
    description:
      "Fill-in-the-blank passages built from your notes that force real recall instead of passive recognition.",
    tone: "pink",
  },
  {
    icon: ListChecks,
    title: "Comprehension checks",
    description:
      "Quick checkpoints after each reading to confirm you understood it — before you move on.",
    tone: "sky",
  },
  {
    icon: MessageSquare,
    title: "AI copilot",
    description:
      "A study partner that knows your course. Ask questions, get explanations, and dig deeper without leaving your session.",
    tone: "purple",
  },
];

export interface FeatureScene {
  title: string;
  body: string;
  bullets: string[];
  mock: SceneMock;
  reverse?: boolean;
  url?: string;
  artTint?: ArtTint;
}

export const homeScenes: FeatureScene[] = [
  {
    title: "Questions that mark you, then explain why",
    body: "Multiple-choice, cloze, and exam-style worksheets come from your notes — with a markscheme that tells you the causal step you missed, not just a green tick.",
    bullets: [
      "Worksheets graded part-by-part against an AI markscheme",
      "Feedback cites the page in your PDF, so you can go back",
      "A confetti pop when you actually get it — then the next question",
    ],
    mock: "quiz",
    reverse: true,
    url: "scribe.study/session",
  },
  {
    title: "A copilot that already read the PDF",
    body: "Ask mid-session. Answers come from your materials with a citation back to the exact page — and it can extend the plan with extra practice when a topic feels shaky.",
    bullets: [
      "Grounded in this workspace, not the open web",
      "Explains worksheet feedback step by step",
      "Sits beside the question when you open it",
    ],
    mock: "copilot",
    url: "scribe.study/session",
  },
];

export const howItWorks = [
  {
    num: "1",
    title: "Upload your materials",
    description:
      "Drop in PDFs, lecture slides, or audio. Scribe parses the text, figures, and diagrams — the stuff your exam will actually use.",
    icon: Upload,
    tint: "sky" as const,
  },
  {
    num: "2",
    title: "Scribe builds the session",
    description:
      "Your materials become a path: readings, checks, worksheets, flashcards. One plan, not five tabs.",
    icon: Sparkles,
    tint: "accent" as const,
  },
  {
    num: "3",
    title: "Study, then ask",
    description:
      "Work through the waypoints. When you get stuck, the copilot answers from your own pages and can add extra practice.",
    icon: MessageSquare,
    tint: "rose" as const,
  },
];

export const plans = [
  {
    name: "Free",
    price: "$0",
    description:
      "A taste of Scribe: one workspace, one full session, and a free Quick 5 every day.",
    features: [
      "1 workspace · 1 full study session · 1 test · a free Quick 5 every day",
      "Upload PDFs, slides, and lecture audio",
      "150 tokens per month",
      "2 GB storage",
    ],
    cta: "Start studying",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$9/mo",
    description: "Great for getting started with focused study sessions.",
    features: [
      "Unlimited workspaces, study sessions and tests",
      "5,000 tokens per month",
      "Smarter AI model routing — strongest model on every activity",
      "2 GB storage",
      "Study copilot grounded in your materials",
    ],
    cta: "Get Starter",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "$19/mo",
    description: "Best for power users with higher content generation limits.",
    features: [
      "Everything in Starter",
      "10,000 tokens per month",
      "Smarter AI model routing — strongest model on every activity",
      "10 GB storage",
      "Higher generation limits",
    ],
    cta: "Go Pro",
    highlighted: false,
  },
];

export const sessionPreview: {
  type: SessionActivity["type"];
  label: string;
  meta: string;
}[] = [
  {
    type: "reading",
    label: "Reading: Enzyme kinetics",
    meta: "12 min",
  },
  {
    type: "comprehension_check",
    label: "Comprehension check",
    meta: "4 questions",
  },
  {
    type: "worksheet",
    label: "Worksheet: Rate equations",
    meta: "6 parts",
  },
  {
    type: "flashcard_review",
    label: "Flashcards: Key definitions",
    meta: "18 cards",
  },
  {
    type: "cloze",
    label: "Cloze: Michaelis–Menten",
    meta: "1 passage",
  },
];

export const testimonials = [
  {
    quote:
      "I used to highlight everything and still not know what mattered. I dumped in the lecture slides and it pulled the exact concepts I needed to review.",
    name: "Maya",
    role: "First-year biochem",
  },
  {
    quote:
      "The worksheet feedback named the causal step I skipped — not just “wrong.” That’s the bit my professor actually marks.",
    name: "Jonah",
    role: "A-level chemistry",
  },
  {
    quote:
      "Flashcards that used my notes, including the diagrams from the slides. Finally didn’t feel like a generic quizlet deck.",
    name: "Priya",
    role: "Pre-med",
  },
  {
    quote:
      "Sixty-page reading used to freeze me. The session chopped it into a guide plus a check, and I actually finished it.",
    name: "Leo",
    role: "Undergrad history",
  },
];
