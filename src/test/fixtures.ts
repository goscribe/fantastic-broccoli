import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@goscribe/server";
import type {
  ApiArtifactBankItem,
  ApiStudySession,
} from "@/lib/api/study-session";

/**
 * Demo fixtures, statically typed against the live goscribe/server contracts:
 * AppRouter procedures use `inferRouterOutputs`, so a schema change in the
 * published server package turns into a compile error here rather than a
 * silently stale mock.
 */
type Outputs = inferRouterOutputs<AppRouter>;

const now = new Date("2026-07-02T04:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

export const sessionUser: Outputs["auth"]["getSession"] = {
  user: {
    id: "u1",
    name: "Maya",
    email: "maya@scribe.study",
    emailVerified: true,
    profilePicture: null,
    role: null,
  },
};

export const workspaceTree: Outputs["workspace"]["getTree"] = {
  folders: [
    {
      id: "fo-sci",
      name: "Sciences",
      updatedAt: daysAgo(1),
      color: "green",
      markerColor: null,
      parentId: null,
    },
    {
      id: "fo-hum",
      name: "Humanities",
      updatedAt: daysAgo(2),
      color: "orange",
      markerColor: null,
      parentId: null,
    },
  ],
  workspaces: [
    {
      id: "ws-chem",
      updatedAt: daysAgo(0),
      uploads: [
        {
          id: "up-1",
          name: "Organic Chemistry — Ch. 12 Reaction Mechanisms.pdf",
          createdAt: daysAgo(2),
          mimeType: "application/pdf",
        },
        {
          id: "up-2",
          name: "Lecture 18 — Nucleophilic Substitution.pdf",
          createdAt: daysAgo(1),
          mimeType: "application/pdf",
        },
      ],
      title: "Chemistry HL",
      icon: "flask",
      color: "green",
      markerColor: null,
      folderId: "fo-sci",
    },
    {
      id: "ws-calc",
      updatedAt: daysAgo(1),
      uploads: [
        {
          id: "up-3",
          name: "Integration techniques.pdf",
          createdAt: daysAgo(3),
          mimeType: "application/pdf",
        },
      ],
      title: "Calculus II",
      icon: "book",
      color: "blue",
      markerColor: null,
      folderId: null,
    },
  ],
};

export const chemWorkspace: Outputs["workspace"]["get"] = {
  id: "ws-chem",
  createdAt: daysAgo(30),
  updatedAt: daysAgo(0),
  uploads: [
    {
      id: "up-1",
      name: "Organic Chemistry — Ch. 12 Reaction Mechanisms.pdf",
      createdAt: daysAgo(2),
      size: 2_400_000,
      objectKey: "uploads/up-1.pdf",
      mimeType: "application/pdf",
    },
  ],
  ownerId: "u1",
  title: "Chemistry HL",
  description: "Organic mechanisms, kinetics and equilibrium",
  icon: "flask",
  color: "green",
  markerColor: null,
  folderId: "fo-sci",
  fileBeingAnalyzed: false,
  analysisProgress: null,
  needsAnalysis: false,
  folder: { id: "fo-sci", name: "Sciences", color: "green" },
};

export const chemSession: ApiStudySession = {
  id: "ses-1",
  workspaceId: "ws-chem",
  userId: "u1",
  title: "Nucleophilic substitution deep-dive",
  description:
    "SN1/SN2 mechanisms, rate laws and stereochemistry from your Ch. 12 notes",
  depth: "MODERATE",
  durationMinutes: 50,
  status: "ACTIVE",
  progress: 62,
  examBoard: "IB",
  syllabus: "Topic 10 — Organic chemistry",
  topics: "SN1, SN2, rate laws",
  startDate: daysAgo(1),
  endDate: null,
  createdAt: daysAgo(1),
  updatedAt: now,
  comments: [],
  activities: [
    {
      id: "act-1",
      sessionId: "ses-1",
      type: "READING",
      title: "SN1 vs SN2: the core distinction",
      description: null,
      content: {
        type: "reading",
        text: "## Two pathways, one goal\n\nNucleophilic substitution replaces a **leaving group** with a **nucleophile**.",
        figures: [],
      },
      order: 0,
      status: "COMPLETED",
      estimatedMinutes: 8,
      timeSpentSeconds: 460,
      createdAt: daysAgo(1),
      updatedAt: now,
    },
    {
      id: "act-2",
      sessionId: "ses-1",
      type: "FLASHCARD_REVIEW",
      title: "Key terms: substitution mechanisms",
      description: null,
      content: {
        type: "flashcard_review",
        cards: [
          {
            front: "What does the '2' in SN2 refer to?",
            back: "Bimolecular rate-determining step.",
            known: true,
          },
        ],
      },
      order: 1,
      status: "IN_PROGRESS",
      estimatedMinutes: 6,
      timeSpentSeconds: 120,
      createdAt: daysAgo(1),
      updatedAt: now,
    },
    {
      id: "act-3",
      sessionId: "ses-1",
      type: "WORKSHEET",
      title: "Exam practice: kinetics of substitution",
      description: null,
      content: {
        type: "worksheet",
        steps: [
          {
            title: "Question 1 — The hydrolysis of 2-bromo-2-methylpropane",
            description:
              "2-bromo-2-methylpropane is hydrolysed by aqueous sodium hydroxide.",
            parts: [
              {
                question: "State the rate equation for this reaction.",
                marks: 3,
                markScheme: "rate = k[substrate]; first order; SN1 mechanism",
              },
            ],
          },
        ],
      },
      order: 2,
      status: "PENDING",
      estimatedMinutes: 12,
      timeSpentSeconds: null,
      createdAt: daysAgo(1),
      updatedAt: now,
    },
  ],
};

export const bankItems: ApiArtifactBankItem[] = [
  {
    id: "bank-1",
    workspaceId: "ws-chem",
    fileId: "up-1",
    kind: "WORKSHEET",
    title: "Halogenoalkane hydrolysis — exam set",
    topic: "Substitution kinetics",
    syllabusRef: "10.2",
    difficulty: 3,
    content: {
      type: "worksheet",
      steps: [
        {
          title: "Hydrolysis rates",
          description: "Compare SN1 and SN2 hydrolysis.",
          parts: [
            {
              question: "Why does a tertiary substrate favour SN1?",
              marks: 2,
              markScheme: "stable carbocation; steric hindrance blocks backside",
            },
          ],
        },
      ],
    },
    usedCount: 4,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(0),
  },
  {
    id: "bank-2",
    workspaceId: "ws-chem",
    fileId: "up-1",
    kind: "FLASHCARD_DECK",
    title: "Substitution mechanisms deck",
    topic: "Organic chemistry",
    syllabusRef: null,
    difficulty: 1,
    content: {
      type: "flashcard_review",
      cards: [
        {
          front: "Stereochemical outcome of SN2?",
          back: "Inversion of configuration (Walden inversion).",
        },
      ],
    },
    usedCount: 12,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(1),
  },
];

export const activityCalendar: { date: string; count: number }[] = Array.from(
  { length: 30 },
  (_, i) => ({
    date: daysAgo(29 - i).toISOString().split("T")[0],
    count: (i * 7) % 5,
  }),
);
