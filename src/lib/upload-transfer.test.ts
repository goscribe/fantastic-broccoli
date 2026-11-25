import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PUT_ATTEMPTS,
  UploadIncompleteError,
  backoffMs,
  initialProgress,
  isUploadIncomplete,
  progressAfter,
  putWithRetry,
  retryIncompleteUpload,
  uploadReliably,
  uploadStatusLine,
  type TransferEnv,
  type TransferEvent,
  type UploadApi,
  type UploadProgress,
} from "./upload-transfer";

type Answer = number | "network" | { status: number; body: string } | (() => number | "network");

/** A fetch that answers from a script, one entry per call, plus a page that can be hidden. */
function harness(script: Answer[] = []) {
  const calls: string[] = [];
  const sleeps: number[] = [];
  let hidden = false;
  const hiddenListeners = new Set<() => void>();
  let visibleWaits = 0;
  const env: TransferEnv = {
    fetch: (async (url: string) => {
      calls.push(url);
      let next = script.shift() ?? 200;
      if (typeof next === "function") next = next();
      if (next === "network") throw new TypeError("Failed to fetch");
      const status = typeof next === "number" ? next : next.status;
      const body = typeof next === "number" ? "" : next.body;
      return { ok: status >= 200 && status < 300, status, text: async () => body } as Response;
    }) as typeof fetch,
    sleep: async (ms) => void sleeps.push(ms),
    isHidden: () => hidden,
    whenVisible: async () => {
      visibleWaits += 1;
      hidden = false;
    },
    onHidden: (cb) => {
      hiddenListeners.add(cb);
      return () => hiddenListeners.delete(cb);
    },
  };
  const goBackground = () => {
    hidden = true;
    for (const cb of hiddenListeners) cb();
  };
  return { env, calls, sleeps, goBackground, visibleWaits: () => visibleWaits };
}

const file = (name = "notes.jpg", size = 2048) => new File([new Uint8Array(size)], name, { type: "image/jpeg" });

test("a dropped connection is retried with exponential backoff and succeeds", async () => {
  const h = harness(["network", 503, 200]);
  const events: TransferEvent[] = [];
  const out = await putWithRetry("https://s/u1", file(), "image/jpeg", h.env, (e) => events.push(e));
  assert.deepEqual(out, { ok: true, attempts: 3, backgrounded: false });
  assert.equal(h.calls.length, 3);
  assert.deepEqual(h.sleeps, [backoffMs(1), backoffMs(2)]);
  assert.ok(h.sleeps[1] === h.sleeps[0] * 2);
  assert.deepEqual(
    events.filter((e) => e.type === "retrying").map((e) => (e as { attempt: number }).attempt),
    [2, 3],
  );
});

test(`after ${PUT_ATTEMPTS} failed tries it gives up and says so`, async () => {
  const h = harness(["network", "network", "network", 200]);
  const out = await putWithRetry("https://s/u1", file(), "image/jpeg", h.env);
  assert.equal(out.ok, false);
  assert.equal(h.calls.length, PUT_ATTEMPTS);
  if (!out.ok) assert.deepEqual([out.status, out.urlRefused, out.attempts], [null, false, 3]);
});

test("a refused signed URL is not hammered; an 'already exists' after a lost response counts as uploaded", async () => {
  const refused = harness([400]);
  const out = await putWithRetry("https://s/u1", file(), "image/jpeg", refused.env);
  assert.equal(refused.calls.length, 1);
  assert.ok(!out.ok && out.urlRefused);

  const landed = harness(["network", { status: 400, body: '{"error":"Duplicate","message":"The resource already exists"}' }]);
  assert.deepEqual(await putWithRetry("https://s/u1", file(), "image/jpeg", landed.env), { ok: true, attempts: 2, backgrounded: false });
});

test("the phone going to the background mid-upload pauses, then resumes on return without using up a try", async () => {
  const script: Answer[] = [];
  const h = harness(script);
  // The OS kills the request as the page is hidden, twice; then it goes through.
  script.push(() => (h.goBackground(), "network"), () => (h.goBackground(), "network"), 200);
  const events: string[] = [];
  const out = await putWithRetry("https://s/u1", file(), "image/jpeg", h.env, (e) => events.push(e.type));
  assert.deepEqual(out, { ok: true, attempts: 1, backgrounded: true });
  assert.equal(h.calls.length, 3);
  assert.equal(h.visibleWaits(), 2);
  assert.deepEqual(h.sleeps, [], "no backoff while waiting for the page to come back");
  assert.deepEqual(events, ["attempt", "paused", "resumed", "attempt", "paused", "resumed", "attempt"]);
});

test("an upload started while the page is hidden waits for it to be visible first", async () => {
  const h = harness([200]);
  h.goBackground();
  const events: string[] = [];
  assert.deepEqual(await putWithRetry("https://s/u1", file(), "image/jpeg", h.env, (e) => events.push(e.type)), { ok: true, attempts: 1, backgrounded: true });
  assert.deepEqual(events, ["paused", "resumed", "attempt"]);
});

test("progress reads honestly: files done, a retry, a pause", () => {
  let p: UploadProgress = initialProgress(2);
  assert.equal(uploadStatusLine(p), "Uploading your notes · 0 of 2 files");
  p = progressAfter(p, { type: "retrying", attempt: 2, delayMs: 1500 });
  assert.equal(uploadStatusLine(p), "Connection dropped — trying again (2 of 3)");
  p = progressAfter(p, { type: "paused" });
  assert.match(uploadStatusLine(p), /Paused while Scribe is in the background/);
  p = progressAfter(p, { type: "file_done" });
  assert.equal(uploadStatusLine(p), "Uploading your notes · 1 of 2 files");
  assert.equal(uploadStatusLine(initialProgress(1)), "Uploading your notes…");
});

function fakeApi(over: Partial<UploadApi> = {}, firstId = 0) {
  const tracked: Array<[string, Record<string, unknown>]> = [];
  const reported: string[][] = [];
  const renewed: string[] = [];
  let n = firstId;
  const api: UploadApi = {
    requestUrls: async (files) => files.map(() => ({ fileId: `f${++n}`, uploadUrl: `https://s/f${n}?token=1` })),
    reportFailed: async (ids) => void reported.push(ids),
    retryUrl: async (id) => (renewed.push(id), `https://s/${id}?token=2`),
    track: (event, props) => void tracked.push([event, props]),
    ...over,
  };
  return { api, tracked, reported, renewed };
}

test("several files: all in returns their ids; one that never lands is reported (kept, not deleted) and throws", async () => {
  const ok = harness();
  const a = fakeApi();
  const seen: UploadProgress[] = [];
  assert.deepEqual(await uploadReliably([file("a.jpg"), file("b.jpg")], a.api, ok.env, (p) => seen.push(p)), ["f1", "f2"]);
  assert.equal(seen.at(-1)?.done, 2);
  assert.deepEqual(a.reported, []);

  // f1 lands; f2's PUT fails every try.
  const h = harness();
  h.env.fetch = (async (url: string) => {
    h.calls.push(url);
    if (String(url).includes("f2")) throw new TypeError("Failed to fetch");
    return { ok: true, status: 200, text: async () => "" } as Response;
  }) as typeof fetch;
  const b = fakeApi();
  const err = await uploadReliably([file("a.jpg"), file("b.jpg", 4096)], b.api, h.env).catch((e: unknown) => e);
  assert.ok(err instanceof UploadIncompleteError && isUploadIncomplete(err));
  assert.equal(err.message, "Your upload didn't finish — try again");
  assert.deepEqual(err.uploaded, ["f1"]);
  assert.deepEqual(err.failed.map((f) => [f.fileId, f.file.name]), [["f2", "b.jpg"]]);
  assert.deepEqual(b.reported, [["f2"]]);
  assert.deepEqual(b.tracked, [["upload.failed", { stage: "transfer", fileCount: 1, attempts: 3, backgrounded: false, sizeKb: 4 }]]);
});

test("no upload URL: tracked as the url stage and the server's reason is passed on", async () => {
  const a = fakeApi({ requestUrls: async () => Promise.reject(new Error("Storage limit exceeded.")) });
  await assert.rejects(uploadReliably([file()], a.api, harness().env), /Storage limit exceeded/);
  assert.deepEqual(a.tracked, [["upload.failed", { stage: "url", fileCount: 1 }]]);
});

test("an expired URL is renewed once for the same record", async () => {
  const h = harness([403, 200]);
  const a = fakeApi();
  assert.deepEqual(await uploadReliably([file()], a.api, h.env), ["f1"]);
  assert.deepEqual(a.renewed, ["f1"]);
  assert.deepEqual(h.calls, ["https://s/f1?token=1", "https://s/f1?token=2"]);
});

test("Try again: the failed file goes up under its own record; an older server without retryUpload gets a new one", async () => {
  const failure = new UploadIncompleteError(["f1"], [{ fileId: "f2", file: file("b.jpg") }], 3, true);
  const a = fakeApi();
  const h = harness([200]);
  assert.deepEqual(await retryIncompleteUpload(failure, a.api, h.env), ["f1", "f2"]);
  assert.deepEqual(h.calls, ["https://s/f2?token=2"]);
  assert.deepEqual(a.tracked, [["upload.retried", { attempts: 3, fileCount: 1 }]]);

  const old = fakeApi({ retryUrl: async () => Promise.reject(new Error("No procedure found")) }, 10);
  assert.deepEqual(await retryIncompleteUpload(failure, old.api, harness().env), ["f1", "f11"]);

  const stillDown = fakeApi();
  const again = await retryIncompleteUpload(failure, stillDown.api, harness(["network", "network", "network"]).env).catch((e: unknown) => e);
  assert.ok(again instanceof UploadIncompleteError);
  assert.deepEqual(again.uploaded, ["f1"]);
  assert.deepEqual(stillDown.reported, [["f2"]]);
});
