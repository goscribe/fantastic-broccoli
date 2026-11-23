import { test } from "node:test";
import assert from "node:assert/strict";
import { familyFor } from "../../lib/subject-family";
import { LANDING_BOARDS, LANDING_COURSE_COUNT } from "./courses";

test("the landing page lists the 37 catalog courses, once each", () => {
  const all = LANDING_BOARDS.flatMap((b) => b.courses);
  assert.equal(LANDING_COURSE_COUNT, 37);
  assert.equal(new Set(all).size, 37);
});

test("every listed course gets a subject colour (none falls to general)", () => {
  for (const { courses } of LANDING_BOARDS) for (const title of courses) assert.notEqual(familyFor(title), "general", title);
});
