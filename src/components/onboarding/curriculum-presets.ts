import type { ExamBoard } from "@/types";

/**
 * Tap-to-start curricula for onboarding: picking a curriculum then a subject
 * is enough for the planner to generate a session — no upload required.
 */
export interface CurriculumPreset {
  board: ExamBoard;
  label: string;
  subjects: string[];
}

export const CURRICULUM_PRESETS: CurriculumPreset[] = [
  {
    board: "IB",
    label: "IB",
    subjects: [
      "Math AA",
      "Math AI",
      "Physics",
      "Chemistry",
      "Biology",
      "Economics",
      "Business Management",
      "Psychology",
      "History",
      "English A",
      "Computer Science",
      "Environmental Systems",
    ],
  },
  {
    board: "AP",
    label: "AP",
    subjects: [
      "Calculus AB",
      "Calculus BC",
      "Statistics",
      "Physics 1",
      "Chemistry",
      "Biology",
      "Psychology",
      "US History",
      "World History",
      "Computer Science A",
      "English Language",
      "Microeconomics",
    ],
  },
  {
    board: "A_LEVEL",
    label: "A-Level",
    subjects: [
      "Maths",
      "Further Maths",
      "Physics",
      "Chemistry",
      "Biology",
      "Economics",
      "Psychology",
      "History",
      "English Literature",
      "Computer Science",
    ],
  },
  {
    board: "GCSE",
    label: "GCSE",
    subjects: [
      "Maths",
      "Physics",
      "Chemistry",
      "Biology",
      "English",
      "Geography",
      "History",
      "Computer Science",
    ],
  },
  {
    board: "SAT",
    label: "SAT",
    subjects: ["Math", "Reading & Writing"],
  },
];
