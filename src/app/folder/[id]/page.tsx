"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchWorkspaceTree } from "@/lib/api/workspace";
import type { Folder } from "@/types";
import { FolderCard } from "@/components/workspace/folder-card";
import { WorkspaceCard } from "@/components/workspace/workspace-card";
import { CreateResourceDialog } from "@/components/workspace/create-dialog";
import { ChevronRight, Plus } from "lucide-react";

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

  const loadTree = () =>
    fetchWorkspaceTree()
      .then((tree) => setPath(findFolderPath(tree.folders, id)))
      .catch(() => {})
      .finally(() => setLoaded(true));

  useEffect(() => {
    loadTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const folder = path?.[path.length - 1];

  if (!folder || !path) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">
          {loaded ? "Folder not found." : "Loading…"}
        </p>
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
          <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden>
            <path
              fill={folder.color}
              d="M2.25 6A2.25 2.25 0 0 1 4.5 3.75h4.8c.6 0 1.17.24 1.59.66l1.35 1.38c.28.29.67.46 1.08.46h6.18A2.25 2.25 0 0 1 21.75 8.5v9.5a2.25 2.25 0 0 1-2.25 2.25h-15A2.25 2.25 0 0 1 2.25 18V6z"
            />
          </svg>
          <h1 className="text-2xl font-bold tracking-tight">{folder.name}</h1>
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
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border-strong px-4 py-8 text-center">
              No workspaces here yet.
            </p>
          )}
        </section>

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
