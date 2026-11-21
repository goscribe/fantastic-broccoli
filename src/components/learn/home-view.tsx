"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/lib/api/auth";
import { createStudySession } from "@/lib/api/study";
import { uploadFiles, analyzeFiles } from "@/lib/api/materials";
import { startWorkspaceFromUploads, workspaceTitleFromFiles, fileBasename } from "@/lib/start-from-uploads";
import { UPLOAD_ACCEPT } from "@/lib/uploads";
import { emitTreeChanged } from "@/lib/tree-events";
import { toastError } from "@/lib/toast";
import { useDaypart } from "@/lib/use-daypart";
import type { Daypart } from "@/lib/daypart";
import type { HomeSummary } from "@/lib/home-action";
import { HomeBanner, HomeBannerError } from "@/components/learn/today-card";
import { SubjectsGrid } from "@/components/learn/subjects-grid";
import "@/app/design/design.css";

/** The same buckets as the banner's sky (src/lib/daypart.ts), so the words and the scene agree. */
const GREETING: Record<Daypart, string> = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Good evening",
  night: "Good evening",
  late: "Up late",
};

/** Home's frame: one column, the same at every width. */
const frame = "mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-12 pt-5 sm:gap-7 sm:px-6 sm:pt-6";

export function useGreeting(): string {
  const { user } = useAuthUser();
  const daypart = useDaypart();
  const firstName = user?.name?.trim().split(/\s+/)[0];
  return `${daypart ? GREETING[daypart] : "Hello"}${firstName ? `, ${firstName}` : ""}`;
}

/**
 * The signed-in home: what to do now (one sentence, one button) and the
 * student's subjects. Everything here comes from one `home.summary` call.
 */
export function HomeView({ summary }: { summary: HomeSummary }) {
  const router = useRouter();
  const greeting = useGreeting();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  /** From home an upload is the first win: 5 questions on it, not a half-hour plan. */
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    setUploading(true);
    try {
      const target = summary.subjects[0]?.id;
      if (!target) {
        const created = await startWorkspaceFromUploads(list);
        router.push(created.session ? `/workspace/${created.workspaceId}/session/${created.session.id}` : `/workspace/${created.workspaceId}`);
        return;
      }
      const fileIds = await uploadFiles(target, list);
      analyzeFiles(target, fileIds).catch(() => {});
      emitTreeChanged();
      const session = await createStudySession({
        workspaceId: target,
        title: workspaceTitleFromFiles(list),
        depth: "light",
        durationMinutes: 5,
        quickStart: true,
        topics: list.map((f) => fileBasename(f.name)).filter(Boolean).join(", ").slice(0, 2000) || undefined,
      });
      router.push(session ? `/workspace/${target}/session/${session.id}` : `/workspace/${target}`);
    } catch (e) {
      toastError(e, "Upload failed");
      setUploading(false);
    }
  };

  return (
    <div className={frame}>
      <input ref={fileRef} type="file" multiple accept={UPLOAD_ACCEPT} className="hidden" onChange={(e) => void onFiles(e.target.files)} />
      <HomeBanner greeting={greeting} summary={summary} uploading={uploading} onUpload={() => fileRef.current?.click()} />
      {summary.action.kind !== "upload" && <SubjectsGrid subjects={summary.subjects} onNew={() => router.push("/new-subject")} />}
    </div>
  );
}

/** The summary failed: the banner says so with Retry; nothing on the page pretends there are no subjects. */
export function HomeError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const greeting = useGreeting();
  return (
    <div className={frame}>
      <HomeBannerError greeting={greeting} onRetry={onRetry} retrying={retrying} />
    </div>
  );
}
