"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, ClipboardPaste, GraduationCap, Loader2, PenLine, Upload } from "lucide-react";
import { createWorkspace } from "@/lib/api/workspace";
import { addPastedText, analyzeFiles, uploadFiles } from "@/lib/api/materials";
import { createStudySession } from "@/lib/api/study";
import { emitTreeChanged } from "@/lib/tree-events";
import { toastError } from "@/lib/toast";
import { UPLOAD_ACCEPT } from "@/lib/uploads";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/first-run";
import "@/lib/i18n/courses";
import { CoursePicker } from "@/components/courses/course-picker";
import { coursesApi, type CatalogTopic, type Course, type CourseLevel } from "@/lib/api/courses";
import { markFirstScreenShown, track, type FirstRunOption } from "@/lib/funnel";
import { NotesOffer, type NotesOfferSelection } from "@/components/onboarding/notes-offer";
import { attachedNotesApi } from "@/lib/api/notes";
import {
  PASTE_MAX_CHARS,
  PASTE_MIN_CHARS,
  pastedSubjectTitle,
  topicStart,
  uploadSubjectTitle,
} from "@/lib/first-run";
import type { ExamBoard } from "@/types";

type Mode = "upload" | "topic" | "paste" | "course";
type Busy = "uploading" | "saving" | "building" | null;

/** One "viewed" per page load, however often the screen remounts. */
let viewedTracked = false;

const EXAMPLE_KEYS = ["firstRun.example1", "firstRun.example2", "firstRun.example3"] as const;

/**
 * First screen after signup, and home for anyone without a subject: "What are
 * you studying?" with four equal ways in — upload (one-tap camera on phones),
 * type a topic, paste text, or pick a course from Scribe's outlines (course →
 * unit → topic, for the many who have no notes to hand). Every path goes
 * straight to a Quick 5: no intro video, no naming step, no plan picker.
 */
export function FirstRun({
  firstName,
  onSkip,
  fallbackWorkspaceId,
}: {
  firstName?: string;
  /** Offered only to learners who already have a subject to look around in. */
  onSkip?: () => void;
  /** An existing empty subject to use if a new one can't be created (e.g. the unverified one-subject limit). */
  fallbackWorkspaceId?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("upload");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [pasted, setPasted] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const topicRef = useRef<HTMLInputElement>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const started = useRef(false);

  useEffect(() => {
    markFirstScreenShown();
    if (viewedTracked) return;
    viewedTracked = true;
    track("first_run.viewed");
  }, []);

  // Focus the field when switching to a typed option (not on first paint:
  // on a phone that would open the keyboard over the three options).
  const pickMode = (next: Mode) => {
    setMode(next);
    setError(null);
    requestAnimationFrame(() => {
      if (next === "topic") topicRef.current?.focus();
      if (next === "paste") pasteRef.current?.focus();
    });
  };

  /** Keeps a focused field above the on-screen keyboard. */
  const keepVisible = (e: React.FocusEvent<HTMLElement>) => {
    const el = e.currentTarget;
    setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
  };

  const subjectFor = async (title: string): Promise<string> => {
    try {
      const id = await createWorkspace(title);
      if (id) {
        emitTreeChanged();
        return id;
      }
    } catch (err) {
      if (!fallbackWorkspaceId) throw err;
    }
    if (fallbackWorkspaceId) return fallbackWorkspaceId;
    throw new Error(t("firstRun.errorStart"));
  };

  const openSession = async (
    workspaceId: string,
    title: string,
    option: FirstRunOption,
    extra: { topics?: string; examBoard?: ExamBoard } = {},
  ) => {
    setBusy("building");
    const session = await createStudySession({
      workspaceId,
      title,
      depth: "light",
      durationMinutes: 15,
      quickStart: true,
      ...extra,
    });
    track("first_run.session_requested", { option }, workspaceId);
    router.push(session ? `/workspace/${workspaceId}/session/${session.id}` : `/workspace/${workspaceId}`);
  };

  const run = async (option: FirstRunOption, work: () => Promise<void>, fallbackMessage: string) => {
    if (started.current) return;
    started.current = true;
    setError(null);
    track("first_run.option_chosen", { option });
    try {
      await work();
    } catch (err) {
      started.current = false;
      setBusy(null);
      setError(toastError(err, fallbackMessage));
    }
  };

  const startUpload = (files: File[], option: "upload" | "camera") => {
    if (files.length === 0) return;
    void run(
      option,
      async () => {
        setBusy("uploading");
        const title = uploadSubjectTitle(files.map((f) => f.name), t("firstRun.myNotes"));
        const sizeKb = Math.round(files.reduce((s, f) => s + f.size, 0) / 1024);
        const startedAt = Date.now();
        track("first_run.upload_started", { option, fileCount: files.length, sizeKb });
        const workspaceId = await subjectFor(title);
        let fileIds: string[];
        try {
          fileIds = await uploadFiles(workspaceId, files);
        } catch (err) {
          track("first_run.upload_failed", { option, durationMs: Date.now() - startedAt }, workspaceId);
          throw err;
        }
        track("first_run.upload_finished", { option, fileCount: files.length, sizeKb, durationMs: Date.now() - startedAt }, workspaceId);
        // Queues analysis; the Quick 5 starts once the first file is read.
        await analyzeFiles(workspaceId, fileIds);
        await openSession(workspaceId, title, option);
      },
      t("firstRun.errorUpload"),
    );
  };

  const startTopic = () => {
    const start = topicStart(topic);
    if (!start) {
      topicRef.current?.focus();
      return;
    }
    void run(
      "topic",
      async () => {
        setBusy("building");
        const workspaceId = await subjectFor(start.title);
        await openSession(workspaceId, start.title, "topic", {
          topics: start.topics,
          examBoard: start.examBoard,
        });
      },
      t("firstRun.errorStart"),
    );
  };

  const pastedLength = pasted.trim().length;
  const pasteReady = pastedLength >= PASTE_MIN_CHARS && pastedLength <= PASTE_MAX_CHARS;
  const startPaste = () => {
    if (!pasteReady) {
      pasteRef.current?.focus();
      return;
    }
    void run(
      "paste",
      async () => {
        setBusy("saving");
        const title = pastedSubjectTitle(pasted, t("firstRun.pastedNotes"));
        const workspaceId = await subjectFor(title);
        await addPastedText(workspaceId, pasted, title);
        await openSession(workspaceId, title, "paste");
      },
      t("firstRun.errorStart"),
    );
  };

  /** The course whose notes were offered on this screen, so picking a topic by hand instead counts as passing the offer over. */
  const offered = useRef<{ courseId: string; noteCount: number } | null>(null);
  const onNotesOffered = useCallback((courseId: string, noteCount: number) => {
    offered.current = { courseId, noteCount };
    track("first_run.notes_offered", { courseId, noteCount });
  }, []);

  /**
   * "Start with Scribe's notes": the course's subject is made with the first
   * unit's notes in it as material, then a Quick 5 starts on the first topic.
   * No upload, nothing to choose. If the notes cannot be attached
   * (an older server), the Quick 5 still starts as it always did.
   */
  const startWithNotes = (course: Course, level: CourseLevel | undefined, selection: NotesOfferSelection) => {
    void run(
      "curriculum",
      async () => {
        setBusy("building");
        const first = selection.topics[0];
        const { workspaceId } = await coursesApi.enroll(course.id, level);
        emitTreeChanged();
        const attached = await attachedNotesApi
          .attach(workspaceId, course.id, selection.topics.map((x) => x.id))
          .then((out) => out.attached.length)
          .catch(() => 0);
        track("first_run.notes_accepted", { courseId: course.id, noteCount: attached }, workspaceId);
        if (attached > 0) track("notes.attached", { from: "first_run", courseId: course.id, noteCount: attached }, workspaceId);
        const { sessionId } = await coursesApi.startTopic({ courseId: course.id, topicId: first.id, ...(level ? { level } : {}) });
        track("first_run.session_requested", { option: "curriculum" }, workspaceId);
        if (attached > 0) track("notes.attached_session_started", { from: "first_run", courseId: course.id, noteCount: attached }, workspaceId);
        router.push(`/workspace/${workspaceId}/session/${sessionId}`);
      },
      t("course.errorStart"),
    );
  };

  /** Course → unit → topic: the server reuses/creates the course's subject and starts a topic-mode Quick 5. */
  const startCourse = (course: Course, topic: CatalogTopic, level?: CourseLevel) => {
    if (offered.current?.courseId === course.id) track("first_run.notes_skipped", { courseId: course.id, noteCount: offered.current.noteCount });
    void run(
      "curriculum",
      async () => {
        setBusy("building");
        const { workspaceId, sessionId } = await coursesApi.startTopic({
          courseId: course.id,
          topicId: topic.id,
          ...(level ? { level } : {}),
        });
        emitTreeChanged();
        track("first_run.session_requested", { option: "curriculum" }, workspaceId);
        router.push(`/workspace/${workspaceId}/session/${sessionId}`);
      },
      t("course.errorStart"),
    );
  };

  const options: { id: Mode; label: string; hint: string; icon: typeof Upload }[] = [
    { id: "upload", label: t("firstRun.optUpload"), hint: t("firstRun.optUploadHint"), icon: Upload },
    { id: "topic", label: t("firstRun.optTopic"), hint: t("firstRun.optTopicHint"), icon: PenLine },
    { id: "paste", label: t("firstRun.optPaste"), hint: t("firstRun.optPasteHint"), icon: ClipboardPaste },
    { id: "course", label: t("course.optPick"), hint: t("course.optPickHint"), icon: GraduationCap },
  ];

  const primaryButton =
    "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[15px] font-semibold text-white transition-colors hover:bg-accent-dim disabled:opacity-50";

  return (
    <div className="flex min-h-full w-full flex-col items-center bg-white px-4 pb-10 pt-8 sm:justify-center sm:px-6 sm:py-12">
      <div className="w-full max-w-[520px] animate-fade-up">
        <Image
          src="/design/cat3-wave.webp"
          alt=""
          width={352}
          height={400}
          priority
          className="cat-wiggle mx-auto h-[72px] w-auto sm:h-20"
        />
        {firstName && (
          <p className="mt-3 text-center text-[13px] font-semibold text-accent">
            {t("firstRun.hi").replace("{name}", firstName)}
          </p>
        )}
        <h1 className={cn("text-center text-[26px] font-bold leading-tight tracking-tight sm:text-[28px]", firstName ? "mt-1" : "mt-3")}>
          {t("firstRun.title")}
        </h1>
        <p className="mx-auto mt-2 max-w-[440px] text-balance text-center text-[14.5px] leading-snug text-muted-foreground">
          {t("firstRun.subtitle")}
        </p>

        {busy ? (
          <div className="mt-10 flex flex-col items-center text-center" role="status" aria-live="polite">
            <Loader2 className="size-6 animate-spin text-accent" />
            <p className="mt-3 text-[15px] font-semibold">
              {t(busy === "uploading" ? "firstRun.uploading" : busy === "saving" ? "firstRun.saving" : "firstRun.building")}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">{t("firstRun.busyHint")}</p>
          </div>
        ) : (
          <>
            <div role="tablist" aria-label={t("firstRun.optionsLabel")} className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {options.map(({ id, label, hint, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`first-run-tab-${id}`}
                  aria-selected={mode === id}
                  aria-controls="first-run-panel"
                  onClick={() => pickMode(id)}
                  className={cn(
                    "flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2.5 text-center transition-colors",
                    mode === id
                      ? "border-accent bg-accent-soft/50 text-accent"
                      : "border-border text-foreground hover:border-border-strong",
                  )}
                >
                  <Icon className="size-5" />
                  <span className="text-[13.5px] font-semibold leading-tight">{label}</span>
                  <span className={cn("hidden text-[11.5px] leading-tight sm:block", mode === id ? "text-accent/80" : "text-faint")}>
                    {hint}
                  </span>
                </button>
              ))}
            </div>

            <div id="first-run-panel" role="tabpanel" aria-labelledby={`first-run-tab-${mode}`} className="mt-4">
              {mode === "upload" && (
                <>
                  {/* Phones: the camera is one tap away. */}
                  <button
                    type="button"
                    onClick={() => cameraRef.current?.click()}
                    className={cn(primaryButton, "sm:hidden")}
                  >
                    <Camera className="size-5" />
                    {t("firstRun.takePhoto")}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border text-[15px] font-semibold hover:border-border-strong sm:hidden"
                  >
                    <Upload className="size-4" />
                    {t("firstRun.chooseFile")}
                  </button>
                  {/* Larger screens: drop zone + file picker. */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      startUpload(Array.from(e.dataTransfer.files), "upload");
                    }}
                    className={cn(
                      "hidden flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors sm:flex",
                      dragging ? "border-accent bg-accent-soft/50" : "border-border",
                    )}
                  >
                    <button type="button" onClick={() => fileRef.current?.click()} className={cn(primaryButton, "w-auto")}>
                      <Upload className="size-4" />
                      {t("firstRun.chooseFiles")}
                    </button>
                    <p className="text-[13px] text-muted-foreground">
                      {dragging ? t("firstRun.dropActive") : t("firstRun.dropHint")}
                    </p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept={UPLOAD_ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      startUpload(Array.from(e.target.files ?? []), "upload");
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={cameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      startUpload(Array.from(e.target.files ?? []), "camera");
                      e.target.value = "";
                    }}
                  />
                </>
              )}

              {mode === "topic" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    startTopic();
                  }}
                >
                  <label htmlFor="first-run-topic" className="text-[13px] font-semibold">
                    {t("firstRun.topicLabel")}
                  </label>
                  <input
                    ref={topicRef}
                    id="first-run-topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onFocus={keepVisible}
                    maxLength={100}
                    autoComplete="off"
                    enterKeyHint="go"
                    placeholder={t("firstRun.topicPlaceholder")}
                    className="mt-1.5 h-12 w-full rounded-xl border border-border bg-card px-3.5 text-[16px] text-foreground placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                  />
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[12.5px] text-faint">{t("firstRun.examplesLabel")}</span>
                    {EXAMPLE_KEYS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setTopic(t(key));
                          topicRef.current?.focus();
                        }}
                        className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-[12.5px] font-semibold text-muted-foreground hover:border-border-strong hover:text-foreground"
                      >
                        {t(key)}
                      </button>
                    ))}
                  </div>
                  <button type="submit" disabled={!topicStart(topic)} className={cn(primaryButton, "mt-4")}>
                    {t("firstRun.start")}
                    <ArrowRight className="size-4" />
                  </button>
                </form>
              )}

              {mode === "course" && (
                <CoursePicker
                  onStart={startCourse}
                  unitTop={(course, level) => (
                    <NotesOffer
                      key={`${course.id}-${level ?? ""}`}
                      course={course}
                      level={level}
                      onOffered={(n) => onNotesOffered(course.id, n)}
                      onAccept={(selection) => startWithNotes(course, level, selection)}
                    />
                  )}
                />
              )}

              {mode === "paste" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    startPaste();
                  }}
                >
                  <label htmlFor="first-run-paste" className="text-[13px] font-semibold">
                    {t("firstRun.pasteLabel")}
                  </label>
                  <textarea
                    ref={pasteRef}
                    id="first-run-paste"
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    onFocus={keepVisible}
                    rows={6}
                    placeholder={t("firstRun.pastePlaceholder")}
                    className="mt-1.5 max-h-[40dvh] min-h-[132px] w-full resize-y rounded-xl border border-border bg-card px-3.5 py-3 text-[16px] leading-relaxed text-foreground placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
                  />
                  <p className="mt-1 min-h-[18px] text-[12.5px] text-faint" aria-live="polite">
                    {pastedLength > PASTE_MAX_CHARS
                      ? t("firstRun.pasteTooLong")
                      : pastedLength > 0 && pastedLength < PASTE_MIN_CHARS
                        ? t("firstRun.pasteMore").replace("{count}", String(PASTE_MIN_CHARS - pastedLength))
                        : ""}
                  </p>
                  <button type="submit" disabled={!pasteReady} className={cn(primaryButton, "mt-2")}>
                    {t("firstRun.start")}
                    <ArrowRight className="size-4" />
                  </button>
                </form>
              )}
            </div>

            {error && (
              <p role="alert" className="mt-3 text-center text-[13px] text-rose">
                {error}
              </p>
            )}

            <p className="mt-5 text-center text-[12.5px] text-faint">{t("firstRun.footnote")}</p>
            {onSkip && (
              <button
                type="button"
                onClick={() => {
                  track("first_run.option_chosen", { option: "skip" });
                  onSkip();
                }}
                className="mx-auto mt-2 flex min-h-11 items-center px-3 text-[13px] font-medium text-faint hover:text-foreground"
              >
                {t("firstRun.skip")}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
