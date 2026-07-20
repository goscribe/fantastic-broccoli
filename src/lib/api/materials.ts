import { api } from "./trpc-client";
import { rpc } from "./study-session";

export interface FileImage {
  url: string;
  page: number;
  description: string;
}

export interface FileChunk {
  index: number;
  content: string;
}

export interface FileDetails {
  id: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
  textContent: string | null;
  images: FileImage[];
  chunks: FileChunk[];
}

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
  fileId?: string;
  steps?: Record<string, AnalysisStep>;
}

interface FileAnalysisEvent {
  fileId: string;
  status: string;
  filename?: string;
  error?: string;
}

interface SignedUpload {
  fileId: string;
  uploadUrl: string;
}

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export async function uploadFiles(
  workspaceId: string,
  files: File[],
): Promise<string[]> {
  const oversized = files.find((f) => f.size > MAX_UPLOAD_BYTES);
  if (oversized) {
    throw new Error(
      `"${oversized.name}" is ${(oversized.size / (1024 * 1024)).toFixed(1)}MB — files must be under 100MB.`,
    );
  }

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
  // New concurrent pipeline: files are processed in parallel with per-file
  // progress, then the artifact bank is precomputed from the transcriptions.
  await rpc("workspace.uploadAndAnalyzeMediaConcurrent", "mutation", {
    workspaceId,
    files: fileIds.map((id) => ({ id })),
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
    const onFileProgress = (event: FileAnalysisEvent) =>
      onProgress({
        status: event.status,
        currentFile: event.filename,
        fileId: event.fileId,
      });
    channel.bind("analysis_progress", onProgress);
    channel.bind("file_analysis_progress", onFileProgress);
    cleanup = () => {
      channel.unbind("analysis_progress", onProgress);
      channel.unbind("file_analysis_progress", onFileProgress);
      pusher.unsubscribe(`workspace_${workspaceId}`);
      pusher.disconnect();
    };
  });

  return () => {
    cancelled = true;
    cleanup?.();
  };
}

export async function fetchFileDetails(
  workspaceId: string,
  fileId: string,
): Promise<FileDetails> {
  return rpc<FileDetails>("workspace.getFileDetails", "query", {
    workspaceId,
    fileId,
  });
}

export async function reanalyzeFile(
  workspaceId: string,
  fileId: string,
): Promise<void> {
  await rpc("workspace.reanalyzeFile", "mutation", { workspaceId, fileId });
}
