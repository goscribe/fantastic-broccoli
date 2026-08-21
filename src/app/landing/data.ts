export const subjects = [
  {
    name: "Chemistry",
    icon: "/illustrations/icons/ws-purple.png",
    tint: "bg-accent-soft",
  },
  {
    name: "Biology",
    icon: "/illustrations/icons/ws-emerald.png",
    tint: "bg-emerald-500/15",
  },
  {
    name: "Physics",
    icon: "/illustrations/icons/ws-sky.png",
    tint: "bg-sky/20",
  },
  {
    name: "Math",
    icon: "/illustrations/icons/ws-amber.png",
    tint: "bg-amber/20",
  },
  {
    name: "English",
    icon: "/illustrations/icons/ws-pink.png",
    tint: "bg-rose/20",
  },
  {
    name: "History",
    icon: "/illustrations/props/book-blue.png",
    tint: "bg-sky/15",
  },
];

export type SceneMock = "session" | "quiz" | "copilot" | "upload" | "flashcards";
export type ArtTint = "accent" | "sky" | "rose" | "amber";
export type ArtSide = "right" | "left" | "bottom";

export interface Feature {
  icon: string;
  title: string;
  description: string;
  tint: ArtTint;
}

export const features: Feature[] = [
  {
    icon: "/illustrations/icons/act-reading.png",
    title: "Readings with figures",
    description:
      "Focused readings generated from your materials, with the original figures and diagrams pulled straight from your PDFs.",
    tint: "accent",
  },
  {
    icon: "/illustrations/icons/act-worksheet.png",
    title: "Worksheets with AI grading",
    description:
      "Exam-style questions marked against an AI markscheme — with per-part feedback, not just right or wrong.",
    tint: "sky",
  },
  {
    icon: "/illustrations/icons/act-flashcards.png",
    title: "Flashcards",
    description:
      "Auto-generated decks that target the definitions, formulas, and concepts you actually need to memorise.",
    tint: "amber",
  },
  {
    icon: "/illustrations/icons/act-cloze.png",
    title: "Cloze passages",
    description:
      "Fill-in-the-blank passages built from your notes that force real recall instead of passive recognition.",
    tint: "rose",
  },
  {
    icon: "/illustrations/icons/act-comprehension.png",
    title: "Comprehension checks",
    description:
      "Quick checkpoints after each reading to confirm you understood it — before you move on.",
    tint: "sky",
  },
  {
    icon: "/illustrations/icons/act-explain.png",
    title: "AI copilot",
    description:
      "A study partner that knows your course. Ask questions, get explanations, and dig deeper without leaving your session.",
    tint: "accent",
  },
];

export interface FeatureScene {
  title: string;
  body: string;
  bullets: string[];
  mock: SceneMock;
  reverse?: boolean;
  url?: string;
  art?: string;
  artTint?: ArtTint;
  artSide?: ArtSide;
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
    art: "/illustrations/marketing/mkt-quiz.png",
    artTint: "amber",
    artSide: "left",
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
    art: "/illustrations/bot.png",
    artTint: "accent",
    artSide: "right",
  },
];

export const howItWorks = [
  {
    num: "1",
    title: "Upload your materials",
    description:
      "Drop in PDFs, lecture slides, or audio. Scribe parses the text, figures, and diagrams — the stuff your exam will actually use.",
    art: "/illustrations/marketing/mkt-upload.png",
    tint: "sky" as const,
    side: "bottom" as const,
  },
  {
    num: "2",
    title: "Scribe builds the session",
    description:
      "Your materials become a path: readings, checks, worksheets, flashcards. One plan, not five tabs.",
    art: "/illustrations/marketing/mkt-reading.png",
    tint: "accent" as const,
    side: "right" as const,
  },
  {
    num: "3",
    title: "Study, then ask",
    description:
      "Work through the waypoints. When you get stuck, the copilot answers from your own pages and can add extra practice.",
    art: "/illustrations/marketing/mkt-mcq.png",
    tint: "rose" as const,
    side: "left" as const,
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

export const sessionPreview: {
  art: string;
  label: string;
  meta: string;
}[] = [
  {
    art: "/illustrations/icons/act-reading.png",
    label: "Reading: Enzyme kinetics",
    meta: "12 min",
  },
  {
    art: "/illustrations/icons/act-comprehension.png",
    label: "Comprehension check",
    meta: "4 questions",
  },
  {
    art: "/illustrations/icons/act-worksheet.png",
    label: "Worksheet: Rate equations",
    meta: "6 parts",
  },
  {
    art: "/illustrations/icons/act-flashcards.png",
    label: "Flashcards: Key definitions",
    meta: "18 cards",
  },
  {
    art: "/illustrations/icons/act-cloze.png",
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
