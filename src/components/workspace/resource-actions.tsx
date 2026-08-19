"use client";

import { useEffect, useRef, useState } from "react";
import {
  deleteFolder,
  deleteWorkspace,
  updateFolder,
  updateWorkspace,
} from "@/lib/api/workspace";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/workspace";
import { toast, toastError } from "@/lib/toast";
import { emitTreeChanged } from "@/lib/tree-events";
import { MoreHorizontal, Pencil, Trash2, Users, X } from "lucide-react";
import { WorkspaceIcon, WORKSPACE_ICONS } from "@/components/graphics/workspace-icon";

export interface ResourceActions {
  onRename: () => void;
  onDelete: () => void;
  onMembers?: () => void;
}

export function ResourceActionsMenu({
  actions,
  className,
}: {
  actions: ResourceActions;
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const items = [
    { label: t("ws.rename"), icon: Pencil, onSelect: actions.onRename },
    ...(actions.onMembers
      ? [{ label: t("ws.members"), icon: Users, onSelect: actions.onMembers }]
      : []),
    {
      label: t("ws.delete"),
      icon: Trash2,
      onSelect: actions.onDelete,
      danger: true,
    },
  ];

  return (
    <div
      ref={ref}
      className={cn("relative", className)}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label={t("ws.moreActions")}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground",
          "hover:bg-muted hover:text-foreground transition-colors",
          open && "bg-muted text-foreground",
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-border bg-card p-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium",
                item.danger
                  ? "text-rose hover:bg-rose/10"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const folderColors = [
  "#6fd420",
  "#38bdf8",
  "#f59e0b",
  "#f472b6",
  "#a78bfa",
  "#f87171",
  "#94a3b8",
];

export type EditTarget =
  | {
      kind: "workspace";
      id: string;
      name: string;
      description?: string;
      icon?: string;
    }
  | { kind: "folder"; id: string; name: string; color?: string };

export function EditResourceDialog({
  target,
  onClose,
  onSaved,
}: {
  target: EditTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(target.name);
  const [description, setDescription] = useState(
    target.kind === "workspace" ? (target.description ?? "") : "",
  );
  const [color, setColor] = useState(
    target.kind === "folder" ? (target.color ?? folderColors[0]) : folderColors[0],
  );
  const [icon, setIcon] = useState(
    target.kind === "workspace"
      ? (target.icon ?? WORKSPACE_ICONS[0].key)
      : WORKSPACE_ICONS[0].key,
  );
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
      if (target.kind === "workspace") {
        await updateWorkspace(target.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          icon,
        });
      } else {
        await updateFolder(target.id, { name: name.trim(), color });
      }
      toast.success(t("ws.changesSaved"));
      emitTreeChanged();
      onSaved();
      onClose();
    } catch (err) {
      setError(toastError(err, t("ws.updateFailed")));
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
            {target.kind === "folder"
              ? t("ws.editFolder")
              : t("ws.editWorkspace")}
          </h2>
          <button
            type="button"
            aria-label={t("ws.close")}
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
            placeholder={t("ws.namePlaceholder")}
            className="h-10 w-full rounded-lg border border-border bg-card px-3.5 text-sm placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
          />
          {target.kind === "workspace" && (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("ws.descriptionPlaceholder")}
              rows={3}
              className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
            />
          )}
          {target.kind === "workspace" && (
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
          {target.kind === "folder" && (
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
              {busy ? t("ws.saving") : t("ws.save")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export type DeleteTarget = {
  kind: "workspace" | "folder";
  id: string;
  name: string;
};

export function DeleteResourceDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: DeleteTarget;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      if (target.kind === "workspace") await deleteWorkspace(target.id);
      else await deleteFolder(target.id);
      toast.success(t("ws.deleted"));
      emitTreeChanged();
      onDeleted();
      onClose();
    } catch (err) {
      setError(toastError(err, t("ws.deleteFailed")));
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
        <h2 className="text-sm font-semibold">
          {target.kind === "folder"
            ? t("ws.deleteFolderQ")
            : t("ws.deleteWorkspaceQ")}
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("ws.deleteWarning").replace("{name}", target.name)}
        </p>
        {error && <p className="mt-2 text-xs text-rose">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t("ws.cancel")}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={busy}
            onClick={() => void confirmDelete()}
          >
            {busy ? t("ws.deleting") : t("ws.delete")}
          </Button>
        </div>
      </div>
    </div>
  );
}
