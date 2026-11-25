import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeActivityContent } from "./activity-content";
import type { ReadingContent } from "@/types";

test("readings keep the source-first fields", () => {
  const out = normalizeActivityContent("reading", {
    text: "## Diffusion\n\n**Diffusion** is passive.",
    mode: "source",
    source: { kind: "notes", label: "From your notes: bio.pdf, p. 3", documents: ["bio.pdf"], pages: [3, "x"] },
    keyPoints: ["Diffusion needs no energy from respiration", ""],
    blocks: [{ type: "check", origin: "scribe", question: "Q?" }, "junk"],
  }) as ReadingContent;
  assert.equal(out.mode, "source");
  assert.deepEqual(out.source, { kind: "notes", label: "From your notes: bio.pdf, p. 3", documents: ["bio.pdf"], pages: [3] });
  assert.deepEqual(out.keyPoints, ["Diffusion needs no energy from respiration"]);
  assert.equal(out.blocks?.length, 1);
  const plain = normalizeActivityContent("reading", { text: "Hello" }) as ReadingContent;
  assert.equal(plain.mode, undefined);
  assert.equal(plain.source, undefined);
});

test("long-answer worksheets keep their format, essay part, command term and levels", () => {
  const out = normalizeActivityContent("worksheet", {
    format: "long_answer",
    steps: [{ title: "Chemiosmosis", parts: [{ label: "a", prompt: "Explain chemiosmosis. [6]", type: "essay", commandTerm: "Explain", answer: "Model.", marks: 6, markScheme: { points: [{ point: 6, requirements: "x" }], totalPoints: 6, levels: [{ level: 1, minMarks: 1, maxMarks: 6, descriptor: "d" }, { level: 2 }] } }] }],
  }) as import("@/types").WorksheetContent;
  assert.equal(out.format, "long_answer");
  const part = out.steps[0].parts[0];
  assert.equal(part.type, "essay");
  assert.equal(part.commandTerm, "Explain");
  assert.equal(part.markScheme?.levels?.length, 1);
  const plain = normalizeActivityContent("worksheet", { steps: [{ title: "t", parts: [{ prompt: "p", type: "text", answer: "a" }] }] }) as import("@/types").WorksheetContent;
  assert.equal(plain.format, undefined);
  assert.equal("levels" in (plain.steps[0].parts[0].markScheme ?? {}), false);
});
