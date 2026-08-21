"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createFolder, createWorkspace } from "@/lib/api/workspace";
import { createStudySession } from "@/lib/api/study";
import { emitTreeChanged } from "@/lib/tree-events";
import { toast, toastError } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/workspace";
import "@/lib/i18n/misc";
import { UPLOAD_ACCEPT } from "@/lib/uploads";
import { startWorkspaceFromUploads } from "@/lib/start-from-uploads";
import {
  ArrowLeft,
  Check,
  FilePlus2,
  GraduationCap,
  MessageCircle,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  CURRICULUM_PRESETS,
  unitsFor,
  type CurriculumPreset,
} from "@/components/onboarding/curriculum-presets";
import {
  WorkspaceIcon,
  WORKSPACE_ICONS,
} from "@/components/graphics/workspace-icon";

const folderColors = [
  "#6fd420",
  "#38bdf8",
  "#f59e0b",
  "#f472b6",
  "#a78bfa",
  "#f87171",
  "#94a3b8",
];

/**
 * Dropdown for a "New workspace" trigger: upload notes (names a workspace
 * from the files and starts a session), create empty/curated, or chat with
 * the study bot. The trigger is supplied as `children` of the render-prop so
 * callers keep their own button styling. `align` controls which edge the
 * panel hugs so it never overflows the viewport horizontally.
 */
export function NewWorkspaceMenu({
  onSelect,
  align = "left",
  children,
}: {
  onSelect: (choice: "workspace" | "bot") => void;
  align?: "left" | "right";
  children: (toggle: () => void) => React.ReactNode;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (choice: "workspace" | "bot") => {
    setOpen(false);
    onSelect(choice);
  };

  const startFromFiles = async (files: File[]) => {
    if (files.length === 0 || uploading) return;
    setUploading(true);
    try {
      const { workspaceId, session } = await startWorkspaceFromUploads(files);
      if (session) {
        router.push(`/workspace/${workspaceId}/session/${session.id}`);
      } else {
        router.push(`/workspace/${workspaceId}`);
      }
    } catch (err) {
      toastError(err, t("misc.couldNotStartSession"));
      setUploading(false);
    }
  };

  return (
    <div className="relative inline-block">
      {children(() => setOpen((v) => !v))}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              "absolute z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-1.5 shadow-lg",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={UPLOAD_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                setOpen(false);
                void startFromFiles(files);
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left hover:bg-muted disabled:opacity-60"
            >
              <Upload className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-foreground">
                  {uploading
                    ? t("misc.buildingFromFiles")
                    : t("misc.uploadNotes")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("misc.uploadNotesHint")}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => pick("workspace")}
              className="flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left hover:bg-muted"
            >
              <FilePlus2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-foreground">
                  {t("ws.createWorkspace")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("ws.createWorkspaceHint")}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => pick("bot")}
              className="flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left hover:bg-muted"
            >
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-foreground">
                  {t("ws.chatStudyBot")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("ws.chatStudyBotHint")}
                </span>
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface CreateResourceDialogProps {
  kind: "folder" | "workspace";
  parentId?: string;
  /** Skip the empty/curated chooser and land on this mode directly. */
  initialMode?: "empty" | "curated";
  onClose: () => void;
  /** Called after creation; receives the new workspace id when applicable. */
  onCreated: (workspaceId?: string) => void;
}

type WorkspaceMode = "choose" | "empty" | "curated";

export function CreateResourceDialog({
  kind,
  parentId,
  initialMode,
  onClose,
  onCreated,
}: CreateResourceDialogProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [mode, setMode] = useState<WorkspaceMode>(
    kind === "workspace" ? (initialMode ?? "choose") : "empty",
  );
  const [curriculum, setCurriculum] = useState<CurriculumPreset | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [units, setUnits] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(WORKSPACE_ICONS[0].key);
  const [color, setColor] = useState(folderColors[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode === "empty") inputRef.current?.focus();
  }, [mode]);

  // Curated path: workspace + a starter session generated from the exam
  // board + subject + chosen units, then straight into that session.
  const startCurated = async (
    chosen: CurriculumPreset,
    chosenSubject: string,
    chosenUnits: string[],
  ) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const title = `${chosen.label} ${chosenSubject}`;
      const workspaceId = await createWorkspace(title, parentId);
      if (!workspaceId) throw new Error("Could not create a workspace");
      emitTreeChanged();
      const session = await createStudySession({
        workspaceId,
        title:
          chosenUnits.length > 0
            ? `${title}: ${chosenUnits.slice(0, 2).join(", ")}${chosenUnits.length > 2 ? "…" : ""}`
            : title,
        depth: "moderate",
        durationMinutes: 30,
        subject: chosenSubject,
        topics: chosenUnits.join(", ").slice(0, 2000) || undefined,
        examBoard: chosen.board,
      });
      toast.success(t("ws.workspaceCreated"));
      onClose();
      if (session) {
        router.push(`/workspace/${workspaceId}/session/${session.id}`);
      } else {
        router.push(`/workspace/${workspaceId}`);
      }
    } catch (err) {
      setError(toastError(err, t("ws.creationFailed")));
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "folder") {
        await createFolder(name.trim(), parentId, color);
        emitTreeChanged();
        onCreated();
      } else {
        const id = await createWorkspace(name.trim(), parentId, {
          description: description.trim() || undefined,
          icon,
        });
        emitTreeChanged();
        onCreated(id);
      }
      toast.success(
        kind === "folder" ? t("ws.folderCreated") : t("ws.workspaceCreated"),
      );
      onClose();
    } catch (err) {
      setError(toastError(err, t("ws.creationFailed")));
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {kind === "workspace" && mode === "curated" && (
              <button
                type="button"
                aria-label={t("ws.back")}
                onClick={() => {
                  if (subject) {
                    setSubject(null);
                    setUnits([]);
                  } else if (curriculum) {
                    setCurriculum(null);
                  } else {
                    setMode("choose");
                  }
                }}
                className="rounded p-1 text-faint hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="text-sm font-semibold">
              {kind === "folder"
                ? t("ws.newFolder")
                : mode === "curated"
                  ? subject && curriculum
                    ? `${curriculum.label} ${subject}`
                    : curriculum
                      ? t("ws.pickSubject").replace(
                          "{curriculum}",
                          curriculum.label,
                        )
                      : t("ws.pickCurriculum")
                  : t("ws.newWorkspace")}
            </h2>
          </div>
          <button
            type="button"
            aria-label={t("ws.close")}
            onClick={onClose}
            className="rounded p-1 text-faint hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {kind === "workspace" && mode === "choose" && (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => setMode("empty")}
              className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3.5 text-left hover:border-accent hover:bg-accent-soft/40 transition-colors"
            >
              <FilePlus2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <span>
                <span className="block text-sm font-semibold">
                  {t("ws.emptyWorkspace")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("ws.emptyWorkspaceHint")}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode("curated")}
              className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3.5 text-left hover:border-accent hover:bg-accent-soft/40 transition-colors"
            >
              <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <span>
                <span className="block text-sm font-semibold">
                  {t("ws.curated")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("ws.curatedHint")}
                </span>
              </span>
            </button>
          </div>
        )}
        {kind === "workspace" && mode === "curated" && (
          <div className="mt-4">
            {busy ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Sparkles className="h-5 w-5 animate-pulse text-accent" />
                <p className="text-sm font-medium">
                  {t("ws.buildingSession")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("ws.buildingSessionHint")}
                </p>
              </div>
            ) : !curriculum ? (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t("ws.whichExam")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {CURRICULUM_PRESETS.map((p) => (
                    <button
                      key={p.board}
                      type="button"
                      onClick={() => setCurriculum(p)}
                      className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent hover:bg-accent-soft/40 transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </>
            ) : !subject ? (
              <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
                {curriculum.subjects.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      if (unitsFor(curriculum.board, s).length > 0) {
                        setSubject(s);
                        setUnits([]);
                      } else {
                        void startCurated(curriculum, s, []);
                      }
                    }}
                    className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium hover:border-accent hover:bg-accent-soft/40 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t("ws.pickUnits")}
                </p>
                <div className="max-h-64 space-y-1.5 overflow-y-auto">
                  {unitsFor(curriculum.board, subject).map((unit) => {
                    const selected = units.includes(unit);
                    return (
                      <button
                        key={unit}
                        type="button"
                        onClick={() =>
                          setUnits((prev) =>
                            selected
                              ? prev.filter((u) => u !== unit)
                              : [...prev, unit],
                          )
                        }
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                          selected
                            ? "border-accent bg-accent-soft/40"
                            : "border-border bg-card hover:border-accent/50",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-md border",
                            selected
                              ? "border-accent bg-accent text-white"
                              : "border-border",
                          )}
                        >
                          {selected && <Check className="h-3 w-3" />}
                        </span>
                        {unit}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => void startCurated(curriculum, subject, [])}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {t("ws.coverEverything")}
                  </button>
                  <Button
                    size="sm"
                    disabled={units.length === 0}
                    onClick={() => void startCurated(curriculum, subject, units)}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    {t("ws.generateSessionTokens")}
                  </Button>
                </div>
              </>
            )}
            {error && <p className="mt-2 text-xs text-rose">{error}</p>}
          </div>
        )}
        {(kind === "folder" || mode === "empty") && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              kind === "folder"
                ? t("ws.folderNamePlaceholder")
                : t("ws.workspaceNamePlaceholder")
            }
            className="h-10 w-full rounded-lg border border-border bg-card px-3.5 text-sm placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
          />
          {kind === "workspace" && (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("ws.descriptionPlaceholder")}
              rows={2}
              className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
            />
          )}
          {kind === "workspace" && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                {t("ws.icon")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {WORKSPACE_ICONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    aria-label={opt.label}
                    title={opt.label}
                    onClick={() => setIcon(opt.key)}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-transform",
                      icon === opt.key
                        ? "border-accent scale-105 bg-muted"
                        : "border-border hover:scale-105",
                    )}
                  >
                    <WorkspaceIcon icon={opt.key} className="h-6 w-6" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {kind === "folder" && (
            <div className="flex gap-1.5">
              {folderColors.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`${t("ws.colour")} ${c}`}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform",
                    color === c
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
          {error && <p className="text-xs text-rose">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              {t("ws.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={busy || !name.trim()}>
              {busy ? t("ws.creating") : t("ws.create")}
            </Button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
