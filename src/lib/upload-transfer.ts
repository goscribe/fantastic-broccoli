/**
 * Getting one file's bytes into storage reliably: the PUT to the signed
 * upload URL is retried with exponential backoff, and a phone that goes to
 * the background mid-upload (the OS kills the request) waits until the page
 * is visible again and resumes instead of failing.
 *
 * In November, 21 students asked for an upload URL whose file never reached
 * storage (13 on phones); the app removed the record and nobody heard about
 * it. This module only moves bytes; `lib/api/materials.ts` decides what the
 * student sees.
 *
 * The storage SDK's resumable (TUS) upload needs a user JWT, not the signed
 * upload URL the server hands out, so a retry re-sends the whole file. The
 * signed URL is upsert, so a retry after a lost response is not refused.
 *
 * Pure apart from the injected `TransferEnv`, so the retry and failure paths
 * are tested with a mocked fetch (upload-transfer.test.ts).
 */

/** Tries per file, counting only attempts made while the page was visible. */
export const PUT_ATTEMPTS = 3;
/** Wait before the 2nd and 3rd try (doubling). */
export const PUT_BACKOFF_BASE_MS = 1500;
/** Tries that failed because the page was in the background do not count, up to this many. */
export const MAX_BACKGROUND_RESUMES = 6;

export interface TransferEnv {
  fetch: typeof fetch;
  sleep(ms: number): Promise<void>;
  /** True while the page is hidden (phone locked, app switched). */
  isHidden(): boolean;
  /** Resolves when the page is visible (at once when it already is). */
  whenVisible(): Promise<void>;
  /** Calls `cb` when the page becomes hidden; returns an unsubscribe. */
  onHidden(cb: () => void): () => void;
}

export type TransferEvent =
  | { type: "attempt"; attempt: number }
  | { type: "retrying"; attempt: number; delayMs: number }
  | { type: "paused" }
  | { type: "resumed" };

export type TransferResult =
  | { ok: true; attempts: number; backgrounded: boolean }
  | {
      ok: false;
      attempts: number;
      backgrounded: boolean;
      /** HTTP status of the last answer, or null when the request never completed. */
      status: number | null;
      /** The signed URL itself was refused (expired or invalid): a fresh one may work. */
      urlRefused: boolean;
      message: string;
    };

/** Storage answered that the object is there already (an earlier try did land). */
function alreadyStored(status: number, body: string): boolean {
  return status === 409 || (status === 400 && /already exists|duplicate/i.test(body));
}

/** Worth trying again with the same URL: no answer, a timeout, rate limit or server error. */
const transient = (status: number | null) =>
  status === null || status === 408 || status === 425 || status === 429 || status >= 500;

export const backoffMs = (attempt: number) => PUT_BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1);

export async function putWithRetry(
  url: string,
  file: Blob,
  contentType: string,
  env: TransferEnv,
  onEvent: (event: TransferEvent) => void = () => {},
): Promise<TransferResult> {
  let attempts = 0;
  let resumes = 0;
  let backgrounded = false;
  let last: { status: number | null; message: string } = { status: null, message: "Upload failed" };

  while (attempts < PUT_ATTEMPTS) {
    if (env.isHidden()) {
      backgrounded = true;
      onEvent({ type: "paused" });
      await env.whenVisible();
      onEvent({ type: "resumed" });
    }
    attempts += 1;
    onEvent({ type: "attempt", attempt: attempts });
    let hiddenDuring = false;
    const unsubscribe = env.onHidden(() => {
      hiddenDuring = true;
    });
    try {
      const res = await env.fetch(url, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
      if (res.ok) return { ok: true, attempts, backgrounded };
      const body = await res.text().catch(() => "");
      if (attempts > 1 && alreadyStored(res.status, body)) return { ok: true, attempts, backgrounded };
      last = { status: res.status, message: `Storage answered ${res.status}` };
      if (!transient(res.status)) {
        return {
          ok: false,
          attempts,
          backgrounded,
          status: res.status,
          urlRefused: res.status === 400 || res.status === 401 || res.status === 403,
          message: last.message,
        };
      }
    } catch (err) {
      last = { status: null, message: err instanceof Error ? err.message : String(err) };
    } finally {
      unsubscribe();
    }

    // The OS cut the request because the page went to the background: wait for it to come back, and don't count the try.
    if ((hiddenDuring || env.isHidden()) && last.status === null && resumes < MAX_BACKGROUND_RESUMES) {
      resumes += 1;
      attempts -= 1;
      backgrounded = true;
      onEvent({ type: "paused" });
      await env.whenVisible();
      onEvent({ type: "resumed" });
      continue;
    }
    if (attempts < PUT_ATTEMPTS) {
      const delayMs = backoffMs(attempts);
      onEvent({ type: "retrying", attempt: attempts + 1, delayMs });
      await env.sleep(delayMs);
    }
  }
  return { ok: false, attempts, backgrounded, status: last.status, urlRefused: false, message: last.message };
}

/** The browser's own environment. */
export function browserTransferEnv(): TransferEnv {
  const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";
  return {
    fetch: (...args) => fetch(...args),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    isHidden: hidden,
    whenVisible: () =>
      new Promise<void>((resolve) => {
        if (!hidden()) return resolve();
        const onChange = () => {
          if (hidden()) return;
          document.removeEventListener("visibilitychange", onChange);
          // A moment for the network to come back after unlocking.
          setTimeout(resolve, 400);
        };
        document.addEventListener("visibilitychange", onChange);
      }),
    onHidden: (cb) => {
      if (typeof document === "undefined") return () => {};
      const onChange = () => {
        if (hidden()) cb();
      };
      document.addEventListener("visibilitychange", onChange);
      return () => document.removeEventListener("visibilitychange", onChange);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* What the student sees                                                      */
/* -------------------------------------------------------------------------- */

/** Live state of a multi-file upload, for the wait screen. */
export interface UploadProgress {
  /** Files fully in storage. */
  done: number;
  total: number;
  /** A try failed and the next one is coming (1-based try number of the next one). */
  retryAttempt: number | null;
  /** Waiting for the page to be visible again. */
  paused: boolean;
}

export const initialProgress = (total: number): UploadProgress => ({ done: 0, total, retryAttempt: null, paused: false });

export function progressAfter(state: UploadProgress, event: TransferEvent | { type: "file_done" }): UploadProgress {
  switch (event.type) {
    case "file_done":
      return { ...state, done: Math.min(state.total, state.done + 1), retryAttempt: null, paused: false };
    case "retrying":
      return { ...state, retryAttempt: event.attempt, paused: false };
    case "paused":
      return { ...state, paused: true };
    case "resumed":
      return { ...state, paused: false };
    default:
      return state;
  }
}

/** The upload screens' English copy; registered with i18n by lib/i18n/uploads.ts. */
export const UPLOAD_COPY = {
  "upload.progressOne": "Uploading your notes…",
  "upload.progressMany": "Uploading your notes · {done} of {total} files",
  "upload.retrying": "Connection dropped — trying again ({attempt} of {attempts})",
  "upload.paused": "Paused while Scribe is in the background — it carries on when you come back",
  "upload.failedTitle": "Your upload didn't finish — try again",
  "upload.failedBody": "Nothing is lost: {name} is still on your device. Check your connection, then try again — or paste the text instead.",
  "upload.failedBodyMany": "Nothing is lost: {count} files are still on your device. Check your connection, then try again — or paste the text instead.",
  "upload.tryAgain": "Try again",
  "upload.retryingNow": "Trying again…",
  "upload.pasteInstead": "Paste text instead",
  "upload.readingHint": "Reading notes can take a few minutes. You can leave this page — we'll let you know when your questions are ready.",
  "upload.nextLabel": "What happens next",
  "upload.nextRead": "Reading your notes",
  "upload.nextWrite": "Writing questions from what's in them",
  "upload.nextOpen": "Your session opens here, or from the notification if you've left",
  "upload.leaveHint": "Keep this screen open while it uploads. Once it's in, you can leave: we'll let you know when your questions are ready.",
} as const;

export type UploadCopyKey = keyof typeof UPLOAD_COPY;

/** What the wait screen says now, as a copy key and its values. */
export function uploadStatus(p: UploadProgress): { key: UploadCopyKey; vars: Record<string, string | number> } {
  if (p.paused) return { key: "upload.paused", vars: {} };
  if (p.retryAttempt) return { key: "upload.retrying", vars: { attempt: p.retryAttempt, attempts: PUT_ATTEMPTS } };
  if (p.total > 1) return { key: "upload.progressMany", vars: { done: p.done, total: p.total } };
  return { key: "upload.progressOne", vars: {} };
}

export const fillCopy = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/** One honest line for the wait screen (English): what is happening now. */
export function uploadStatusLine(p: UploadProgress): string {
  const { key, vars } = uploadStatus(p);
  return fillCopy(UPLOAD_COPY[key], vars);
}

export const UPLOAD_FAILED_TITLE = UPLOAD_COPY["upload.failedTitle"];

/** The student chose "Paste text instead" after a failed upload. */
export class UploadCancelledError extends Error {
  readonly code = "upload_cancelled" as const;
  constructor() {
    super("Upload cancelled");
    this.name = "UploadCancelledError";
  }
}

export const isUploadCancelled = (err: unknown): err is UploadCancelledError =>
  (err as { code?: string } | null)?.code === "upload_cancelled";

/* -------------------------------------------------------------------------- */
/* Several files: ask for URLs, move bytes, report what didn't land           */
/* -------------------------------------------------------------------------- */

export interface SignedUpload {
  fileId: string;
  uploadUrl: string;
}

/** The server calls the orchestration needs (wired in lib/api/materials.ts). */
export interface UploadApi {
  /** Records + signed URLs, in the order of `files`. */
  requestUrls(files: File[]): Promise<SignedUpload[]>;
  /** The PUT failed for good: keep the records, marked failed and retryable. Must not throw. */
  reportFailed(fileIds: string[]): Promise<void>;
  /** A fresh signed URL for the same record; null when the server can't (older server, expired). */
  retryUrl(fileId: string): Promise<string | null>;
  track(event: "upload.failed" | "upload.retried", props: Record<string, number | boolean | string>): void;
}

export interface PendingFile {
  fileId: string;
  file: File;
}

/**
 * Some files did not reach storage after every retry. Nothing was deleted:
 * `retryIncompleteUpload` sends `failed` again, `uploaded` are already in.
 */
export class UploadIncompleteError extends Error {
  readonly code = "upload_incomplete" as const;
  readonly uploaded: string[];
  readonly failed: PendingFile[];
  readonly attempts: number;
  readonly backgrounded: boolean;
  constructor(uploaded: string[], failed: PendingFile[], attempts: number, backgrounded: boolean) {
    super(UPLOAD_FAILED_TITLE);
    this.name = "UploadIncompleteError";
    this.uploaded = uploaded;
    this.failed = failed;
    this.attempts = attempts;
    this.backgrounded = backgrounded;
  }
}

export const isUploadIncomplete = (err: unknown): err is UploadIncompleteError =>
  err instanceof UploadIncompleteError || (err as { code?: string } | null)?.code === "upload_incomplete";

const contentTypeOf = (file: File) => file.type || "application/octet-stream";

/** PUT each file (in parallel); a refused URL is renewed once. Returns per-file outcomes. */
async function sendAll(
  pending: { fileId: string; file: File; url: string }[],
  api: UploadApi,
  env: TransferEnv,
  emit: (event: TransferEvent | { type: "file_done" }) => void,
) {
  const results = await Promise.all(
    pending.map(async (p) => {
      let result = await putWithRetry(p.url, p.file, contentTypeOf(p.file), env, emit);
      if (!result.ok && result.urlRefused) {
        const fresh = await api.retryUrl(p.fileId).catch(() => null);
        if (fresh) {
          const again = await putWithRetry(fresh, p.file, contentTypeOf(p.file), env, emit);
          result = { ...again, attempts: again.attempts + result.attempts, backgrounded: again.backgrounded || result.backgrounded };
        }
      }
      if (result.ok) emit({ type: "file_done" });
      return { ...p, result };
    }),
  );
  const failed = results.filter((r) => !r.result.ok);
  return {
    ok: results.filter((r) => r.result.ok).map((r) => r.fileId),
    failed: failed.map(({ fileId, file }) => ({ fileId, file })),
    attempts: Math.max(0, ...results.map((r) => r.result.attempts)),
    backgrounded: results.some((r) => r.result.backgrounded),
  };
}

export async function uploadReliably(
  files: File[],
  api: UploadApi,
  env: TransferEnv,
  onProgress: (p: UploadProgress) => void = () => {},
): Promise<string[]> {
  let state = initialProgress(files.length);
  const emit = (event: TransferEvent | { type: "file_done" }) => {
    state = progressAfter(state, event);
    onProgress(state);
  };
  onProgress(state);

  let signed: SignedUpload[];
  try {
    signed = await api.requestUrls(files);
  } catch (err) {
    // Refused (storage limit…) or unreachable: the caller shows the server's reason.
    api.track("upload.failed", { stage: "url", fileCount: files.length });
    throw err;
  }
  const out = await sendAll(
    signed.map((s, i) => ({ fileId: s.fileId, file: files[i], url: s.uploadUrl })),
    api,
    env,
    emit,
  );
  if (out.failed.length === 0) return out.ok;
  return fail(out, api);
}

async function fail(out: Awaited<ReturnType<typeof sendAll>>, api: UploadApi): Promise<never> {
  api.track("upload.failed", {
    stage: "transfer",
    fileCount: out.failed.length,
    attempts: out.attempts,
    backgrounded: out.backgrounded,
    sizeKb: Math.round(out.failed.reduce((s, f) => s + f.file.size, 0) / 1024),
  });
  await api.reportFailed(out.failed.map((f) => f.fileId)).catch(() => {});
  throw new UploadIncompleteError(out.ok, out.failed, out.attempts, out.backgrounded);
}

/**
 * "Try again": the failed files go up again under their own records (a fresh
 * URL each). An older server without `retryUpload` gets new records instead.
 */
export async function retryIncompleteUpload(
  err: UploadIncompleteError,
  api: UploadApi,
  env: TransferEnv,
  onProgress: (p: UploadProgress) => void = () => {},
): Promise<string[]> {
  api.track("upload.retried", { attempts: err.attempts, fileCount: err.failed.length });
  let state = { ...initialProgress(err.uploaded.length + err.failed.length), done: err.uploaded.length };
  const emit = (event: TransferEvent | { type: "file_done" }) => {
    state = progressAfter(state, event);
    onProgress(state);
  };
  onProgress(state);

  const renewed = await Promise.all(err.failed.map(async (f) => ({ ...f, url: await api.retryUrl(f.fileId).catch(() => null) })));
  const fresh = renewed.filter((r) => !r.url);
  let pending = renewed.filter((r): r is PendingFile & { url: string } => !!r.url);
  if (fresh.length > 0) {
    const signed = await api.requestUrls(fresh.map((f) => f.file));
    pending = [...pending, ...signed.map((s, i) => ({ fileId: s.fileId, file: fresh[i].file, url: s.uploadUrl }))];
  }
  const out = await sendAll(pending, api, env, emit);
  if (out.failed.length === 0) return [...err.uploaded, ...out.ok];
  return fail({ ...out, ok: [...err.uploaded, ...out.ok] }, api);
}
