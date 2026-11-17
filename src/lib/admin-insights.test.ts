import { test } from "node:test";
import assert from "node:assert/strict";
import {
  barHeights,
  biggestDropOff,
  formatDuration,
  formatMinutes,
  humanizeTag,
  pageLabel,
} from "./admin-insights";

test("visit lengths read as minutes and hours, never as false precision", () => {
  assert.equal(formatDuration(0), "under a minute");
  assert.equal(formatDuration(59), "under a minute");
  assert.equal(formatDuration(60), "1 min");
  // Shown after "at least", so a partial minute must not round up.
  assert.equal(formatDuration(90), "1 min");
  assert.equal(formatDuration(119), "1 min");
  assert.equal(formatDuration(3599), "59 min");
  assert.equal(formatDuration(50 * 60), "50 min");
  assert.equal(formatDuration(3600), "1 h");
  assert.equal(formatDuration(3600 + 5 * 60), "1 h 05 min");
});

test("median time to first session scales its unit", () => {
  assert.equal(formatMinutes(null), "n/a");
  assert.equal(formatMinutes(0.4), "under a minute");
  assert.equal(formatMinutes(10), "10 min");
  assert.equal(formatMinutes(150), "2.5 h");
  assert.equal(formatMinutes(60 * 24 * 4), "4 days");
});

test("the biggest drop-off is the step that lost the most people", () => {
  const steps = [
    { label: "Signed up", users: 100 },
    { label: "Created a subject", users: 80 },
    { label: "Uploaded material", users: 30 },
    { label: "Started a study session", users: 45 },
    { label: "Finished a study session", users: 20 },
  ];
  assert.deepEqual(biggestDropOff(steps), {
    from: "Created a subject",
    to: "Uploaded material",
    lost: 50,
    pct: 63,
  });
});

test("no drop-off is reported for an empty or non-decreasing funnel", () => {
  assert.equal(biggestDropOff([]), null);
  assert.equal(
    biggestDropOff([
      { label: "a", users: 0 },
      { label: "b", users: 0 },
    ]),
    null,
  );
  assert.equal(
    biggestDropOff([
      { label: "a", users: 3 },
      { label: "b", users: 5 },
    ]),
    null,
  );
});

test("bars scale to the tallest value and stay flat when there is no data", () => {
  assert.deepEqual(barHeights([0, 5, 10]), [0, 50, 100]);
  assert.deepEqual(barHeights([0, 0]), [0, 0]);
  assert.deepEqual(barHeights([]), []);
});

test("tags are shown without underscores", () => {
  assert.equal(humanizeTag("content_quality"), "content quality");
});

test("known routes get a readable name; unknown ones show their pattern", () => {
  assert.equal(pageLabel("/workspace/[id]/study"), "Subject: study");
  assert.equal(pageLabel("/planner"), "Study planner");
  assert.equal(pageLabel("/some/new/[id]/route"), "/some/new/[id]/route");
});
