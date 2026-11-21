import { test } from "node:test";
import assert from "node:assert/strict";
import { FAMILY, familyFor, type SubjectFamily } from "./subject-family";

/** Every course in the catalog (CATALOG_VERSION 3, 37 courses): title → family. */
const CATALOG: [string, SubjectFamily][] = [
  ["AP Biology", "biology"],
  ["AP Calculus AB", "maths"],
  ["AP Calculus BC", "maths"],
  ["AP Chemistry", "chemistry"],
  ["AP Environmental Science", "earth"],
  ["AP Human Geography", "earth"],
  ["AP Macroeconomics", "economics"],
  ["AP Microeconomics", "economics"],
  ["AP Physics 1", "physics"],
  ["AP Physics 2", "physics"],
  ["AP Psychology", "psychology"],
  ["AP Statistics", "maths"],
  ["AP US Government and Politics", "society"],
  ["AP US History", "history"],
  ["AP World History: Modern", "history"],
  ["AQA A-level Biology", "biology"],
  ["AQA A-level Business", "business"],
  ["AQA A-level Chemistry", "chemistry"],
  ["AQA A-level Economics", "economics"],
  ["AQA A-level Physics", "physics"],
  ["AQA A-level Psychology", "psychology"],
  ["AQA A-level Sociology", "society"],
  ["AQA GCSE Biology", "biology"],
  ["AQA GCSE Combined Science: Trilogy", "science"],
  ["Edexcel A-level Biology A (Salters-Nuffield)", "biology"],
  ["Edexcel A-level Mathematics", "maths"],
  ["IB Biology", "biology"],
  ["IB Business Management", "business"],
  ["IB Chemistry", "chemistry"],
  ["IB Computer Science", "computing"],
  ["IB Economics", "economics"],
  ["IB Environmental Systems and Societies", "earth"],
  ["IB History", "history"],
  ["IB Mathematics: Analysis and Approaches", "maths"],
  ["IB Mathematics: Applications and Interpretation", "maths"],
  ["IB Physics", "physics"],
  ["OCR A-level Biology A", "biology"],
];

test("every catalog course maps to a family (none falls to general)", () => {
  assert.equal(CATALOG.length, 37);
  for (const [title, family] of CATALOG) assert.equal(familyFor(title), family, title);
});

test("student-typed subject names", () => {
  assert.equal(familyFor("Bio"), "biology");
  assert.equal(familyFor("Maths"), "maths");
  assert.equal(familyFor("English Lang & Lit"), "english");
  assert.equal(familyFor("English B"), "languages");
  assert.equal(familyFor("Spanish B"), "languages");
  assert.equal(familyFor("Theory of Knowledge"), "society");
  assert.equal(familyFor("My revision"), "general");
  assert.equal(familyFor(""), "general");
  assert.equal(familyFor(undefined), "general");
});

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

test("white text passes AA (4.5:1) on every family's base colour", () => {
  for (const [name, { a }] of Object.entries(FAMILY)) {
    const ratio = 1.05 / (lum(a) + 0.05);
    assert.ok(ratio >= 4.5, `${name} ${a}: ${ratio.toFixed(2)}`);
  }
});
