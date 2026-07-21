"use client";

import { useEffect, useRef, useState } from "react";
import { createFolder, createWorkspace } from "@/lib/api/workspace";
import { emitTreeChanged } from "@/lib/tree-events";
import { toast, toastError } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
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

interface CreateResourceDialogProps {
  kind: "folder" | "workspace";
  parentId?: string;
  onClose: () => void;
  /** Called after creation; receives the new workspace id when applicable. */
  onCreated: (workspaceId?: string) => void;
}

export function CreateResourceDialog({
  kind,
  parentId,
  onClose,
  onCreated,
}: CreateResourceDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(WORKSPACE_ICONS[0].key);
  const [color, setColor] = useState(folderColors[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
          <h2 className="text-sm font-semibold">
            New {kind === "folder" ? "folder" : "workspace"}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded p-1 text-faint hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
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
      </div>
    </div>
  );
}
