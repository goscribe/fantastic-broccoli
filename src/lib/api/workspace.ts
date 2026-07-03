import { api } from "./trpc-client";
import { isLiveApi } from "./config";
import {
  mockFolders,
  mockSharedWorkspaces,
  mockWorkspaces,
  getWorkspace as getMockWorkspace,
} from "@/lib/mock-data";
import type { Folder, Material, MaterialType, Workspace } from "@/types";

/**
 * Data layer for workspaces, folders, and materials. Talks to goscribe/server
 * when NEXT_PUBLIC_API_URL is configured; otherwise serves the demo mock data.
 */

interface TreeFolderRow {
  id: string;
  name: string;
  parentId: string | null;
  color: string | null;
}

interface TreeWorkspaceRow {
  id: string;
  title: string;
  folderId: string | null;
  icon: string | null;
  color: string | null;
  updatedAt: Date | string;
  uploads: UploadRow[];
}

interface UploadRow {
  id: string;
  name: string;
  mimeType: string | null;
  createdAt: Date | string;
}

function mimeToMaterialType(mimeType: string | null, name: string): MaterialType {
  const mt = mimeType ?? "";
  if (mt.includes("pdf") || name.toLowerCase().endsWith(".pdf")) return "pdf";
  if (mt.startsWith("audio/")) return "audio";
  if (mt.includes("presentation") || /\.(pptx?|key)$/i.test(name)) return "slides";
  return "note";
}

export function mapUploadToMaterial(
  upload: UploadRow,
  workspaceId: string,
): Material {
  return {
    id: upload.id,
    workspaceId,
    type: mimeToMaterialType(upload.mimeType, upload.name),
    title: upload.name,
    updatedAt: new Date(upload.createdAt).toISOString(),
  };
}

function mapWorkspace(row: TreeWorkspaceRow): Workspace {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon ?? "book",
    color: row.color ?? "green",
    folderId: row.folderId ?? undefined,
    sessions: [],
    materials: (row.uploads ?? []).map((u) => mapUploadToMaterial(u, row.id)),
    totalProgress: 0,
    createdAt: new Date(row.updatedAt).toISOString(),
  };
}

function buildFolderTree(
  folders: TreeFolderRow[],
  workspaces: Workspace[],
): { tree: Folder[]; rootWorkspaces: Workspace[] } {
  const byId = new Map<string, Folder>(
    folders.map((f) => [
      f.id,
      {
        id: f.id,
        name: f.name,
        color: f.color ?? "green",
        parentId: f.parentId ?? undefined,
        workspaces: [],
        folders: [],
      },
    ]),
  );

  const tree: Folder[] = [];
  for (const folder of byId.values()) {
    if (folder.parentId && byId.has(folder.parentId)) {
      byId.get(folder.parentId)!.folders!.push(folder);
    } else {
      tree.push(folder);
    }
  }

  const rootWorkspaces: Workspace[] = [];
  for (const ws of workspaces) {
    if (ws.folderId && byId.has(ws.folderId)) {
      byId.get(ws.folderId)!.workspaces.push(ws);
    } else {
      rootWorkspaces.push(ws);
    }
  }

  return { tree, rootWorkspaces };
}

export interface WorkspaceTree {
  folders: Folder[];
  rootWorkspaces: Workspace[];
}

export async function fetchWorkspaceTree(): Promise<WorkspaceTree> {
  if (!isLiveApi) {
    return {
      folders: mockFolders,
      rootWorkspaces: mockWorkspaces.filter((w) => !w.folderId),
    };
  }
  const { folders, workspaces } = await api.workspace.getTree.query();
  const mapped = (workspaces as TreeWorkspaceRow[]).map(mapWorkspace);
  const { tree, rootWorkspaces } = buildFolderTree(
    folders as TreeFolderRow[],
    mapped,
  );
  return { folders: tree, rootWorkspaces };
}

export async function fetchSharedWorkspaces(): Promise<Workspace[]> {
  if (!isLiveApi) return mockSharedWorkspaces;
  const { shared } = await api.workspace.getSharedWith.query({ id: "me" });
  return (shared as unknown as TreeWorkspaceRow[]).map((row) => ({
    ...mapWorkspace({ ...row, uploads: row.uploads ?? [] }),
    sharedBy: "Shared member",
  }));
}

export async function fetchWorkspace(id: string): Promise<Workspace | undefined> {
  if (!isLiveApi) return getMockWorkspace(id);
  const row = await api.workspace.get.query({ id });
  if (!row) return undefined;
  return mapWorkspace(row as unknown as TreeWorkspaceRow);
}

export async function createFolder(
  name: string,
  parentId?: string,
): Promise<void> {
  if (!isLiveApi) return;
  await api.workspace.createFolder.mutate({ name, parentId });
}

export async function createWorkspace(
  name: string,
  parentId?: string,
): Promise<string | undefined> {
  if (!isLiveApi) return undefined;
  const ws = await api.workspace.create.mutate({ name, parentId });
  return (ws as { id: string }).id;
}
