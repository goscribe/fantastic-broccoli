import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REVEAL_SCOPE, revealOnStart, revealOnStop } from "./reveal";

describe("reveal on scroll never leaves content hidden", () => {
  const vh = 900;

  test("what is on screen when the observer starts is left alone", () => {
    assert.deepEqual(revealOnStart("", 120, vh), { state: "", observe: false });
    assert.deepEqual(revealOnStart("", -400, vh), { state: "", observe: false });
  });

  test("what is below the fold waits, and is watched", () => {
    assert.deepEqual(revealOnStart("", 1400, vh), { state: "wait", observe: true });
  });

  test("an element an earlier observer left waiting is watched again, not skipped", () => {
    // The bug: a second run skipped everything already marked "wait", so nothing ever showed it.
    assert.deepEqual(revealOnStart("wait", 1400, vh), { state: "wait", observe: true });
    // …and one that has since come on screen is simply shown.
    assert.deepEqual(revealOnStart("wait", 300, vh), { state: "", observe: false });
  });

  test("an element that has been shown is never hidden again", () => {
    assert.deepEqual(revealOnStart("in", 1400, vh), { state: "in", observe: false });
  });

  test("an observer that stops hides nothing", () => {
    assert.equal(revealOnStop("wait"), "");
    assert.equal(revealOnStop(""), "");
    assert.equal(revealOnStop(undefined), "");
    assert.equal(revealOnStop("in"), "in");
  });

  test("the stylesheet hides a waiting element only while an observer is alive", () => {
    const css = readFileSync(new URL("../../app/notes/notes-look.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => m[1].includes('[data-nl-reveal="wait"]'));
    assert.ok(rules.length > 0, "the waiting state is styled");
    for (const [, selector] of rules)
      for (const part of selector.split(","))
        if (part.includes('[data-nl-reveal="wait"]')) assert.ok(part.trim().startsWith(`[${REVEAL_SCOPE}] `), `"${part.trim()}" must sit under [${REVEAL_SCOPE}]`);
  });
});
