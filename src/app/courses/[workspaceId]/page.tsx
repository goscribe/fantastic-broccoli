"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CourseTopics } from "@/components/courses/course-topics";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/courses";

/** One course subject: topics done, mastery per topic, and a Quick 5 on any topic. */
export default function CourseSubjectPage() {
  const { t } = useI18n();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  return (
    <div className="flex-1 bg-white">
      <div className="mx-auto w-full max-w-[760px] px-4 pb-12 pt-6 sm:px-6">
        <Link href="/courses" className="text-[12px] font-semibold text-faint hover:text-accent">
          ← {t("course.backCourses")}
        </Link>
        <div className="mt-2">
          <CourseTopics workspaceId={workspaceId} showTitle />
        </div>
      </div>
    </div>
  );
}
