import { test } from "node:test";
import assert from "node:assert/strict";
import { PENDING_READ_MAX_AGE_MS, READ_POLL, SLOW_READ_AFTER_MS, nextPollDelay, parsePendingRead, readPhase, waitForRead, type ReadStatus } from "./coursework-read";

/** A clock that only moves when the code sleeps, and the times at which `check` was called. */
function rig(statusAt: (elapsedMs: number, call: number) => ReadStatus | Error) {
  let at = 0;
  const calls: number[] = [];
  return {
    calls,
    elapsed: () => at,
    opts: {
      now: () => at,
      sleep: async (ms: number) => {
        at += ms;
      },
    },
    check: async () => {
      calls.push(at);
      const s = statusAt(at, calls.length);
      if (s instanceof Error) throw s;
      return { status: s, wordCount: 1200 };
    },
  };
}

test("polling: every second for 10 s, every 2 s to 30 s, then every 4 s, and it stops at 150 s", () => {
  assert.equal(nextPollDelay(0), 1000);
  assert.equal(nextPollDelay(9_999), 1000);
  assert.equal(nextPollDelay(10_000), 2000);
  assert.equal(nextPollDelay(29_999), 2000);
  assert.equal(nextPollDelay(30_000), 4000);
  assert.equal(nextPollDelay(120_000), 4000);
  // The last wait is cut to end at the limit, not after it.
  assert.equal(nextPollDelay(READ_POLL.giveUpMs - 1500), 1500);
  assert.equal(nextPollDelay(READ_POLL.giveUpMs), null);
  assert.equal(nextPollDelay(READ_POLL.giveUpMs + 1), null);
});

test("a file read by a worker a few seconds later is noticed within a second", async () => {
  const r = rig((ms) => (ms >= 3_400 ? "ready" : "extracting"));
  const out = await waitForRead(r.check, r.opts);
  assert.deepEqual(out, { outcome: "ready", value: { status: "ready", wordCount: 1200 } });
  assert.deepEqual(r.calls, [1000, 2000, 3000, 4000]);
});

test("a slow read (OCR) is asked about less and less often; a failure ends the wait with the server's answer", async () => {
  const r = rig((ms) => (ms >= 47_000 ? "failed" : "extracting"));
  const out = await waitForRead(r.check, r.opts);
  assert.equal(out.outcome, "failed");
  assert.deepEqual(r.calls.slice(0, 10), [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10_000]);
  assert.deepEqual(r.calls.slice(10, 20), [12_000, 14_000, 16_000, 18_000, 20_000, 22_000, 24_000, 26_000, 28_000, 30_000]);
  assert.deepEqual(r.calls.slice(20), [34_000, 38_000, 42_000, 46_000, 50_000]);
});

test("a read that never ends stops at 150 s (the server fails a stuck read at 120 s, so this is the backstop)", async () => {
  const r = rig(() => "extracting");
  const out = await waitForRead(r.check, r.opts);
  assert.deepEqual(out, { outcome: "timeout" });
  assert.equal(r.elapsed(), READ_POLL.giveUpMs);
  assert.equal(r.calls.length, 10 + 10 + 30);
});

test("a dropped connection is tried again; three in a row end the wait; leaving the page stops it", async () => {
  const flaky = rig((_ms, call) => (call === 2 || call === 3 ? new Error("network") : call >= 5 ? "ready" : "extracting"));
  assert.equal((await waitForRead(flaky.check, flaky.opts)).outcome, "ready");
  assert.equal(flaky.calls.length, 5);
  const down = rig(() => new Error("network"));
  assert.deepEqual(await waitForRead(down.check, down.opts), { outcome: "timeout" });
  assert.equal(down.calls.length, 3);
  let gone = false;
  const left = rig((_ms, call) => {
    if (call === 2) gone = true;
    return "extracting";
  });
  assert.deepEqual(await waitForRead(left.check, { ...left.opts, aborted: () => gone }), { outcome: "aborted" });
  assert.equal(left.calls.length, 2);
});

test("picking a wait up again after a reload keeps the original clock", async () => {
  // Reading began 25 s before this page loaded: the next questions are 2 s apart, then 4 s.
  let at = 25_000;
  const calls: number[] = [];
  const out = await waitForRead(
    async () => {
      calls.push(at);
      return { status: (at >= 36_000 ? "ready" : "extracting") as ReadStatus };
    },
    { now: () => at, sleep: async (ms) => void (at += ms), startedAt: 0 },
  );
  assert.equal(out.outcome, "ready");
  assert.deepEqual(calls, [27_000, 29_000, 31_000, 35_000, 39_000]);
});

test("what the card says: uploading, reading, and after 8 s that scans take up to a minute", () => {
  assert.equal(readPhase(false, 0), "uploading");
  assert.equal(readPhase(false, 60_000), "uploading");
  assert.equal(readPhase(true, 0), "reading");
  assert.equal(readPhase(true, SLOW_READ_AFTER_MS - 1), "reading");
  assert.equal(readPhase(true, SLOW_READ_AFTER_MS), "slow");
});

test("the upload remembered for a reload: only a well-formed, recent one is used", () => {
  const now = 1_800_000_000_000;
  const ok = { documentId: "doc1", draftId: "dr1", name: "CS-IA-document.docx", since: now - 20_000 };
  assert.deepEqual(parsePendingRead(JSON.stringify(ok), now), ok);
  assert.equal(parsePendingRead(null, now), null);
  assert.equal(parsePendingRead("", now), null);
  assert.equal(parsePendingRead("{not json", now), null);
  assert.equal(parsePendingRead(JSON.stringify({ ...ok, draftId: "" }), now), null);
  assert.equal(parsePendingRead(JSON.stringify({ ...ok, since: "yesterday" }), now), null);
  assert.equal(parsePendingRead(JSON.stringify({ ...ok, since: now - PENDING_READ_MAX_AGE_MS - 1 }), now), null);
  assert.equal(parsePendingRead(JSON.stringify({ ...ok, since: now + 3_600_000 }), now), null);
  assert.equal(parsePendingRead("null", now), null);
});
