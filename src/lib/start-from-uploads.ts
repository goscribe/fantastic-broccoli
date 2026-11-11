import { createWorkspace } from "@/lib/api/workspace";
import {
  analyzeFiles,
  uploadEventProps,
  uploadFiles,
  type UploadContext,
} from "@/lib/api/materials";
import { errorMessage, track } from "@/lib/analytics";
import { createStudySession } from "@/lib/api/study";
import { emitTreeChanged } from "@/lib/tree-events";
import type { StudySession } from "@/types";

export function fileBasename(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

/** Workspace title from the uploaded file names (first file, plus a count). */
export function workspaceTitleFromFiles(files: File[]): string {
  const names = files
    .map((f) => fileBasename(f.name))
    .filter((n) => n.length > 0);
  if (names.length === 0) return "Study session";
  if (names.length === 1) return names[0].slice(0, 60);
  return `${names[0].slice(0, 40)} +${names.length - 1}`.slice(0, 60);
}

/**
 * Creates the workspace an upload goes into; a failure here is reported as
 * `upload_failed` (stage `create_workspace`) since the learner already chose files.
 */
export async function createWorkspaceForUpload(
  title: string,
  files: File[],
  context?: UploadContext,
): Promise<string> {
  try {
    const workspaceId = await createWorkspace(title);
    if (!workspaceId) throw new Error("Could not create a workspace");
    return workspaceId;
  } catch (err) {
    track("upload_failed", {
      ...uploadEventProps(files, context),
      stage: "create_workspace",
      error: errorMessage(err),
    });
    throw err;
  }
}

/**
 * Create a workspace named after the files, upload + kick analysis, and
 * generate a first study session from those names.
 */
export async function startWorkspaceFromUploads(
  files: File[],
  context?: UploadContext,
): Promise<{
  workspaceId: string;
  session?: StudySession;
}> {
  if (files.length === 0) {
    throw new Error("Choose at least one file");
  }
  const title = workspaceTitleFromFiles(files);
  const workspaceId = await createWorkspaceForUpload(title, files, context);
  emitTreeChanged();

  const fileIds = await uploadFiles(workspaceId, files, context);
  analyzeFiles(workspaceId, fileIds).catch(() => {});

  const topics = files
    .map((f) => fileBasename(f.name))
    .filter(Boolean)
    .join(", ")
    .slice(0, 2000);

  let session: StudySession | undefined;
  try {
    session = await createStudySession({
      workspaceId,
      title,
      depth: "moderate",
      durationMinutes: 30,
      topics: topics || undefined,
    });
  } catch {
    // Workspace + files still exist; the study tab can pick up from here.
    session = undefined;
  }

  return { workspaceId, session };
}
