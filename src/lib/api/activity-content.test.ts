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
