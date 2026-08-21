import {
  BookOpen,
  ClipboardCheck,
  Layers,
  ListChecks,
  MessageSquare,
  TextCursorInput,
  type LucideIcon,
} from "lucide-react";

export const subjects = [
  { icon: "chemistry", label: "Chemistry" },
  { icon: "biology", label: "Biology" },
  { icon: "physics", label: "Physics" },
  { icon: "math", label: "Math" },
  { icon: "english", label: "English" },
];

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const features: Feature[] = [
  {
    icon: BookOpen,
    title: "Readings with figures",
    description:
      "Focused readings generated from your materials, with the original figures and diagrams pulled straight from your PDFs.",
  },
  {
    icon: ClipboardCheck,
    title: "Worksheets with AI grading",
    description:
      "Exam-style questions marked against an AI markscheme — with per-part feedback, not just right or wrong.",
  },
  {
    icon: Layers,
    title: "Flashcards",
    description:
      "Auto-generated decks that target the definitions, formulas, and concepts you actually need to memorise.",
  },
  {
    icon: TextCursorInput,
    title: "Cloze passages",
    description:
      "Fill-in-the-blank passages built from your notes that force real recall instead of passive recognition.",
  },
  {
    icon: ListChecks,
    title: "Comprehension checks",
    description:
      "Quick checkpoints after each reading to confirm you understood it — before you move on.",
  },
  {
    icon: MessageSquare,
    title: "AI copilot",
    description:
      "A study partner that knows your course. Ask questions, get explanations, and dig deeper without leaving your session.",
  },
];

export const plans = [
  {
    name: "Free",
    price: "$0",
    description: "Everything you need to try Scribe with a real course.",
    features: [
      "Upload PDFs, slides, and lecture audio",
      "AI study sessions with readings & worksheets",
      "300 tokens per month",
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
      "Everything in Free",
      "5,000 tokens per month",
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
      "10 GB storage",
      "Higher generation limits",
    ],
    cta: "Go Pro",
    highlighted: false,
  },
];

export const sessionPreview = [
  { icon: BookOpen, label: "Reading: Enzyme kinetics", meta: "12 min" },
  { icon: ListChecks, label: "Comprehension check", meta: "4 questions" },
  { icon: ClipboardCheck, label: "Worksheet: Rate equations", meta: "AI-marked" },
  { icon: Layers, label: "Flashcards: Key definitions", meta: "18 cards" },
  { icon: TextCursorInput, label: "Cloze: Michaelis–Menten", meta: "1 passage" },
];
