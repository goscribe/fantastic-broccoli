import { api } from "./trpc-client";

/**
 * Upload system: request signed Supabase Storage URLs from the server, PUT
 * the raw bytes directly to storage, then kick the analysis pipeline
 * (transcription/parsing, artifact-bank precompute). Progress arrives live
 * over Pusher on the workspace channel.
 */

export interface AnalysisStep {
  order: number;
  status: "pending" | "in_progress" | "completed" | "skipped" | "error";
}

export interface AnalysisProgress {
  status: string;
  currentFile?: string;
  steps?: Record<string, AnalysisStep>;
}

interface SignedUpload {
  fileId: string;
  uploadUrl: string;
}

export async function uploadFiles(
  workspaceId: string,
  files: File[],
): Promise<string[]> {
  const result = (await api.workspace.uploadFiles.mutate({
    id: workspaceId,
    files: files.map((f) => ({
      filename: f.name,
      contentType: f.type || "application/octet-stream",
      size: f.size,
    })),
  })) as unknown as SignedUpload[];

  await Promise.all(
    result.map((signed, i) =>
      fetch(signed.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": files[i].type || "application/octet-stream",
        },
        body: files[i],
      }).then((res) => {
        if (!res.ok) throw new Error(`Upload failed for ${files[i].name}`);
      }),
    ),
  );

  return result.map((r) => r.fileId);
}

export async function analyzeFiles(
  workspaceId: string,
  fileIds: string[],
): Promise<void> {
  await api.workspace.uploadAndAnalyzeMedia.mutate({
    workspaceId,
    files: fileIds.map((id) => ({ id })),
    generateStudyGuide: true,
    generateFlashcards: true,
    generateWorksheet: true,
  });
}

/**
 * Subscribe to live analysis progress for a workspace. Returns an
 * unsubscribe function. No-op without Pusher config.
 */
export function subscribeAnalysisProgress(
  workspaceId: string,
  onProgress: (progress: AnalysisProgress) => void,
): () => void {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) return () => {};

  let cleanup: (() => void) | undefined;
  let cancelled = false;

  import("pusher-js").then(({ default: Pusher }) => {
    if (cancelled) return;
    const pusher = new Pusher(key, { cluster });
    const channel = pusher.subscribe(`workspace_${workspaceId}`);
    channel.bind("analysis_progress", onProgress);
    cleanup = () => {
      channel.unbind("analysis_progress", onProgress);
      pusher.unsubscribe(`workspace_${workspaceId}`);
      pusher.disconnect();
    };
  });

  return () => {
    cancelled = true;
    cleanup?.();
  };
}
