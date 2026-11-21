import { test } from "node:test";
import assert from "node:assert/strict";
import { FAMILY, GENERAL_HUES, familyFor, familyVars, hueFamilyFor, type SubjectFamily } from "./subject-family";

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

test("real workspace names: course codes and topic words", () => {
  const cases: [string, SubjectFamily][] = [
    ["B4 Thermodynamics Guide +3", "physics"],
    ["B4 Thermodynamics Short Answer Questions", "physics"],
    ["A 2.1.5 Data Transmission", "computing"],
    ["A 2.1.2 Modern Digital Infrastructures (2)", "computing"],
    ["Cl1 T3 AAHL ChainProductQuotientToughQuestions", "maths"],
    ["Cl1 AAHL T3 C1 Differentiation Tangents and normals", "maths"],
    ["Cl1 AAHL T3 Anti Differentiation", "maths"],
    ["AP Calc BC Unit 6 Integration", "maths"],
    ["AA HL Paper 1", "maths"],
    ["Geography Revision", "earth"],
    ["IB English Paper 2: Gatsby & Oryx and Crake", "english"],
    ["The Great Gatsby chapter summaries", "english"],
    ["Photosynthesis", "biology"],
    ["Macro: fiscal policy", "economics"],
    ["Cold War 1945-1991", "history"],
    ["Organic mechanisms", "chemistry"],
    ["Electric fields", "physics"],
    ["Cognitive approach studies", "psychology"],
  ];
  for (const [title, family] of cases) assert.equal(familyFor(title), family, title);
});

test("a subject name beats a topic word; vague names stay general", () => {
  assert.equal(familyFor("Biology: cell differentiation"), "biology");
  assert.equal(familyFor("History of the organic movement"), "history");
  assert.equal(familyFor("Economics: market equilibrium"), "economics");
  for (const t of ["Untitled", "Week 7 lecture slides", "IA draft v3 final", "Unit 5 revision", "notes", "Mock exam 2", "scan_2026_11_02.pdf", "AAHLX", "Calculator rules"]) assert.equal(familyFor(t), "general", t);
});

test("unmatched subjects: a stable hue from the seed, spread over the set", () => {
  assert.equal(hueFamilyFor("general", "cmu11ndx0010l29tmc6y35j27"), hueFamilyFor("general", "cmu11ndx0010l29tmc6y35j27"));
  assert.deepEqual(familyVars("general", "w1"), familyVars("general", "w1"));
  // A matched family never changes colour, whatever the seed.
  assert.equal(hueFamilyFor("biology", "anything"), "biology");
  assert.deepEqual(familyVars("biology", "anything"), familyVars("biology"));
  // No seed: the default purple.
  assert.equal(hueFamilyFor("general"), "general");
  assert.equal(hueFamilyFor("general", "  "), "general");
  assert.deepEqual(familyVars("general"), { "--tile-a": FAMILY.general.a, "--tile-b": FAMILY.general.b });
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const hue = hueFamilyFor("general", `workspace-${i}`);
    assert.ok(GENERAL_HUES.includes(hue));
    seen.add(hue);
  }
  assert.ok(seen.size >= 6, `only ${seen.size} hues over 60 ids`);
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
