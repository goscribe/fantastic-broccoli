export type SceneMock =
  "session" | "quiz" | "copilot" | "upload" | "flashcards";

export interface Feature {
  title: string;
  description: string;
}

export const features: Feature[] = [
  {
    title: "Readings with figures",
    description:
      "Focused readings generated from your materials, with the original figures and diagrams pulled straight from your PDFs.",
  },
  {
    title: "Worksheets with AI grading",
    description:
      "Exam-style questions marked against an AI markscheme — with per-part feedback, not just right or wrong.",
  },
  {
    title: "Flashcards",
    description:
      "Cards for the definitions, formulas and concepts you need to memorise, brought back by spaced repetition right before you forget them.",
  },
  {
    title: "Quick checks and cloze",
    description:
      "A Quick 5 after each reading and fill-in-the-blank passages from your notes, so you recall it instead of recognising it.",
  },
  {
    title: "Planner and streak",
    description:
      "Connect Google Calendar and Scribe slots study times around your week. Your streak counts on the days you hit your goal.",
  },
  {
    title: "AI copilot",
    description:
      "A study partner that knows your course. Ask questions, get explanations, and dig deeper without leaving your session.",
  },
];

export interface FeatureScene {
  title: string;
  body: string;
  bullets: string[];
  mock: SceneMock;
  reverse?: boolean;
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
  },
];

export const howItWorks = [
  {
    num: "1",
    title: "Make a subject, drop in your notes",
    description:
      "One subject per course — PDFs, slides, photos of notes, lecture audio. Scribe reads the text, figures and diagrams, so everything it builds comes from your own material.",
    pose: "pencil" as const,
  },
  {
    num: "2",
    title: "Scribe builds the study session",
    description:
      "Tell it what to cover (or just tick a few files) and it builds a 25-minute session: a reading, a check, a worksheet, flashcards. Sessions stack up inside the subject, in order.",
    pose: "think" as const,
  },
  {
    num: "3",
    title: "Study a bit every day",
    description:
      "Connect your calendar and the planner slots study times around school and sport, with a streak that counts when you hit your daily goal. Stuck? The copilot answers from your own pages.",
    pose: "flame" as const,
  },
];

export const plans = [
  {
    name: "Free",
    price: "$0",
    description:
      "Try it properly: two subjects, three full sessions, and a free Quick 5 every day.",
    features: [
      "2 subjects · 3 full study sessions · 2 tests · a free Quick 5 every day",
      "Upload PDFs, slides, and lecture audio",
      "250 tokens per month",
      "2 GB storage",
    ],
    cta: "Start studying",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$5/mo",
    description: "Student price: focused study sessions every week.",
    features: [
      "Unlimited subjects, study sessions and tests",
      "600 tokens per month (about 15 full sessions)",
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
