"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { coursesApi, type CourseSubject } from "@/lib/api/courses";
import { CoursePicker } from "@/components/courses/course-picker";
import { CourseProgressRow } from "@/components/courses/course-shelf";
import { useStartCourseTopic } from "@/components/courses/use-start-topic";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/courses";

/** "Pick your course" for existing learners: their courses' progress, and the picker to add another. */
export default function CoursesPage() {
  const { t } = useI18n();
  const [mine, setMine] = useState<CourseSubject[] | null>(null);
  const { start, busyTopicId } = useStartCourseTopic();

  useEffect(() => {
    coursesApi
      .mine()
      .then(setMine)
      .catch(() => setMine([]));
  }, []);

  return (
    <div className="flex-1 bg-white">
      <div className="mx-auto w-full max-w-[760px] px-4 pb-12 pt-6 sm:px-6">
        <Link href="/" className="text-[12px] font-semibold text-faint hover:text-accent">
          ← {t("course.backHome")}
        </Link>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight">{t("course.pageTitle")}</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">{t("course.pageSubtitle")}</p>

        {mine && mine.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-[18px] font-extrabold">{t("course.yourCourses")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {mine.map((c) => (
                <CourseProgressRow key={c.workspaceId} c={c} />
              ))}
            </div>
          </section>
        )}

        <div className="mt-7">
          <CoursePicker
            onStart={(course, topic, level) => void start(course, topic, level)}
            busyTopicId={busyTopicId}
            enrolledCourseIds={mine?.map((c) => c.courseId)}
          />
        </div>
      </div>
    </div>
  );
}
