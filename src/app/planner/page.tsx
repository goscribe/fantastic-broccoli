"use client";

import { Suspense } from "react";
import { ExamPlanner } from "@/components/planner/exam-planner";
import "@/app/design/design.css";

/** Study planner: exams → a day-by-day plan (Today, Plan, Exams) plus the hour-by-hour timetable. */
export default function PlannerPage() {
  return (
    <Suspense fallback={null}>
      <ExamPlanner />
    </Suspense>
  );
}
