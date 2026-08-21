export const subjects = [
  { icon: "chemistry", label: "Chemistry" },
  { icon: "biology", label: "Biology" },
  { icon: "physics", label: "Physics" },
  { icon: "math", label: "Math" },
  { icon: "english", label: "English" },
];

export interface Feature {
  icon: string;
  title: string;
  description: string;
}

export const features: Feature[] = [
  {
    icon: "/illustrations/icons/act-reading.png",
    title: "Readings with figures",
    description:
      "Focused readings generated from your materials, with the original figures and diagrams pulled straight from your PDFs.",
  },
  {
    icon: "/illustrations/icons/act-worksheet.png",
    title: "Worksheets with AI grading",
    description:
      "Exam-style questions marked against an AI markscheme — with per-part feedback, not just right or wrong.",
  },
  {
    icon: "/illustrations/icons/act-flashcards.png",
    title: "Flashcards",
    description:
      "Auto-generated decks that target the definitions, formulas, and concepts you actually need to memorise.",
  },
  {
    icon: "/illustrations/icons/act-cloze.png",
    title: "Cloze passages",
    description:
      "Fill-in-the-blank passages built from your notes that force real recall instead of passive recognition.",
  },
  {
    icon: "/illustrations/icons/act-comprehension.png",
    title: "Comprehension checks",
    description:
      "Quick checkpoints after each reading to confirm you understood it — before you move on.",
  },
  {
    icon: "/illustrations/icons/act-explain.png",
    title: "AI copilot",
    description:
      "A study partner that knows your course. Ask questions, get explanations, and dig deeper without leaving your session.",
  },
];

export type SceneMock = "session" | "quiz" | "copilot" | "upload" | "flashcards";

export interface FeatureScene {
  kicker: string;
  title: string;
  body: string;
  bullets: string[];
  art: string;
  artClassName?: string;
  mock: SceneMock;
  reverse?: boolean;
}

export const homeScenes: FeatureScene[] = [
  {
    kicker: "For study",
    title: "One guided session, not a pile of tools",
    body: "Flashcards, quizzes, worksheets, and readings aren’t separate apps. Scribe builds them together into a single path through your own course material.",
    bullets: [
      "A plan generated from your PDFs, slides, and lectures",
      "Waypoints you can jump between — hover to peek, click to skip ahead",
      "Progress that actually means “I did the work,” not “I opened the file”",
    ],
    art: "/illustrations/journey.png",
    mock: "session",
  },
  {
    kicker: "For practice",
    title: "Questions that mark you, then explain why",
    body: "Multiple-choice, cloze, and exam-style worksheets come from your notes — with a markscheme that tells you the causal step you missed, not just a green tick.",
    bullets: [
      "MCQ and vocab recall with an instant confetti pop when you get it",
      "Worksheets graded part-by-part against an AI markscheme",
      "Feedback cites the page in your PDF, so you can go back",
    ],
    art: "/illustrations/marketing/mkt-mcq.png",
    mock: "quiz",
    reverse: true,
  },
  {
    kicker: "For memory",
    title: "Flashcards that sound like your class",
    body: "Decks are built from your definitions, formulas, and diagrams — so they look like what you saw in lecture, not a generic question bank.",
    bullets: [
      "Auto-generated from the materials you uploaded",
      "Spaced review when cards come due",
      "Flip, grade yourself, keep moving",
    ],
    art: "/illustrations/cards.png",
    mock: "flashcards",
  },
  {
    kicker: "For when you’re stuck",
    title: "A copilot that already read the PDF",
    body: "Ask mid-session. Answers come from your materials with a citation back to the exact page — and it can extend the plan with extra practice when a topic feels shaky.",
    bullets: [
      "Grounded in this workspace, not the open web",
      "Explains worksheet feedback step by step",
      "Sits beside the question, 60 / 40, when you open it",
    ],
    art: "/illustrations/bot.png",
    mock: "copilot",
    reverse: true,
  },
];

export const featureScenes: FeatureScene[] = [
  {
    kicker: "Readings",
    title: "The figures stay with the words",
    body: "Scribe pulls diagrams, graphs, and photos out of your PDFs and places them next to the reading they belong to — so you’re not flipping back to slide 47.",
    bullets: [
      "Original figures, not redrawn guesses",
      "Highlight as you go; notes live on the session",
      "A comprehension check waiting at the end",
    ],
    art: "/illustrations/marketing/mkt-reading.png",
    mock: "session",
  },
  {
    kicker: "Worksheets",
    title: "Exam-style questions. Actual marks.",
    body: "Not a chatbot dumping an answer. Worksheets are marked against a scheme — per part — so you can see where the mark went.",
    bullets: [
      "Multi-step calculations, units, and derivations",
      "Per-part feedback, not just right or wrong",
      "Built from your past papers when you upload them",
    ],
    art: "/illustrations/marketing/mkt-clip.png",
    mock: "quiz",
    reverse: true,
  },
  {
    kicker: "Upload",
    title: "Bring the course as it actually is",
    body: "Lecture slides, textbook chapters, messy screenshots, audio of the class you half-listened to. Scribe parses text, figures, and transcripts.",
    bullets: [
      "PDFs and slides, figures included",
      "Lecture audio, transcribed for you",
      "Notes and handouts, organised into workspaces",
    ],
    art: "/illustrations/marketing/mkt-upload.png",
    mock: "upload",
  },
  homeScenes[2],
  homeScenes[3],
];

export const howItWorks = [
  {
    num: "01",
    title: "Upload your materials",
    description:
      "Drop in PDFs, lecture slides, or audio. Scribe parses the text, figures, and diagrams — the stuff your exam will actually use.",
    art: "/illustrations/marketing/mkt-upload.png",
  },
  {
    num: "02",
    title: "Scribe builds the session",
    description:
      "Your materials become a path: readings, checks, worksheets, flashcards. One plan, not five tabs.",
    art: "/illustrations/journey.png",
  },
  {
    num: "03",
    title: "Study, then ask",
    description:
      "Work through the waypoints. When you get stuck, the copilot answers from your own pages and can add extra practice.",
    art: "/illustrations/bot.png",
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
  {
    icon: "/illustrations/icons/act-reading.png",
    label: "Reading: Enzyme kinetics",
    meta: "12 min",
  },
  {
    icon: "/illustrations/icons/act-comprehension.png",
    label: "Comprehension check",
    meta: "4 questions",
  },
  {
    icon: "/illustrations/icons/act-worksheet.png",
    label: "Worksheet: Rate equations",
    meta: "AI-marked",
  },
  {
    icon: "/illustrations/icons/act-flashcards.png",
    label: "Flashcards: Key definitions",
    meta: "18 cards",
  },
  {
    icon: "/illustrations/icons/act-cloze.png",
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
