"use client";

import { SyllabusMatchCard } from "@/components/courses/syllabus-match-card";
import { SubjectBand } from "@/components/learn/subject-tile";
import type { CourseSummary } from "@/lib/api/courses";
import type { SyllabusMatch } from "@/lib/syllabus-match";

/**
 * Design preview of the syllabus-match confirm step with fixture data and no
 * network: high confidence (one tap), medium (pick of 2–3), low (board-first
 * picker), and an IB match whose level still has to be chosen.
 */
const topic = (code: string, name: string, unitCode: string, unitName: string) => ({ id: code.replace(/\./g, "-").toLowerCase(), code, name, unitCode, unitName, confidence: 0.9 });

const HIGH: SyllabusMatch = {
  status: "suggested",
  prompt: "confirm",
  band: "high",
  confidence: 0.96,
  suggestion: {
    courseId: "aqa-gcse-biology",
    courseTitle: "AQA GCSE Biology",
    label: "AQA GCSE Biology",
    boardName: "AQA",
    qualification: "GCSE",
    level: null,
    levels: null,
    topics: [topic("4.1.1", "Cell structure", "4.1", "Cell biology")],
  },
  options: [],
  boardGuess: null,
};

const IB: SyllabusMatch = {
  ...HIGH,
  confidence: 0.85,
  suggestion: { courseId: "ib-chemistry", courseTitle: "IB Chemistry", label: "IB Chemistry", boardName: "IB Diploma Programme", qualification: "IB Diploma", level: null, levels: ["SL", "HL"], topics: [topic("R1.4", "Entropy and spontaneity", "R1", "What drives chemical reactions?")] },
};

const MEDIUM: SyllabusMatch = {
  status: "suggested",
  prompt: "choose",
  band: "medium",
  confidence: 0.7,
  suggestion: { ...HIGH.suggestion!, courseId: "aqa-gcse-combined-science", courseTitle: "AQA GCSE Combined Science: Trilogy", label: "AQA GCSE Combined Science: Trilogy" },
  options: [
    { courseId: "aqa-gcse-combined-science", label: "AQA GCSE Combined Science: Trilogy", boardName: "AQA", level: null, confidence: 0.7 },
    { courseId: "aqa-gcse-biology", label: "AQA GCSE Biology", boardName: "AQA", level: null, confidence: 0.6 },
    { courseId: "aqa-alevel-biology", label: "AQA A-level Biology", boardName: "AQA", level: null, confidence: 0.3 },
  ],
  boardGuess: null,
};

const LOW: SyllabusMatch = { status: "none", prompt: "pick", band: "low", confidence: 0.4, suggestion: null, options: [], boardGuess: { board: "Edexcel", qualification: "GCSE" } };

const c = (id: string, title: string, board: CourseSummary["board"]): CourseSummary => ({ id, title, board, boardName: "", subject: "", qualification: "", unitCount: 0, topicCount: 0 });
const COURSES: CourseSummary[] = [
  c("aqa-gcse-biology", "AQA GCSE Biology", "GCSE"),
  c("aqa-gcse-combined-science", "AQA GCSE Combined Science: Trilogy", "GCSE"),
  c("aqa-alevel-biology", "AQA A-level Biology", "A_LEVEL"),
  c("edexcel-alevel-biology-a", "Edexcel A-level Biology A (Salters-Nuffield)", "A_LEVEL"),
  c("edexcel-alevel-maths", "Edexcel A-level Mathematics", "A_LEVEL"),
  c("ib-biology", "IB Biology", "IB"),
];

const noop = async () => {};

export default function Page() {
  return (
    <main className="mx-auto min-h-dvh max-w-[760px] bg-background px-4 py-6 sm:px-6">
      <SubjectBand match="Biology" stored="biology" seed="fixture" className="!rounded-[var(--r-card)] px-[18px] py-4 sm:px-6 sm:py-5">
        <h1 className="subject-band__title max-w-[66%] text-[22px] font-extrabold leading-[1.15] text-white sm:text-[26px]">Biology</h1>
        <p className="subject-tile__sub mt-1 max-w-[66%] text-small font-semibold">3 materials</p>
      </SubjectBand>
      <div className="mt-6 flex flex-col gap-5">
        <SyllabusMatchCard workspaceId="fx-high" from="upload" match={HIGH} onAnswer={noop} courses={COURSES} />
        <SyllabusMatchCard workspaceId="fx-ib" from="subject" match={IB} onAnswer={noop} courses={COURSES} />
        <SyllabusMatchCard workspaceId="fx-medium" from="subject" match={MEDIUM} onAnswer={noop} courses={COURSES} />
        <SyllabusMatchCard workspaceId="fx-low" from="subject" match={LOW} onAnswer={noop} courses={COURSES} />
      </div>
    </main>
  );
}
