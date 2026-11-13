export const subjects = [
  {
    name: "Chemistry",
    icon: "/design/props/books.png",
    tint: "bg-accent-soft",
  },
  {
    name: "Biology",
    icon: "/design/props/notes.png",
    tint: "bg-emerald-500/15",
  },
  {
    name: "Physics",
    icon: "/design/props/bulb.png",
    tint: "bg-sky/20",
  },
  {
    name: "Math",
    icon: "/design/props/pencil.png",
    tint: "bg-amber/20",
  },
  {
    name: "English",
    icon: "/design/props/cards.png",
    tint: "bg-rose/20",
  },
  {
    name: "History",
    icon: "/design/props/flag.png",
    tint: "bg-sky/15",
  },
];

export type SceneMock =
  "session" | "quiz" | "copilot" | "upload" | "flashcards";
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
    icon: "/design/props/books.png",
    title: "Readings with figures",
    description:
      "Focused readings generated from your materials, with the original figures and diagrams pulled straight from your PDFs.",
    tint: "accent",
  },
  {
    icon: "/design/props/pencil.png",
    title: "Worksheets with AI grading",
    description:
      "Exam-style questions marked against an AI markscheme — with per-part feedback, not just right or wrong.",
    tint: "sky",
  },
  {
    icon: "/design/props/cards.png",
    title: "Flashcards",
    description:
      "Auto-generated decks that target the definitions, formulas, and concepts you actually need to memorise.",
    tint: "amber",
  },
  {
    icon: "/design/props/notes.png",
    title: "Cloze passages",
    description:
      "Fill-in-the-blank passages built from your notes that force real recall instead of passive recognition.",
    tint: "rose",
  },
  {
    icon: "/design/props/bulb.png",
    title: "Comprehension checks",
    description:
      "Quick checkpoints after each reading to confirm you understood it — before you move on.",
    tint: "sky",
  },
  {
    icon: "/design/cat2-think.png",
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
    art: "/design/props/star.png",
    artTint: "amber",
    artSide: "left",
  },
  {
    title: "A copilot that already read the PDF",
    body: "Ask mid-session. Answers come from your materials with a citation back to the exact page — and it can extend the plan with extra practice when a topic feels shaky.",
    bullets: [
      "Grounded in that subject’s materials, not the open web",
      "Explains worksheet feedback step by step",
      "Sits beside the question when you open it",
    ],
    mock: "copilot",
    url: "scribe.study/session",
    art: "/design/cat2-book.png",
    artTint: "accent",
    artSide: "right",
  },
];

export const howItWorks = [
  {
    num: "1",
    title: "Make a subject, drop in your notes",
    description:
      "One subject per course — PDFs, slides, photos of notes, lecture audio. Scribe reads the text, figures and diagrams, so everything it builds comes from your own material.",
    art: "/design/props/notes.png",
    tint: "sky" as const,
    side: "bottom" as const,
  },
  {
    num: "2",
    title: "Scribe builds the study session",
    description:
      "Tell it what to cover (or just tick a few files) and it builds a 25-minute session: a reading, a check, a worksheet, flashcards. Sessions stack up inside the subject, in order.",
    art: "/design/props/books.png",
    tint: "accent" as const,
    side: "right" as const,
  },
  {
    num: "3",
    title: "Study a bit every day",
    description:
      "Connect your calendar and the planner slots study times around school and sport, with a streak that counts when you hit your daily goal. Stuck? The copilot answers from your own pages.",
    art: "/design/props/bulb.png",
    tint: "rose" as const,
    side: "left" as const,
  },
];

export const plans = [
  {
    name: "Free",
    price: "$0",
    description:
      "A taste of Scribe: one subject, one full session, and a free Quick 5 every day.",
    features: [
      "1 subject · 1 full study session · 1 test · a free Quick 5 every day",
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
      "Unlimited subjects, study sessions and tests",
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
  art: string;
  label: string;
  meta: string;
}[] = [
  {
    art: "/design/props/books.png",
    label: "Reading: Enzyme kinetics",
    meta: "12 min",
  },
  {
    art: "/design/props/bulb.png",
    label: "Comprehension check",
    meta: "4 questions",
  },
  {
    art: "/design/props/pencil.png",
    label: "Worksheet: Rate equations",
    meta: "6 parts",
  },
  {
    art: "/design/props/cards.png",
    label: "Flashcards: Key definitions",
    meta: "18 cards",
  },
  {
    art: "/design/props/notes.png",
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
