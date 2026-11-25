import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluate, tryEvaluate, type CalcErrorCode } from "./engine";
import { formatFraction, formatNumber, formatResult, hasFraction, prettyResult, toSignificant } from "./format";
import { parseList, summarise } from "./stats";

const value = (expr: string, angle: "deg" | "rad" = "deg") => evaluate(expr, { angle }).value;
const near = (actual: number, expected: number, eps = 1e-9) => assert.ok(Math.abs(actual - expected) <= eps, `${actual} ≈ ${expected}`);
const fails = (expr: string, code: CalcErrorCode, angle: "deg" | "rad" = "deg") => {
  const outcome = tryEvaluate(expr, { angle });
  assert.equal(outcome.ok, false, `${expr} should fail`);
  if (!outcome.ok) {
    assert.equal(outcome.code, code, expr);
    assert.ok(outcome.message.length > 0);
  }
};

test("precedence: × ÷ before + −, powers before both, brackets first", () => {
  assert.equal(value("2+3×4"), 14);
  assert.equal(value("(2+3)×4"), 20);
  assert.equal(value("10−4−3"), 3);
  assert.equal(value("24÷4÷2"), 3);
  assert.equal(value("2×3^2"), 18);
  assert.equal(value("2+3*4-6/2"), 11);
});

test("powers go right to left, and a minus sign in front is applied last", () => {
  assert.equal(value("2^3^2"), 512);
  assert.equal(value("−2²"), -4);
  assert.equal(value("(−2)²"), 4);
  assert.equal(value("2^−1"), 0.5);
  assert.equal(value("3×−2"), -6);
  assert.equal(value("4³"), 64);
});

test("implicit multiplication: 2π, 3(4+1), (1+2)(3+4), 2sin(30)", () => {
  near(value("2π"), 2 * Math.PI);
  assert.equal(value("3(4+1)"), 15);
  assert.equal(value("(1+2)(3+4)"), 21);
  assert.equal(value("2sin(30)"), 1);
  fails("2 3", "syntax");
});

test("the keyboard's and the keys' spellings mean the same", () => {
  assert.equal(value("6*7"), value("6×7"));
  assert.equal(value("9/3"), value("9÷3"));
  assert.equal(value("5-8"), value("5−8"));
  near(value("pi"), Math.PI);
  assert.equal(value("sqrt(16)"), value("√(16)"));
  assert.equal(value("√16"), 4);
});

test("trig follows the angle unit", () => {
  assert.equal(value("sin(30)"), 0.5);
  assert.equal(value("cos(60)"), 0.5);
  assert.equal(value("tan(45)"), 1);
  assert.equal(value("sin(180)"), 0);
  assert.equal(value("cos(90)"), 0);
  assert.equal(value("sin(π÷6)", "rad"), 0.5);
  assert.equal(value("sin(π)", "rad"), 0);
  near(value("cos(π)", "rad"), -1);
  near(value("sin(30)", "rad"), Math.sin(30));
});

test("tan is refused where it is undefined", () => {
  fails("tan(90)", "tanUndefined");
  fails("tan(270)", "tanUndefined");
  fails("tan(π÷2)", "tanUndefined", "rad");
  assert.equal(value("tan(180)"), 0);
});

test("inverse trig answers in the angle unit and keeps to its domain", () => {
  assert.equal(value("asin(0.5)"), 30);
  assert.equal(value("sin⁻¹(0.5)"), 30);
  assert.equal(value("cos⁻¹(0.5)"), 60);
  assert.equal(value("arctan(1)"), 45);
  near(value("acos(0)", "rad"), Math.PI / 2);
  near(value("atan(1)", "rad"), Math.PI / 4);
  assert.equal(value("asin(1)"), 90);
  assert.equal(value("acos(−1)"), 180);
  fails("asin(2)", "inverseTrigDomain");
  fails("acos(−1.01)", "inverseTrigDomain");
  // atan takes any value.
  near(value("atan(1E9)"), 90, 1e-6);
});

test("logs, e and roots", () => {
  assert.equal(value("log(1000)"), 3);
  assert.equal(value("log(8,2)"), 3);
  near(value("ln(e)"), 1);
  near(value("ln(e^2)"), 2);
  near(value("e^1"), Math.E);
  near(value("exp(2)"), Math.E ** 2);
  assert.equal(value("∛(27)"), 3);
  assert.equal(value("root(−8,3)"), -2);
  assert.equal(value("abs(−3.5)"), 3.5);
  fails("ln(0)", "logDomain");
  fails("log(−1)", "logDomain");
  fails("√(−4)", "sqrtNegative");
  fails("(−8)^(1÷3)", "undefined");
});

test("factorial", () => {
  assert.equal(value("0!"), 1);
  assert.equal(value("5!"), 120);
  assert.equal(value("3!!"), 720);
  assert.equal(value("−3!"), -6);
  assert.equal(value("20!"), 2432902008176640000);
  assert.ok(Number.isFinite(value("170!")));
  fails("171!", "factorial");
  fails("2.5!", "factorial");
  fails("(−1)!", "factorial");
});

test("nCr and nPr, as keys (5C2) and as functions", () => {
  assert.equal(value("5C2"), 10);
  assert.equal(value("8C3"), 56);
  assert.equal(value("10P3"), 720);
  assert.equal(value("nCr(52,5)"), 2598960);
  assert.equal(value("nPr(5,5)"), 120);
  assert.equal(value("6C0"), 1);
  assert.equal(value("6C6"), 1);
  assert.equal(value("2×5C2"), 20);
  near(value("100C50"), 1.0089134454556419e29, 1e15);
  fails("3C5", "combination");
  fails("5C2.5", "combination");
  fails("5C(−1)", "combination");
});

test("percent", () => {
  assert.equal(value("50%"), 0.5);
  assert.equal(value("200×15%"), 30);
});

test("EXP: scientific notation with a capital E", () => {
  assert.equal(value("6.02E23"), 6.02e23);
  assert.equal(value("1.5E−3"), 0.0015);
  assert.equal(value("1.5E-3"), 0.0015);
  assert.equal(value("2E3×3"), 6000);
  assert.equal(value("3E8÷1.5E8"), 2);
  // A lowercase e is Euler's number, not an exponent.
  near(value("2e"), 2 * Math.E);
  fails("2E", "incomplete");
});

test("ANS is the last result", () => {
  const first = evaluate("7×6");
  assert.equal(evaluate("Ans+8", { ans: first }).value, 50);
  assert.equal(evaluate("2Ans", { ans: first }).value, 84);
  assert.equal(evaluate("ans÷6", { ans: first }).value, 7);
  // It carries the exact value, not the rounded display.
  const third = evaluate("1÷3");
  assert.equal(evaluate("Ans×3", { ans: third }).value, 1);
  fails("Ans+1", "noAnswer");
});

test("exact fractions: decimals and fractions add up exactly", () => {
  assert.equal(value("0.1+0.2"), 0.3);
  assert.equal(formatFraction(evaluate("1÷3+1÷6")), "1/2");
  assert.equal(formatFraction(evaluate("0.75")), "3/4");
  assert.equal(formatFraction(evaluate("√(9÷4)")), "3/2");
  assert.equal(formatFraction(evaluate("(2÷3)^2")), "4/9");
  assert.equal(formatFraction(evaluate("−7÷4")), "-7/4");
  // Whole numbers and irrational results have no fraction to show.
  assert.equal(hasFraction(evaluate("6÷3")), false);
  assert.equal(hasFraction(evaluate("√2")), false);
  assert.equal(hasFraction(evaluate("sin(30)")), false);
});

test("errors for input that is not a calculation", () => {
  fails("", "empty");
  fails("   ", "empty");
  fails("2+", "incomplete");
  fails("sin(", "incomplete");
  fails("×3", "syntax");
  fails("2++×3", "syntax");
  fails("()", "syntax");
  fails("(2+3))", "bracket");
  fails("sin 30", "needsBrackets");
  fails("foo(2)", "unknown");
  fails("2#3", "syntax");
  fails("log(1,2,3)", "args");
  fails("1÷0", "divideByZero");
  fails("5÷(3−3)", "divideByZero");
  fails("0^−1", "divideByZero");
  fails("9^9^9", "tooLarge");
  fails("x+1", "noVariable");
});

test("brackets left open at the end are closed for the student", () => {
  assert.equal(value("sin(30"), 0.5);
  assert.equal(value("2×(3+4"), 14);
});

test("x is the graph variable", () => {
  assert.equal(evaluate("x²−4", { x: 3 }).value, 5);
  assert.equal(evaluate("2x+1", { x: -2 }).value, -3);
});

test("nothing is ever run as code", () => {
  for (const attack of ["alert(1)", "constructor", "process.exit()", "globalThis", "(()=>1)()", "1;2", "`1`", "a=1"]) {
    assert.equal(tryEvaluate(attack).ok, false, attack);
  }
});

// ── Formatting ────────────────────────────────────────────────────────────

test("default display: ten significant figures, no float noise, no trailing zeros", () => {
  assert.equal(formatNumber(1 / 3), "0.3333333333");
  assert.equal(formatNumber(0.1 + 0.2), "0.3");
  assert.equal(formatNumber(2.5), "2.5");
  assert.equal(formatNumber(-14), "-14");
  assert.equal(formatNumber(123456789012), "123456789012");
  assert.equal(formatNumber(Math.PI), "3.141592654");
  assert.equal(formatNumber(0), "0");
});

test("very large and very small results use scientific notation", () => {
  assert.equal(formatNumber(6.02e23 * 2), "1.204×10^24");
  assert.equal(formatNumber(1.6e-19), "1.6×10^-19");
  assert.equal(formatNumber(0.00015), "0.00015");
  assert.equal(formatNumber(12345678901.5), "1.23456789×10^10");
});

test("3 s.f. and 4 s.f. round and keep significant zeros", () => {
  assert.equal(formatNumber(5.739159354, "sf3"), "5.74");
  assert.equal(formatNumber(5.739159354, "sf4"), "5.739");
  assert.equal(formatNumber(2.5, "sf3"), "2.50");
  assert.equal(formatNumber(123456, "sf3"), "123000");
  assert.equal(formatNumber(0.00123456, "sf3"), "0.00123");
  assert.equal(formatNumber(0.0499999, "sf3"), "0.0500");
  assert.equal(formatNumber(999.96, "sf4"), "1000");
  assert.equal(formatNumber(-0.30625, "sf3"), "-0.306");
  assert.equal(formatNumber(6.02214076e23, "sf4"), "6.022×10^23");
  assert.equal(toSignificant(0, 3), "0.00");
});

test("fraction ↔ decimal where the result is exact", () => {
  const r = evaluate("7÷4");
  assert.equal(formatResult(r), "1.75");
  assert.equal(formatResult(r, { fraction: true }), "7/4");
  // No exact fraction: the decimal stays.
  assert.equal(formatResult(evaluate("√2"), { fraction: true }), "1.414213562");
  assert.equal(formatResult(evaluate("7÷4"), { precision: "sf3" }), "1.75");
});

test("the screen shows a real minus sign and a raised exponent", () => {
  assert.equal(prettyResult("-1.6×10^-19"), "−1.6 × 10⁻¹⁹");
  assert.equal(prettyResult("-7/4"), "−7/4");
  assert.equal(prettyResult("5.74"), "5.74");
});

// ── Stats ─────────────────────────────────────────────────────────────────

test("a list is read from commas, spaces, semicolons and new lines", () => {
  assert.deepEqual(parseList("3, 5 8\n12;−2.5").values, [3, 5, 8, 12, -2.5]);
  assert.deepEqual(parseList("1e3, .5, +4").values, [1000, 0.5, 4]);
  assert.deepEqual(parseList("4, abc, 7, 1..2"), { values: [4, 7], invalid: ["abc", "1..2"] });
  assert.deepEqual(parseList("  ").values, []);
});

test("mean, median, both standard deviations, sum and n", () => {
  const s = summarise([2, 4, 4, 4, 5, 5, 7, 9])!;
  assert.equal(s.n, 8);
  assert.equal(s.sum, 40);
  assert.equal(s.mean, 5);
  assert.equal(s.median, 4.5);
  assert.equal(s.sdPopulation, 2);
  near(s.sdSample!, Math.sqrt(32 / 7));
  assert.equal(s.min, 2);
  assert.equal(s.max, 9);
});

test("median of an odd list, and the sample SD needs two values", () => {
  assert.equal(summarise([9, 1, 5])!.median, 5);
  const one = summarise([4])!;
  assert.equal(one.sdPopulation, 0);
  assert.equal(one.sdSample, null);
  assert.equal(summarise([]), null);
});

test("names run together are read apart: AnsC2, xsin(x), 2πe", () => {
  assert.equal(evaluate("AnsC2", { ans: { value: 5 } }).value, 10);
  near(evaluate("xsin(x)", { x: 2, angle: "rad" }).value, 2 * Math.sin(2));
  near(value("2πe"), 2 * Math.PI * Math.E);
  assert.equal(value("SIN(30)"), 0.5);
  fails("sec(2)", "unknown");
  fails("c", "unknown");
});
