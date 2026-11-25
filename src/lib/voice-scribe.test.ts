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
  assert.equal(appendWritten("$4 + 3 = 7$", "So he has 7.", "prose"), "$4 + 3 = 7$\nSo he has 7.");
  assert.equal(appendWritten("4", "+ 3", "math", true), "4 + 3");
});

test("recognitionLang prefers the device's own variant", () => {
  assert.equal(recognitionLang("en", ["en-GB", "fr-FR"]), "en-GB");
  assert.equal(recognitionLang("fr", ["en-GB"]), "fr");
});

import { isFiller, spokenChoice } from "./voice-scribe";
import { guardLiteral, literalMath } from "./voice-literal";

test("isFiller: greetings, mic checks and false starts are not working", () => {
  for (const s of ["hello", "Hello.", "um okay", "testing one two three", "can you hear me", "yeah so", "hi"]) assert.equal(isFiller(s), true, s);
  for (const s of ["so to get the probability you add one to two", "4/10 * 4/10", "x equals five", "two plus two"]) assert.equal(isFiller(s), false, s);
});

const SOUND = [
  "The reported estimate of 1 equals the relative frequency across all 60 tosses.",
  "The reported estimate of 1 is biased by selecting only heads.",
  "The reported estimate of 1 proves that heads is certain on the next toss.",
  "The reported estimate of 1 is more reliable because it uses fewer tosses.",
];

test("spokenChoice: a letter, a position, or the option read out", () => {
  assert.equal(spokenChoice("B", SOUND), 1);
  assert.equal(spokenChoice("bee", SOUND), 1);
  assert.equal(spokenChoice("option c", SOUND), 2);
  assert.equal(spokenChoice("I think it's D", SOUND), 3);
  assert.equal(spokenChoice("the second one", SOUND), 1);
  assert.equal(spokenChoice("it's biased by selecting only heads", SOUND), 1);
  assert.equal(spokenChoice("more reliable because it uses fewer tosses", SOUND), 3);
  assert.equal(spokenChoice("hmm the reported estimate", SOUND), -1);
  assert.equal(spokenChoice("a coin lands heads", SOUND), -1);
});

test("the answer box only gets what was said (founder's transcripts)", () => {
  const g = (model: string, said: string) => guardLiteral(model, "math", said).text;
  assert.equal(g("$\\frac{4}{10} \\times \\frac{4}{10} = \\frac{4}{25}$", "4/10 * 4/10"), "$\\frac{4}{10} \\times \\frac{4}{10}$");
  assert.equal(g("$P(M) = \\frac{2}{15} + \\frac{6}{10} \\times \\frac{5}{9} = \\frac{7}{15}$", "6/10 * 5/9 and then yeah those two together"), "$\\frac{6}{10} \\times \\frac{5}{9}$");
  assert.equal(g("$\\frac{6}{10} \\times \\frac{5}{9} = \\frac{1}{3}$", "6/10 * 5/9 and then"), "$\\frac{6}{10} \\times \\frac{5}{9}$");
  const said = "so to get the probability that the first counter is green you have to add one to two";
  assert.equal(g("$\\frac{4}{10}$", said), said);
  assert.equal(literalMath("6/10 * 5/9 and then"), "$\\frac{6}{10} \\times \\frac{5}{9}$");
});
