"use client";

import Image from "next/image";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import type { Folder } from "@/types";
import { accentNameForColor } from "@/lib/accent-palette";
import { FolderCard } from "@/components/workspace/folder-card";
import { WorkspaceCard } from "@/components/workspace/workspace-card";
import { CreateResourceDialog } from "@/components/workspace/create-dialog";
import { onTreeChanged } from "@/lib/tree-events";
import {
  DeleteResourceDialog,
  EditResourceDialog,
  ResourceActionsMenu,
  type DeleteTarget,
  type EditTarget,
} from "@/components/workspace/resource-actions";
import { WorkspaceMembersDialog } from "@/components/workspace/workspace-members-dialog";
import { ChevronRight, Plus } from "lucide-react";
import { CardGridSkeleton, Skeleton } from "@/components/ui/skeleton";

function findFolderPath(folders: Folder[], id: string): Folder[] | null {
  for (const folder of folders) {
    if (folder.id === id) return [folder];
    const sub = findFolderPath(folder.folders ?? [], id);
    if (sub) return [folder, ...sub];
  }
  return null;
}

export default function FolderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [path, setPath] = useState<Folder[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState<"folder" | "workspace" | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const [membersFor, setMembersFor] = useState<string | null>(null);

  const loadTree = () =>
    fetchWorkspaceTree()
      .then((tree) => setPath(findFolderPath(tree.folders, id)))
      .catch(() => {})
      .finally(() => setLoaded(true));

  useEffect(() => {
    loadTree();
    return onTreeChanged(loadTree);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const folder = path?.[path.length - 1];

  if (!folder || !path) {
    if (!loaded) {
      return (
        <div className="flex-1 flex flex-col">
          <main className="flex-1 w-full px-4 sm:px-8 py-6 sm:py-8 space-y-8">
            <Skeleton className="h-4 w-48" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-7 w-56" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <CardGridSkeleton count={6} />
            </div>
          </main>
        </div>
      );
    }
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">Folder not found.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <main className="flex-1 w-full px-4 sm:px-8 py-6 sm:py-8 space-y-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm animate-fade-up">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground"
          >
            Home
          </Link>
          {path.map((f, i) => (
            <span key={f.id} className="flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 text-faint" />
              {i < path.length - 1 ? (
                <Link
                  href={`/folder/${f.id}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {f.name}
                </Link>
              ) : (
                <span className="font-semibold">{f.name}</span>
              )}
            </span>
          ))}
        </nav>

        <header className="flex items-center gap-3 animate-fade-up">
          <Image
            src={`/illustrations/icons/folder-${accentNameForColor(folder.color, folder.id)}.png`}
            alt=""
            width={96}
            height={96}
            className="pointer-events-none h-12 w-12 shrink-0 select-none object-contain"
          />
          <h1 className="text-2xl font-bold tracking-tight">{folder.name}</h1>
          <ResourceActionsMenu
            actions={{
              onRename: () =>
                setEditing({
                  kind: "folder",
                  id: folder.id,
                  name: folder.name,
                  color: folder.color,
                }),
              onDelete: () =>
                setDeleting({
                  kind: "folder",
                  id: folder.id,
                  name: folder.name,
                }),
            }}
          />
        </header>

        {folder.folders && folder.folders.length > 0 && (
          <section className="animate-fade-up">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">
                Folders
              </h2>
              <button
                type="button"
                onClick={() => setCreating("folder")}
                className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg px-2 py-1 hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                New folder
              </button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {folder.folders.map((sub) => (
                <FolderCard
                  key={sub.id}
                  folder={sub}
                  onClick={(fid) => router.push(`/folder/${fid}`)}
                  actions={{
                    onRename: () =>
                      setEditing({
                        kind: "folder",
                        id: sub.id,
                        name: sub.name,
                        color: sub.color,
                      }),
                    onDelete: () =>
                      setDeleting({
                        kind: "folder",
                        id: sub.id,
                        name: sub.name,
                      }),
                  }}
                />
              ))}
            </div>
          </section>
        )}

        <section className="animate-fade-up">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">
              Workspaces
            </h2>
            <button
              type="button"
              onClick={() => setCreating("workspace")}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg px-2 py-1 hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" />
              New workspace
            </button>
          </div>
          {folder.workspaces.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {folder.workspaces.map((ws) => (
                <WorkspaceCard
                  key={ws.id}
                  workspace={ws}
                  onClick={(wid) => router.push(`/workspace/${wid}`)}
                  actions={{
                    onRename: () =>
                      setEditing({
                        kind: "workspace",
                        id: ws.id,
                        name: ws.title,
                        description: ws.description,
                        icon: ws.icon,
                      }),
                    onMembers: () => setMembersFor(ws.id),
                    onDelete: () =>
                      setDeleting({
                        kind: "workspace",
                        id: ws.id,
                        name: ws.title,
                      }),
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border-strong px-4 py-8 text-center">
              <Image
                src={`/illustrations/icons/folder-${accentNameForColor(folder.color, folder.id)}.png`}
                alt=""
                width={128}
                height={115}
                className="pointer-events-none mx-auto mb-2 h-14 w-auto select-none"
              />
              <p className="text-sm text-muted-foreground">
                No workspaces here yet.
              </p>
            </div>
          )}
        </section>

        {editing && (
          <EditResourceDialog
            target={editing}
            onClose={() => setEditing(null)}
            onSaved={loadTree}
          />
        )}
        {deleting && (
          <DeleteResourceDialog
            target={deleting}
            onClose={() => setDeleting(null)}
            onDeleted={() => {
              if (deleting.kind === "folder" && deleting.id === folder.id) {
                router.push(
                  path.length > 1 ? `/folder/${path[path.length - 2].id}` : "/",
                );
              } else {
                void loadTree();
              }
            }}
          />
        )}
        <WorkspaceMembersDialog
          workspaceId={membersFor}
          open={membersFor !== null}
          onClose={() => setMembersFor(null)}
        />
        {creating && (
          <CreateResourceDialog
            kind={creating}
            parentId={folder.id}
            onClose={() => setCreating(null)}
            onCreated={(workspaceId) => {
              if (workspaceId) router.push(`/workspace/${workspaceId}`);
              else loadTree();
            }}
          />
        )}
      </main>
    </div>
  );
}
