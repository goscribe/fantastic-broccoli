"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createFolder, createWorkspace } from "@/lib/api/workspace";
import { createStudySession } from "@/lib/api/study";
import { emitTreeChanged } from "@/lib/tree-events";
import { toast, toastError } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, FilePlus2, GraduationCap, X } from "lucide-react";
import {
  CURRICULUM_PRESETS,
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
 * Dropdown for a "New workspace" trigger: Empty vs Curated, each with a
 * one-line explanation. The trigger is supplied as `children` of the
 * render-prop so callers keep their own button styling.
 */
export function NewWorkspaceMenu({
  onSelect,
  children,
}: {
  onSelect: (mode: "empty" | "curated") => void;
  children: (toggle: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const pick = (mode: "empty" | "curated") => {
    setOpen(false);
    onSelect(mode);
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
          <div className="absolute left-0 z-50 mt-2 w-72 rounded-xl border border-border bg-card p-1.5 shadow-lg">
            <button
              type="button"
              onClick={() => pick("empty")}
              className="flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left hover:bg-muted"
            >
              <FilePlus2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                <span className="block text-[13px] font-semibold text-foreground">
                  Empty workspace
                </span>
                <span className="block text-xs text-muted-foreground">
                  Start blank and add your own materials.
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => pick("curated")}
              className="flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left hover:bg-muted"
            >
              <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                <span className="block text-[13px] font-semibold text-foreground">
                  Curated
                </span>
                <span className="block text-xs text-muted-foreground">
                  Pick a curriculum &amp; subject — Scribe builds a starter
                  study session.
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
  const [mode, setMode] = useState<WorkspaceMode>(
    kind === "workspace" ? (initialMode ?? "choose") : "empty",
  );
  const [curriculum, setCurriculum] = useState<CurriculumPreset | null>(null);
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

  // Curated path: workspace + a starter session generated from the
  // subject + exam board alone, then straight into that session.
  const startCurated = async (chosen: CurriculumPreset, subject: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const title = `${chosen.label} ${subject}`;
      const workspaceId = await createWorkspace(title, parentId);
      if (!workspaceId) throw new Error("Could not create a workspace");
      emitTreeChanged();
      const session = await createStudySession({
        workspaceId,
        title,
        depth: "moderate",
        durationMinutes: 30,
        subject,
        examBoard: chosen.board,
      });
      toast.success("Workspace created");
      onClose();
      if (session) {
        router.push(`/workspace/${workspaceId}/session/${session.id}`);
      } else {
        router.push(`/workspace/${workspaceId}`);
      }
    } catch (err) {
      setError(toastError(err, "Creation failed"));
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
      toast.success(kind === "folder" ? "Folder created" : "Workspace created");
      onClose();
    } catch (err) {
      setError(toastError(err, "Creation failed"));
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
                aria-label="Back"
                onClick={() =>
                  curriculum ? setCurriculum(null) : setMode("choose")
                }
                className="rounded p-1 text-faint hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="text-sm font-semibold">
              {kind === "folder"
                ? "New folder"
                : mode === "curated"
                  ? curriculum
                    ? `${curriculum.label} — pick a subject`
                    : "Pick a curriculum"
                  : "New workspace"}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
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
                  Empty workspace
                </span>
                <span className="block text-xs text-muted-foreground">
                  Start blank and add your own materials.
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
                <span className="block text-sm font-semibold">Curated</span>
                <span className="block text-xs text-muted-foreground">
                  Pick a curriculum &amp; subject — Scribe builds a starter
                  study session for you.
                </span>
              </span>
            </button>
          </div>
        )}
        {kind === "workspace" && mode === "curated" && (
          <div className="mt-4">
            {busy ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Creating your workspace…
              </p>
            ) : !curriculum ? (
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
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {curriculum.subjects.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => startCurated(curriculum, subject)}
                    className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium hover:border-accent hover:bg-accent-soft/40 transition-colors"
                  >
                    {subject}
                  </button>
                ))}
              </div>
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
            placeholder={kind === "folder" ? "e.g. Sciences" : "e.g. Chemistry HL"}
            className="h-10 w-full rounded-lg border border-border bg-card px-3.5 text-sm placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
          />
          {kind === "workspace" && (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
            />
          )}
          {kind === "workspace" && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Icon
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
                  aria-label={`Colour ${c}`}
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
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy || !name.trim()}>
              {busy ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
