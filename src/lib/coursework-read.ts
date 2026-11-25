/**
 * Waiting for an uploaded file to be read.
 *
 * The server reads PDFs with a text layer, Word files and text files inside
 * the finishUpload request, so most uploads come back ready and nothing is
 * polled. A scan or a photo goes through OCR on a worker (up to a minute or
 * so): the app then asks quickly at first and less often as it waits, says
 * honestly why it is taking long, and stops when the server gives up (it
 * fails a read stuck for two minutes) or shortly after that itself.
 *
 * No imports: the timing rules are tested on their own.
 */

/** Ask every second for the first 10 s, every 2 s up to 30 s, then every 4 s; stop after 150 s. */
export const READ_POLL = { fastMs: 1000, fastUntilMs: 10_000, steadyMs: 2000, steadyUntilMs: 30_000, slowMs: 4000, giveUpMs: 150_000 } as const;

/** How long to wait before asking again, `elapsedMs` after the upload finished; null = stop waiting. */
export function nextPollDelay(elapsedMs: number): number | null {
  if (elapsedMs >= READ_POLL.giveUpMs) return null;
  if (elapsedMs < READ_POLL.fastUntilMs) return READ_POLL.fastMs;
  if (elapsedMs < READ_POLL.steadyUntilMs) return READ_POLL.steadyMs;
  return Math.min(READ_POLL.slowMs, READ_POLL.giveUpMs - elapsedMs);
}

/** After this long "Reading your file…" becomes "Scanned or image files take up to a minute". */
export const SLOW_READ_AFTER_MS = 8000;

/** What the card says: sending the file, reading it, or reading it for a while. */
export type ReadPhase = "uploading" | "reading" | "slow";

export function readPhase(uploaded: boolean, readingForMs: number): ReadPhase {
  if (!uploaded) return "uploading";
  return readingForMs >= SLOW_READ_AFTER_MS ? "slow" : "reading";
}

export type ReadStatus = "uploading" | "extracting" | "ready" | "failed";

export type ReadOutcome<T> = { outcome: "ready"; value: T } | { outcome: "failed"; value: T } | { outcome: "timeout" } | { outcome: "aborted" };

/**
 * Asks `check` until the file is ready or failed, with the delays above. A
 * check that throws (a dropped connection) is tried again; three in a row
 * end the wait as a timeout. `now` and `sleep` are injectable for tests.
 */
export async function waitForRead<T extends { status?: ReadStatus | null }>(
  check: () => Promise<T>,
  opts: { now?: () => number; sleep?: (ms: number) => Promise<void>; aborted?: () => boolean; startedAt?: number } = {},
): Promise<ReadOutcome<T>> {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const started = opts.startedAt ?? now();
  let errors = 0;
  for (;;) {
    if (opts.aborted?.()) return { outcome: "aborted" };
    const delay = nextPollDelay(now() - started);
    if (delay === null) return { outcome: "timeout" };
    await sleep(delay);
    if (opts.aborted?.()) return { outcome: "aborted" };
    try {
      const value = await check();
      errors = 0;
      if (value.status === "ready") return { outcome: "ready", value };
      if (value.status === "failed") return { outcome: "failed", value };
    } catch {
      if (++errors >= 3) return { outcome: "timeout" };
    }
  }
}

/** An upload being read, remembered for this tab so a reload picks it up again. */
export interface PendingRead {
  documentId: string;
  draftId: string;
  name: string;
  /** When reading started (ms). */
  since: number;
}

/** A remembered upload older than this is forgotten (the server has long since finished or failed it). */
export const PENDING_READ_MAX_AGE_MS = 30 * 60 * 1000;

export function parsePendingRead(raw: string | null | undefined, now: number): PendingRead | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<PendingRead> | null;
    if (!v || typeof v.documentId !== "string" || typeof v.draftId !== "string" || typeof v.name !== "string" || typeof v.since !== "number") return null;
    if (!v.documentId || !v.draftId || now - v.since > PENDING_READ_MAX_AGE_MS || v.since > now + 60_000) return null;
    return { documentId: v.documentId, draftId: v.draftId, name: v.name.slice(0, 200), since: v.since };
  } catch {
    return null;
  }
}
