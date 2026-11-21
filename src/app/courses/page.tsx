"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { coursesApi, type CourseSubject } from "@/lib/api/courses";
import { CoursePicker } from "@/components/courses/course-picker";
import { CourseProgressRow } from "@/components/courses/course-shelf";
import { useStartCourseTopic } from "@/components/courses/use-start-topic";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/courses";
import { PageShell } from "@/components/ui/page-header";

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
    <PageShell max="max-w-[760px]">
        <Link href="/" className="text-[12px] font-semibold text-faint hover:text-accent">
          ← {t("course.backHome")}
        </Link>
        <h1 className="page-h1 mt-1">{t("course.pageTitle")}</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">{t("course.pageSubtitle")}</p>

        {mine && mine.length > 0 && (
          <section className="mt-6">
            <h2 className="page-h2 mb-3">{t("course.yourCourses")}</h2>
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
    </PageShell>
  );
}
