import { api } from "./trpc-client";
import type { Folder, Material, MaterialType, Workspace } from "@/types";

/** Data layer for workspaces, folders, and materials (goscribe/server). */

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
  analyzed?: boolean;
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
    analyzed: upload.analyzed,
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
  const { folders, workspaces } = await api.workspace.getTree.query();
  const mapped = (workspaces as TreeWorkspaceRow[]).map(mapWorkspace);
  const { tree, rootWorkspaces } = buildFolderTree(
    folders as TreeFolderRow[],
    mapped,
  );
  return { folders: tree, rootWorkspaces };
}

export async function fetchSharedWorkspaces(): Promise<Workspace[]> {
  const { shared } = await api.workspace.getSharedWith.query({ id: "me" });
  return (shared as unknown as TreeWorkspaceRow[]).map((row) => ({
    ...mapWorkspace({ ...row, uploads: row.uploads ?? [] }),
    sharedBy: "Shared member",
  }));
}

export async function fetchWorkspace(id: string): Promise<Workspace | undefined> {
  const row = await api.workspace.get.query({ id });
  if (!row) return undefined;
  return mapWorkspace(row as unknown as TreeWorkspaceRow);
}

export async function createFolder(
  name: string,
  parentId?: string,
): Promise<void> {
  await api.workspace.createFolder.mutate({ name, parentId });
}

export async function createWorkspace(
  name: string,
  parentId?: string,
): Promise<string | undefined> {
  const ws = await api.workspace.create.mutate({ name, parentId });
  return (ws as { id: string }).id;
}

export async function updateWorkspace(
  id: string,
  updates: { name?: string; description?: string },
): Promise<void> {
  await api.workspace.update.mutate({ id, ...updates });
}

export async function deleteWorkspace(id: string): Promise<void> {
  await api.workspace.delete.mutate({ id });
}

export async function updateFolder(
  id: string,
  updates: { name?: string; color?: string | null },
): Promise<void> {
  await api.workspace.updateFolder.mutate({ id, ...updates });
}

export async function deleteFolder(id: string): Promise<void> {
  await api.workspace.deleteFolder.mutate({ id });
}

export async function inviteMember(
  workspaceId: string,
  email: string,
  role: "admin" | "member" = "member",
): Promise<void> {
  await api.workspace.members.inviteMember.mutate({ workspaceId, email, role });
}

export interface WorkspaceMemberRecord {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
}

export interface WorkspaceInvitationRecord {
  id: string;
  email: string;
  role: "admin" | "member" | string;
  expiresAt: string;
  createdAt: string;
  invitedByName: string | null;
}

export async function fetchWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMemberRecord[]> {
  const members = await api.workspace.members.getMembers.query({ workspaceId });
  return members.map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    joinedAt: new Date(member.joinedAt).toISOString(),
  }));
}

export async function fetchCurrentWorkspaceRole(
  workspaceId: string,
): Promise<"owner" | "admin" | "member"> {
  return api.workspace.members.getCurrentUserRole.query({ workspaceId });
}

export async function fetchPendingInvitations(
  workspaceId: string,
): Promise<WorkspaceInvitationRecord[]> {
  const invites = await api.workspace.members.getPendingInvitations.query({
    workspaceId,
  });
  return invites.map((invite) => ({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: new Date(invite.expiresAt).toISOString(),
    createdAt: new Date(invite.createdAt).toISOString(),
    invitedByName: invite.invitedByName,
  }));
}

export async function changeWorkspaceMemberRole(
  workspaceId: string,
  memberId: string,
  role: "admin" | "member",
): Promise<void> {
  await api.workspace.members.changeMemberRole.mutate({
    workspaceId,
    memberId,
    role,
  });
}

export async function removeWorkspaceMember(
  workspaceId: string,
  memberId: string,
): Promise<void> {
  await api.workspace.members.removeMember.mutate({ workspaceId, memberId });
}
