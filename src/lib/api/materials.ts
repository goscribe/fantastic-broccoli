import { api } from "./trpc-client";
import { rpc } from "./study-session";
import { track } from "../funnel";
import {
  browserTransferEnv,
  retryIncompleteUpload,
  uploadReliably,
  type SignedUpload,
  type UploadApi,
  type UploadIncompleteError,
  type UploadProgress,
} from "../upload-transfer";

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

export const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;

/** The server side of an upload, for the retrying transfer in lib/upload-transfer.ts. */
export function uploadApi(workspaceId: string): UploadApi {
  return {
    requestUrls: async (files) =>
      (await api.workspace.uploadFiles.mutate({
        id: workspaceId,
        files: files.map((f) => ({
          filename: f.name,
          contentType: f.type || "application/octet-stream",
          size: f.size,
        })),
      })) as unknown as SignedUpload[],
    // Keeps the records, marked "didn't finish" and retryable (older servers: nothing happens, nothing is deleted).
    reportFailed: async (fileIds) => {
      await rpc("workspace.reportUploadFailed", "mutation", { workspaceId, fileIds }).catch(() => {});
    },
    retryUrl: async (fileId) => {
      const out = await rpc<{ uploadUrl?: string } | null>("workspace.retryUpload", "mutation", { workspaceId, fileId });
      return out?.uploadUrl ?? null;
    },
    track: (event, props) => track(event, props as never, workspaceId),
  };
}

/**
 * Uploads `files` into the subject: signed URLs from the server, then the
 * bytes straight to storage, retried with backoff and resumed after the phone
 * comes back from the background. Throws `UploadIncompleteError` (never
 * silently) when a file still didn't land; the records are kept so
 * `retryUpload` can send them again.
 */
export async function uploadFiles(
  workspaceId: string,
  files: File[],
  onProgress?: (progress: UploadProgress) => void,
): Promise<string[]> {
  const oversized = files.find((f) => f.size > MAX_UPLOAD_BYTES);
  if (oversized) {
    track("upload.failed", { stage: "too_large", fileCount: files.length, sizeKb: Math.round(oversized.size / 1024) }, workspaceId);
    throw new Error(
      `"${oversized.name}" is ${(oversized.size / (1024 * 1024)).toFixed(1)}MB — files must be under 1GB.`,
    );
  }
  return uploadReliably(files, uploadApi(workspaceId), browserTransferEnv(), onProgress);
}

/** "Try again" after an `UploadIncompleteError`: returns every file id once all are in. */
export function retryUpload(
  workspaceId: string,
  failure: UploadIncompleteError,
  onProgress?: (progress: UploadProgress) => void,
): Promise<string[]> {
  return retryIncompleteUpload(failure, uploadApi(workspaceId), browserTransferEnv(), onProgress);
}

export async function deleteFiles(
  workspaceId: string,
  fileIds: string[],
): Promise<void> {
  await api.workspace.deleteFiles.mutate({
    id: workspaceId,
    fileId: fileIds,
  });
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

const YOUTUBE_URL_RE =
  /https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?[^\s]*v=|shorts\/|embed\/|live\/)|youtu\.be\/)[A-Za-z0-9_-]{11}[^\s<>()"']*/i;

/** First YouTube video link found in free text, if any. */
export function findYoutubeUrl(text: string): string | null {
  const match = text.match(YOUTUBE_URL_RE);
  return match ? match[0].replace(/[.,;:!?]+$/, "") : null;
}

export interface YoutubeImportResult {
  fileId: string;
  name: string;
  title: string;
  channel: string | null;
  alreadyImported: boolean;
}

/**
 * Paste a YouTube link: the server fetches the captions, stores them as a
 * workspace material and queues the normal analysis pipeline. Errors carry
 * learner-facing messages (no captions, private video, …).
 */
export async function importYoutube(
  workspaceId: string,
  url: string,
): Promise<YoutubeImportResult> {
  return rpc<YoutubeImportResult>("workspace.importYoutube", "mutation", {
    workspaceId,
    url,
  });
}

export async function reanalyzeFile(
  workspaceId: string,
  fileId: string,
): Promise<void> {
  await rpc("workspace.reanalyzeFile", "mutation", { workspaceId, fileId });
}

/** One preview image URL per upload in a workspace (signed, 24h); null when nothing has been extracted yet. */
export async function fetchUploadPreviews(
  workspaceId: string,
): Promise<{ id: string; url: string | null }[]> {
  const rows = await rpc<{ id: string; url: string | null }[] | null>(
    "workspace.getUploadPreviews",
    "query",
    { workspaceId },
  );
  return Array.isArray(rows) ? rows.filter(Boolean) : [];
}

export interface StudyGuideSection {
  title: string;
  excerpt: string;
}

/** Study-guide sections (Paper 1 / PP2 / Oral / Unit 3 …) found in analyzed files. */
export const detectSections = (workspaceId: string, fileIds: string[]) =>
  rpc<{ sections: StudyGuideSection[] }>("workspace.detectSections", "query", { workspaceId, fileIds });

/**
 * Pasted notes become an analysed material at once (no upload, no analysis
 * wait), so a Quick 5 can be planned from them straight away.
 */
export async function addPastedText(
  workspaceId: string,
  text: string,
  title?: string,
): Promise<{ fileId: string; name: string; chars: number }> {
  return rpc("workspace.addPastedText", "mutation", { workspaceId, text, title });
}
