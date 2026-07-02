import {
  Workspace,
  Folder,
  StudySession,
  SessionActivity,
} from "@/types";

const now = new Date().toISOString();
const yesterday = new Date(Date.now() - 86400000).toISOString();
const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();
const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString();
const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString();

const chemActivities: SessionActivity[] = [
  {
    id: "act-1",
    sessionId: "ses-1",
    type: "reading",
    title: "Atomic Structure Overview",
    description: "Review electron configuration and periodic trends",
    content: {
      type: "reading",
      text: "The atomic structure of an element determines its chemical properties. Electrons are arranged in energy levels (shells) around the nucleus. The electron configuration follows the Aufbau principle, filling lower energy orbitals first.\n\nKey concepts:\n- Principal quantum number (n) determines the energy level\n- Subshells (s, p, d, f) have different shapes and capacities\n- Hund's rule: electrons fill orbitals singly before pairing\n- The periodic table organizes elements by increasing atomic number\n\nPeriodic trends:\n- Atomic radius decreases across a period (increased nuclear charge)\n- Ionization energy generally increases across a period\n- Electronegativity increases across a period and up a group",
      completed: false,
    },
    order: 0,
    status: "completed",
    estimatedMinutes: 8,
    timeSpentSeconds: 420,
  },
  {
    id: "act-2",
    sessionId: "ses-1",
    type: "comprehension_check",
    title: "Explain Electron Configuration",
    content: {
      type: "comprehension_check",
      originalText:
        "Electrons fill orbitals in order of increasing energy. The Aufbau principle states that electrons occupy the lowest available energy orbital. Each orbital can hold a maximum of 2 electrons with opposite spins (Pauli exclusion principle). In degenerate orbitals, electrons fill singly first with parallel spins before pairing (Hund's rule).",
      userRewrites: [
        "Electrons go into the lowest energy spots first. Each spot holds 2 electrons spinning opposite ways. When there are spots with the same energy, electrons spread out before doubling up.",
      ],
      evaluations: [
        {
          attempt: 1,
          score: 72,
          feedback:
            "Good grasp of the basics! You captured the Aufbau principle and Pauli exclusion well. Try to also mention Hund's rule by name and explain what 'parallel spins' means in the context of singly-filled orbitals.",
          passed: false,
        },
      ],
    },
    order: 1,
    status: "in_progress",
    estimatedMinutes: 12,
    timeSpentSeconds: 180,
  },
  {
    id: "act-3",
    sessionId: "ses-1",
    type: "mcq",
    title: "Periodic Trends Quiz",
    content: {
      type: "mcq",
      question:
        "Which of the following correctly describes the trend in atomic radius across Period 3 (Na to Ar)?",
      options: [
        "Atomic radius increases due to more electron shells",
        "Atomic radius decreases due to increasing nuclear charge",
        "Atomic radius remains constant across the period",
        "Atomic radius increases due to electron-electron repulsion",
      ],
      correctIndex: 1,
      explanation:
        "Across a period, the number of protons increases while electrons are added to the same energy level. The increased nuclear charge pulls electrons closer, decreasing the atomic radius.",
    },
    order: 2,
    status: "pending",
    estimatedMinutes: 3,
  },
  {
    id: "act-4",
    sessionId: "ses-1",
    type: "flashcard_review",
    title: "Key Definitions Review",
    content: {
      type: "flashcard_review",
      cards: [
        { front: "Ionization Energy", back: "The minimum energy required to remove an electron from a gaseous atom in its ground state", known: null },
        { front: "Electronegativity", back: "The ability of an atom to attract a shared pair of electrons in a covalent bond", known: null },
        { front: "Electron Affinity", back: "The energy change when an electron is added to a neutral gaseous atom", known: null },
        { front: "Shielding Effect", back: "The reduction of nuclear charge experienced by outer electrons due to inner electrons", known: null },
      ],
    },
    order: 3,
    status: "pending",
    estimatedMinutes: 5,
  },
];

const bioActivities: SessionActivity[] = [
  {
    id: "act-5",
    sessionId: "ses-2",
    type: "reading",
    title: "Cell Membrane Structure",
    content: {
      type: "reading",
      text: "The fluid mosaic model describes the cell membrane as a dynamic structure composed of a phospholipid bilayer with embedded proteins. Phospholipids have hydrophilic heads and hydrophobic tails, creating a selectively permeable barrier.\n\nIntegral proteins span the entire membrane and function as channels, carriers, or receptors. Peripheral proteins attach to the surface and play roles in cell signaling and cytoskeleton anchoring.\n\nCholesterol molecules are interspersed among the phospholipids in animal cells, regulating membrane fluidity across temperature changes.",
      completed: false,
    },
    order: 0,
    status: "pending",
    estimatedMinutes: 10,
  },
  {
    id: "act-6",
    sessionId: "ses-2",
    type: "mcq",
    title: "Membrane Transport",
    content: {
      type: "mcq",
      question: "Which transport mechanism requires ATP?",
      options: [
        "Osmosis",
        "Facilitated diffusion",
        "Active transport via sodium-potassium pump",
        "Simple diffusion of oxygen",
      ],
      correctIndex: 2,
      explanation:
        "The sodium-potassium pump uses ATP to move 3 Na+ out and 2 K+ into the cell against their concentration gradients. All other options are passive processes.",
    },
    order: 1,
    status: "pending",
    estimatedMinutes: 3,
  },
];

const sessions: StudySession[] = [
  {
    id: "ses-1",
    workspaceId: "ws-1",
    title: "Atomic Structure & Periodicity",
    description: "Master electron configuration and periodic trends for IB exam",
    depth: "deep",
    durationMinutes: 45,
    comments: [
      "Focus on electron configuration notation",
      "Review periodic trends for Paper 1 MCQs",
    ],
    activities: chemActivities,
    progress: 35,
    status: "active",
    startDate: yesterday,
    endDate: nextWeek,
    examBoard: "IB",
    syllabus: "Chemistry HL Topic 2",
    createdAt: lastWeek,
    updatedAt: now,
  },
  {
    id: "ses-2",
    workspaceId: "ws-1",
    title: "Organic Chemistry Fundamentals",
    depth: "moderate",
    durationMinutes: 30,
    comments: [],
    activities: [],
    progress: 0,
    status: "active",
    startDate: now,
    endDate: nextMonth,
    examBoard: "IB",
    syllabus: "Chemistry HL Topic 10",
    createdAt: now,
    updatedAt: now,
  },
];

const bioSessions: StudySession[] = [
  {
    id: "ses-3",
    workspaceId: "ws-2",
    title: "Cell Biology Review",
    description: "Membrane structure, transport, and cell division",
    depth: "deep",
    durationMinutes: 60,
    comments: ["Review for upcoming unit test"],
    activities: bioActivities,
    progress: 0,
    status: "active",
    startDate: now,
    endDate: nextWeek,
    examBoard: "AP",
    syllabus: "AP Biology Unit 2",
    createdAt: lastWeek,
    updatedAt: now,
  },
];

export const mockWorkspaces: Workspace[] = [
  {
    id: "ws-1",
    title: "IB Chemistry HL",
    description: "Higher Level Chemistry - May 2026 exams",
    icon: "flask",
    color: "#c8f542",
    sessions: sessions,
    totalProgress: 35,
    lastStudied: now,
    createdAt: lastWeek,
  },
  {
    id: "ws-2",
    title: "AP Biology",
    description: "AP Bio exam prep",
    icon: "dna",
    color: "#7dd3fc",
    sessions: bioSessions,
    totalProgress: 0,
    lastStudied: yesterday,
    createdAt: lastWeek,
  },
  {
    id: "ws-3",
    title: "IB Math AA HL",
    description: "Analysis & Approaches Higher Level",
    icon: "sigma",
    color: "#a78bfa",
    sessions: [],
    totalProgress: 0,
    createdAt: lastWeek,
  },
];

export const mockFolders: Folder[] = [
  {
    id: "fld-1",
    name: "IB Diploma",
    color: "#c8f542",
    workspaces: [mockWorkspaces[0], mockWorkspaces[2]],
  },
  {
    id: "fld-2",
    name: "AP Classes",
    color: "#7dd3fc",
    workspaces: [mockWorkspaces[1]],
  },
];

export function getWorkspace(id: string): Workspace | undefined {
  return mockWorkspaces.find((w) => w.id === id);
}

export function getSession(id: string): StudySession | undefined {
  for (const ws of mockWorkspaces) {
    const session = ws.sessions.find((s) => s.id === id);
    if (session) return session;
  }
  return undefined;
}

export function getSessionWithActivities(id: string): StudySession | undefined {
  return getSession(id);
}
