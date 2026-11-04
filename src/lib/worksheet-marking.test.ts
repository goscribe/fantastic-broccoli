import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PartMarking, WorksheetPart } from "@/types";
import {
  isPartCorrect,
  resolvePartMarking,
  serverCanMarkPart,
  typedAnswersMatch,
} from "./worksheet-marking";

function part(overrides: Partial<WorksheetPart> & Pick<WorksheetPart, "type">): WorksheetPart {
  return { label: "a", prompt: "Magnitude of the vector", ...overrides };
}

const scheme = { points: [{ point: 1, requirements: "Magnitude with unit" }], totalPoints: 1 };

const serverCorrect: PartMarking = {
  points: [{ point: 1, requirements: "Magnitude with unit", achievedPoints: 1, feedback: "" }],
  achievedPoints: 1,
  totalPoints: 1,
  correct: true,
};

const serverWrong: PartMarking = {
  points: [{ point: 1, requirements: "Magnitude with unit", achievedPoints: 0, feedback: "Unit missing" }],
  achievedPoints: 0,
  totalPoints: 1,
  correct: false,
};

describe("typed answer key comparison", () => {
  it("treats 5km and 5 km as the same key", () => {
    assert.equal(typedAnswersMatch("5km", "5 km"), true);
    assert.equal(typedAnswersMatch("5 km", "5km"), true);
    assert.equal(
      isPartCorrect(part({ type: "text", answer: "5 km" }), "5km"),
      true,
    );
  });

  it("ignores case, extra whitespace, and trailing punctuation", () => {
    const key = "5 km";
    for (const given of ["5KM", "  5   km  ", "5 km.", "5km!", "5 km?", "(5km)"]) {
      assert.equal(typedAnswersMatch(given, key), true, given);
    }
  });

  it("matches a LaTeX key with a unit against a plain typed answer", () => {
    assert.equal(
      isPartCorrect(part({ type: "text", answer: "$5\\,\\mathrm{km}$" }), "5km"),
      true,
    );
  });

  it("does not use a loose includes check", () => {
    assert.equal(isPartCorrect(part({ type: "text", answer: "5" }), "15"), false);
    assert.equal(
      isPartCorrect(part({ type: "text", answer: "5 km" }), "the magnitude is 5 km"),
      false,
    );
    assert.equal(typedAnswersMatch("5km", "5 m"), false);
    assert.equal(typedAnswersMatch("5km", "6 km"), false);
  });

  it("splits the unit in compound forms", () => {
    assert.equal(typedAnswersMatch("5km/h", "5 km/h"), true);
  });
});

describe("choice parts stay on the existing check", () => {
  it("accepts the same true/false synonyms as before", () => {
    const truePart = part({ type: "true_false", answer: "True" });
    assert.equal(isPartCorrect(truePart, "True"), true);
    assert.equal(isPartCorrect(truePart, "true"), true);
    assert.equal(isPartCorrect(truePart, "yes"), true);
    assert.equal(isPartCorrect(truePart, "False"), false);
    const falsePart = part({ type: "true_false", answer: "false" });
    assert.equal(isPartCorrect(falsePart, "no"), true);
    assert.equal(isPartCorrect(falsePart, "True"), false);
  });

  it("never sends a true/false part to the server marker", () => {
    const choice = part({ type: "true_false", answer: "True", markScheme: scheme });
    assert.equal(serverCanMarkPart(choice), false);
    assert.equal(serverCanMarkPart(choice, "data:image/png;base64,abc"), false);
    const resolved = resolvePartMarking(choice, "True", {
      serverMarking: serverWrong,
      serverCanDecide: true,
    });
    assert.equal(resolved?.correct, true);
    assert.equal(resolved?.points.length, 0);
  });
});

describe("numeric parts", () => {
  it("still compares the numbers, including a unit written beside the value", () => {
    assert.equal(
      isPartCorrect(part({ type: "numeric", answer: "$5\\,\\mathrm{km}$" }), "5km"),
      true,
    );
    assert.equal(isPartCorrect(part({ type: "numeric", answer: "8.4" }), "8.5"), false);
    assert.equal(isPartCorrect(part({ type: "numeric", answer: "1.2" }), "1.18"), true);
  });
});

describe("resolvePartMarking", () => {
  const vector = part({ type: "text", answer: "5 km", markScheme: scheme });

  it("prefers the server result when one is present", () => {
    const preferred = resolvePartMarking(vector, "5km", {
      serverMarking: serverWrong,
      serverCanDecide: true,
    });
    assert.equal(preferred, serverWrong);

    const prose = resolvePartMarking(vector, "five kilometres", {
      serverMarking: serverCorrect,
      serverCanDecide: true,
    });
    assert.equal(prose, serverCorrect);
  });

  it("does not mark a typed answer wrong when the server can decide but did not", () => {
    const deferred = resolvePartMarking(vector, "five kilometres", {
      serverCanDecide: true,
    });
    assert.equal(deferred, null);
  });

  it("keeps a positive local match when the server call fails", () => {
    const local = resolvePartMarking(vector, "5km.", { serverCanDecide: true });
    assert.equal(local?.correct, true);
    assert.equal(local?.achievedPoints, 1);
  });

  it("marks a typed miss wrong only when nothing else can decide", () => {
    const offline = part({ type: "text", answer: "5 km" });
    assert.equal(serverCanMarkPart(offline), false);
    const marked = resolvePartMarking(offline, "6 km", { serverCanDecide: false });
    assert.equal(marked?.correct, false);
    assert.equal(marked?.achievedPoints, 0);
  });

  it("treats a drawing as a reason to defer a failed local check", () => {
    const drawn = part({ type: "text", answer: "5 km" });
    assert.equal(serverCanMarkPart(drawn, "data:image/png;base64,abc"), true);
    assert.equal(
      resolvePartMarking(drawn, "see drawing", { serverCanDecide: true }),
      null,
    );
  });
});
