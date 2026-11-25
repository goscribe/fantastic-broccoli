"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Camera, Upload } from "lucide-react";
import { createWorkspace, deleteWorkspace } from "@/lib/api/workspace";
import { addPastedText, analyzeFiles } from "@/lib/api/materials";
import { UploadStage, useReliableUpload } from "@/components/upload/reliable-upload";
import { isUploadCancelled } from "@/lib/upload-transfer";
import { createStudySessionQuietly } from "@/lib/api/study";
import { emitTreeChanged } from "@/lib/tree-events";
import { toastError } from "@/lib/toast";
import { UPLOAD_ACCEPT } from "@/lib/uploads";
import { cn } from "@/lib/utils";
import { WaitScreen } from "@/components/ui/wait-screen";
import { Mascot } from "@/components/rewards/mascot";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/first-run";
import "@/lib/i18n/courses";
import "@/app/design/design.css";
import { CoursePicker, loadCourse, loadCourses } from "@/components/courses/course-picker";
import { QuickCourses } from "@/components/onboarding/quick-courses";
import { startPickedTopics } from "@/components/courses/use-start-topic";
import { coursesApi, type CatalogTopic, type Course, type CourseLevel, type CourseSummary } from "@/lib/api/courses";
import { firstTopic, localBoardOrder } from "@/lib/courses";
import { markFirstScreenShown, track as trackFunnel, type FirstRunOption, type FunnelProps } from "@/lib/funnel";
import { NotesOffer, type NotesOfferSelection } from "@/components/onboarding/notes-offer";
import { attachedNotesApi } from "@/lib/api/notes";
import { getAttribution } from "@/lib/attribution";
import { hasAutoStarted, knownCourse, markAutoStarted, mayKnowCourse, readKnownCourseSignals, rememberAutoSession, type KnownCourse } from "@/lib/known-course";
import { askTopicsStartCheck } from "@/lib/start-check-client";
import {
  PASTE_MAX_CHARS,
  PASTE_MIN_CHARS,
  pastedSubjectTitle,
  topicStart,
  uploadSubjectTitle,
} from "@/lib/first-run";
import type { ExamBoard } from "@/types";
import { chooseStudyLength } from "@/lib/study-length-client";
import { useDaypart } from "@/lib/use-daypart";

/** "start" is the screen itself (the question, the search, the likely courses); the others open from its quiet links. */
type Mode = "start" | "course" | "upload" | "paste";
type Busy = "uploading" | "saving" | "building" | null;

/** One "viewed" per page load, however often the screen remounts. */
let viewedTracked = false;

/** The text links under the tiles: the other ways in, kept quiet. */
const quietLink =
  "flex min-h-11 items-center text-ui font-bold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground";

/**
 * First screen after signup, home for anyone without a subject, and "New
 * subject" later: "What are you studying?" Its one job is a first question,
 * fast. A search over courses and topics, and under it the few courses this
 * student most likely takes as tiles: tapping one starts 5 questions on that
 * course's first topic, with no level, unit or topic to choose first.
 * Anything typed that matches nothing starts on exactly that. The whole
 * catalog (units and topics picked by hand), upload (one-tap camera on
 * phones) and paste are quiet links under the tiles.
 *
 * When the app already knows the course (the note page they signed up from,
 * the topic they practised before signing up, the ad's keyword; see
 * lib/known-course) a brand-new student is not asked at all: its Quick 5 is
 * started and the wait screen offers "Not your course? Change".
 */
export function FirstRun({
  firstName,
  onSkip,
  fallbackWorkspaceId,
  context = "first_run",
  autoStart = false,
  initialMode = "start",
}: {
  firstName?: string;
  /** Offered only to learners who already have a subject to look around in. */
  onSkip?: () => void;
  /** An existing empty subject to use if a new one can't be created (e.g. the unverified one-subject limit). */
  fallbackWorkspaceId?: string;
  /** "new_subject": the same screen for adding a subject later; the first-run funnel events are not sent. */
  context?: "first_run" | "new_subject";
  /** A student with no subject at all: start the course the app already knows without asking (once per browser). */
  autoStart?: boolean;
  /** The view shown first ("paste" after an upload elsewhere didn't finish). */
  initialMode?: Mode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const daypart = useDaypart();
  const firstRun = context === "first_run";
  /** First-run funnel events only from the first run itself, so adding a subject later doesn't skew them. */
  const track = useCallback<typeof trackFunnel>(
    (event, props, workspaceId) => {
      if (firstRun || !event.startsWith("first_run.")) trackFunnel(event, props, workspaceId);
    },
    [firstRun],
  );
  const [mode, setMode] = useState<Mode>(initialMode);
  // Retries the storage PUT, resumes after the background, and shows "didn't finish — try again" instead of failing silently.
  const upload = useReliableUpload();
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [dragging, setDragging] = useState(false);
  /** The course tile whose Quick 5 is being started. */
  const [busyCourseId, setBusyCourseId] = useState<string | null>(null);
  /** What the wait screen names: the course and topic being started. */
  const [making, setMaking] = useState<string | null>(null);
  /** Courses the app knows something about, shown first among the tiles. */
  const [lead, setLead] = useState<string[]>([]);
  /** The known course's Quick 5 is being started without asking. */
  const [auto, setAuto] = useState(false);
  // Something in this browser may name the course: the screen waits for the catalog instead of drawing a choice it is about to skip.
  const [resolving, setResolving] = useState(() => firstRun && autoStart && !hasAutoStarted() && mayKnowCourse(readKnownCourseSignals(getAttribution())));
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const started = useRef(false);
  /** "Change" was tapped while the known course's session was being made. */
  const autoCancelled = useRef(false);
  const autoWork = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!firstRun) return;
    markFirstScreenShown();
    if (viewedTracked) return;
    viewedTracked = true;
    trackFunnel("first_run.viewed");
  }, [firstRun]);

  // Focus the field when switching to a typed option (not on first paint:
  // on a phone that would open the keyboard over the tiles).
  const pickMode = (next: Mode) => {
    setMode(next);
    setError(null);
    requestAnimationFrame(() => {
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
    // First session: ask how long first (a long answer makes it a full plan).
    const input = await chooseStudyLength({
      workspaceId,
      title,
      depth: "light" as const,
      durationMinutes: 15,
      quickStart: true,
      ...extra,
    });
    setBusy("building");
    const session = await createStudySessionQuietly(input);
    track("first_run.session_requested", { option }, workspaceId);
    router.push(session ? `/workspace/${workspaceId}/session/${session.id}` : `/workspace/${workspaceId}`);
  };

  const reset = () => {
    started.current = false;
    setBusy(null);
    setBusyCourseId(null);
    setMaking(null);
    setAuto(false);
  };

  const run = async (option: FirstRunOption, work: () => Promise<void>, fallbackMessage: string, props: FunnelProps = {}) => {
    // A start made without asking that the student cancelled ("Change") is still finishing: wait for it, then carry on.
    if (started.current && !(autoCancelled.current && autoWork.current)) return;
    if (autoWork.current) await autoWork.current;
    if (started.current) return;
    started.current = true;
    setError(null);
    track("first_run.option_chosen", { option, ...props });
    try {
      await work();
    } catch (err) {
      reset();
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
          // Resolves once every file is in, including after "Try again" on the failure screen.
          fileIds = await upload.run(workspaceId, files);
        } catch (err) {
          track("first_run.upload_failed", { option, durationMs: Date.now() - startedAt }, workspaceId);
          if (isUploadCancelled(err)) {
            // "Paste text instead": back to the screen, on the paste box.
            reset();
            pickMode("paste");
            return;
          }
          throw err;
        }
        track("first_run.upload_finished", { option, fileCount: files.length, sizeKb, durationMs: Date.now() - startedAt }, workspaceId);
        // Queues analysis; the Quick 5 starts once the first file is read.
        await analyzeFiles(workspaceId, fileIds).catch((err: unknown) => {
          trackFunnel("upload.failed", { stage: "analyze", fileCount: fileIds.length }, workspaceId);
          throw err;
        });
        await openSession(workspaceId, title, option);
      },
      t("firstRun.errorUpload"),
    );
  };

  /** Typed text that matches no course or topic: a subject and 5 questions on exactly that. */
  const startTopic = (text: string) => {
    const start = topicStart(text);
    if (!start) return;
    void run(
      "topic",
      async () => {
        setBusy("building");
        setMaking(start.title);
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
  }, [track]);

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
        setMaking(`${course.title} · ${topic.name}`);
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

  /**
   * A course tile was tapped: 5 questions on its first topic, at once. The
   * funnel records which course (`courseId`) and how long the start took; the
   * session's own `quick5.started` then carries the time since this screen
   * was first shown, which is the time to the first question.
   *
   * The very first session is never held up by "How confident are you?"
   * (as on every first-run path); adding a subject later asks it as usual.
   */
  const startLikely = (summary: CourseSummary) => {
    void run(
      "curriculum",
      async () => {
        const tappedAt = Date.now();
        setBusyCourseId(summary.id);
        const course = await loadCourse(summary.id);
        const first = firstTopic(course);
        if (!first) throw new Error(t("course.errorStart"));
        const startCheck = firstRun ? undefined : await askTopicsStartCheck({ courseId: course.id, topics: [{ id: first.topic.id, name: first.topic.name }] });
        setBusy("building");
        setMaking(`${course.title} · ${first.topic.name}`);
        const { workspaceId, sessionId } = await coursesApi.startTopic({ courseId: course.id, topicId: first.topic.id, ...(startCheck ? { startCheck } : {}) });
        emitTreeChanged();
        track("first_run.session_requested", { option: "curriculum", courseId: course.id, durationMs: Date.now() - tappedAt }, workspaceId);
        router.push(`/workspace/${workspaceId}/session/${sessionId}`);
      },
      t("course.errorStart"),
      { courseId: summary.id },
    );
  };

  /**
   * The app already knows the course: its Quick 5 is started without a tap,
   * on the topic they were on when there is one, else the course's first.
   * "Change" on the wait screen stops it: a subject made in the meantime is
   * removed again (they never chose it) and the choice is shown.
   */
  const startKnown = (known: KnownCourse, summary: CourseSummary) => {
    markAutoStarted();
    setAuto(true);
    setBusy("building");
    setMaking(summary.title);
    const work = run(
      "curriculum",
      async () => {
        const at = Date.now();
        const course = await loadCourse(summary.id);
        const named = course.units.flatMap((u) => u.topics).find((x) => x.id === known.topicId && !x.locked);
        const topic = named ?? firstTopic(course)?.topic;
        if (!topic) throw new Error(t("course.errorStart"));
        if (autoCancelled.current) return reset();
        setMaking(`${course.title} · ${topic.name}`);
        const level = course.levels?.length && topic.hlOnly ? ("HL" as const) : undefined;
        const { workspaceId, sessionId } = await coursesApi.startTopic({ courseId: course.id, topicId: topic.id, ...(level ? { level } : {}) });
        if (autoCancelled.current) {
          await deleteWorkspace(workspaceId).catch(() => {});
          emitTreeChanged();
          return reset();
        }
        emitTreeChanged();
        rememberAutoSession(workspaceId, sessionId);
        track("first_run.session_requested", { option: "curriculum", courseId: course.id, durationMs: Date.now() - at }, workspaceId);
        router.push(`/workspace/${workspaceId}/session/${sessionId}`);
      },
      t("course.errorStart"),
      { courseId: summary.id },
    );
    autoWork.current = work.finally(() => {
      autoWork.current = null;
    });
  };

  const changeCourse = () => {
    autoCancelled.current = true;
    setAuto(false);
    setBusy(null);
    setMaking(null);
  };

  // What this browser already says about the course: it leads the tiles, and for a brand-new student it starts.
  const resolved = useRef(false);
  useEffect(() => {
    if (!firstRun || resolved.current) return;
    resolved.current = true;
    const signals = readKnownCourseSignals(getAttribution());
    if (!mayKnowCourse(signals)) return;
    void loadCourses()
      .then((list) => {
        const { known, lead: ids } = knownCourse(signals, list, localBoardOrder());
        setLead(ids);
        const summary = known && list.find((c) => c.id === known.courseId);
        if (known && summary && autoStart && !hasAutoStarted()) startKnown(known, summary);
      })
      .catch(() => {})
      .finally(() => setResolving(false));
    // Runs once: the signals are read when the screen first shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Several units or topics ticked in the picker: the course's subject is added and one session starts over all of them. */
  const startCourseTopics = (course: Course, topics: CatalogTopic[], level?: CourseLevel) => {
    if (topics.length === 0) return;
    if (offered.current?.courseId === course.id) track("first_run.notes_skipped", { courseId: course.id, noteCount: offered.current.noteCount });
    void run(
      "curriculum",
      async () => {
        // "How long?" is asked (a learner's first sessions) while the picker is still on screen.
        const { workspaceId, sessionId } = await startPickedTopics({ courseId: course.id, topicIds: topics.map((x) => x.id), level }, () => setBusy("building"));
        emitTreeChanged();
        track("first_run.session_requested", { option: "curriculum" }, workspaceId);
        router.push(`/workspace/${workspaceId}/session/${sessionId}`);
      },
      t("course.errorStart"),
    );
  };

  const primaryButton =
    "btn-chunky inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[16px] bg-accent px-5 text-[16px] font-extrabold text-white hover:bg-accent-dim disabled:opacity-50";

  const waiting = busy !== null;
  const subTitle = mode === "course" ? t("course.pageTitle") : mode === "upload" ? t("firstRun.optUpload") : t("firstRun.optPaste");

  return (
    <div className="flex min-h-full w-full shrink-0 flex-col items-center bg-white px-4 pb-10 pt-2 sm:px-6 sm:pt-4">
      <div className="w-full max-w-[720px] animate-fade-up">
        {resolving && !waiting && <div className="min-h-[50dvh]" aria-busy="true" />}
        {busy === "uploading" && (
          <UploadStage
            upload={upload}
            title={t("firstRun.waitTitle")}
            fallbackStatus={t("firstRun.uploading")}
            time={t("firstRun.busyHint")}
            onPaste={upload.giveUp}
          />
        )}
        {waiting && busy !== "uploading" && (
          <WaitScreen
            title={t("firstRun.waitTitle")}
            status={busy === "building" && making ? making : t(busy === "saving" ? "firstRun.saving" : "firstRun.building")}
            time={t("firstRun.busyHint")}
          >
            {auto && (
              <button type="button" onClick={changeCourse} className={cn(quietLink, "mt-4")}>
                {t("firstRun.changeCourse")}
              </button>
            )}
          </WaitScreen>
        )}
        {/* Kept mounted while a session is made, so a start that fails comes back to the same course and picks. */}
        <div className={waiting || resolving ? "hidden" : undefined}>
          {mode === "start" ? (
            <>
              {/* The scene for the student's time of day, compact, with the cat: picture only, the words sit under it on white. */}
              <div aria-hidden className="hero-card relative isolate h-[var(--banner-band)] overflow-hidden rounded-[var(--r-panel)] border border-border">
                <div className="hero-field absolute inset-0 -z-10" />
                <div className="absolute right-[7%] top-[18px] h-[86px]">
                  <span className="hero-field__ground" />
                  <Mascot pose={daypart === "late" ? "sleep" : "wave"} className={cn("h-full", daypart !== "late" && "cat-wiggle")} priority />
                </div>
              </div>
              {firstName && <p className="mt-5 text-small font-semibold text-muted-foreground">{t("firstRun.hi").replace("{name}", firstName)}</p>}
              <h1 className={cn("text-[26px] font-extrabold leading-tight tracking-tight sm:text-[30px]", firstName ? "mt-0.5" : "mt-5")}>
                {firstRun ? t("firstRun.title") : t("firstRun.newTitle")}
              </h1>
              <p className="mt-1.5 text-ui text-muted-foreground">{firstRun ? t("firstRun.lead") : t("firstRun.newLead")}</p>
              <div className="mt-4">
                <QuickCourses
                  lead={lead}
                  busyCourseId={busyCourseId}
                  onStartCourse={startLikely}
                  onStartTopic={startCourse}
                  onFreeTopic={startTopic}
                  onAllCourses={(count) => (
                    <div className="mt-3 flex flex-wrap items-center gap-x-6">
                      <button type="button" onClick={() => pickMode("course")} className={quietLink}>
                        {count ? t("firstRun.allCourses").replace("{count}", String(count)) : t("firstRun.allCoursesPlain")}
                      </button>
                      <button type="button" onClick={() => pickMode("upload")} className={quietLink}>
                        {t("firstRun.optUpload")}
                      </button>
                      <button type="button" onClick={() => pickMode("paste")} className={quietLink}>
                        {t("firstRun.optPaste")}
                      </button>
                    </div>
                  )}
                />
              </div>
            </>
          ) : (
            <div className="mx-auto w-full max-w-[560px]">
              <button
                type="button"
                onClick={() => pickMode("start")}
                className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-ui font-bold text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                {t("firstRun.back")}
              </button>
              <h1 className="mt-1 text-[24px] font-extrabold leading-tight tracking-tight sm:text-[26px]">{subTitle}</h1>
              <div className="mt-4">
                {mode === "upload" && (
                  <>
                    {/* Phones: the camera is one tap away. */}
                    <button type="button" onClick={() => cameraRef.current?.click()} className={cn(primaryButton, "sm:hidden")}>
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
                      <p className="text-[13px] text-muted-foreground">{dragging ? t("firstRun.dropActive") : t("firstRun.dropHint")}</p>
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

                {mode === "course" && (
                  <CoursePicker
                    onStart={startCourse}
                    onStartTopics={startCourseTopics}
                    onFreeTopic={startTopic}
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
            </div>
          )}

          <div className={cn(mode !== "start" && "mx-auto w-full max-w-[560px]")}>
            {error && (
              <p role="alert" className="mt-3 text-small text-rose">
                {error}
              </p>
            )}
            <p className="mt-3 text-caption text-muted-foreground">{t("firstRun.footnote")}</p>
            {onSkip && (
              <button
                type="button"
                onClick={() => {
                  track("first_run.option_chosen", { option: "skip" });
                  onSkip();
                }}
                className="mt-1 flex min-h-11 items-center text-small font-semibold text-muted-foreground hover:text-foreground"
              >
                {firstRun ? t("firstRun.skip") : t("firstRun.backHome")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
