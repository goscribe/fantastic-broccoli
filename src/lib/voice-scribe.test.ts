import { test } from "node:test";
import assert from "node:assert/strict";
import { appendWritten, recognitionLang, spokenCommand, spokenSwitch } from "./voice-scribe";

const AB = ["a", "b"];

test("spokenSwitch: a part by name, as recognition writes it", () => {
  assert.deepEqual(spokenSwitch("part b", AB), { to: "b", rest: "" });
  assert.deepEqual(spokenSwitch("Part B.", AB), { to: "b", rest: "" });
  assert.deepEqual(spokenSwitch("part bee", AB), { to: "b", rest: "" });
  assert.deepEqual(spokenSwitch("okay go to part a", AB), { to: "a", rest: "" });
  assert.deepEqual(spokenSwitch("question 2", AB), { to: "b", rest: "" });
  assert.deepEqual(spokenSwitch("question two", AB), { to: "b", rest: "" });
});

test("spokenSwitch: switching mid-sentence keeps the rest to write", () => {
  assert.deepEqual(spokenSwitch("for part a, add the oranges to the bananas", AB), { to: "a", rest: "add the oranges to the bananas" });
});

test("spokenSwitch: next and previous", () => {
  assert.deepEqual(spokenSwitch("next part", AB), { step: 1, rest: "" });
  assert.deepEqual(spokenSwitch("previous question", AB), { step: -1, rest: "" });
});

test("spokenSwitch: ordinary working is not a switch", () => {
  assert.equal(spokenSwitch("add the oranges to the bananas", AB), null);
  assert.equal(spokenSwitch("part of the answer is four", AB), null);
  assert.equal(spokenSwitch("question 5", AB), null);
  assert.equal(spokenSwitch("part", AB), null);
});

test("spokenCommand", () => {
  assert.equal(spokenCommand("Scratch that."), "undo");
  assert.equal(spokenCommand("new line"), "newline");
  assert.equal(spokenCommand("scratch that cat"), null);
});

test("appendWritten: maths steps go on new lines, words carry on", () => {
  assert.equal(appendWritten("", "2 + 2 = 4", "math"), "2 + 2 = 4");
  assert.equal(appendWritten("2 + 2 = 4", "4 + 3 = 7", "math"), "2 + 2 = 4\n4 + 3 = 7");
  assert.equal(appendWritten("He has", "four.", "prose"), "He has four.");
  assert.equal(appendWritten("4", "+ 3", "math", true), "4 + 3");
});

test("recognitionLang prefers the device's own variant", () => {
  assert.equal(recognitionLang("en", ["en-GB", "fr-FR"]), "en-GB");
  assert.equal(recognitionLang("fr", ["en-GB"]), "fr");
});
