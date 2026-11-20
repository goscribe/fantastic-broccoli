import { test } from "node:test";
import assert from "node:assert/strict";
import katex from "katex";
import { latexToUnicode, looksLikeBareLatex, prerenderFigureMath, type RenderTex } from "./figure-math";

const render: RenderTex = (tex, display) => {
  try {
    return katex.renderToString(tex, { throwOnError: true, displayMode: display });
  } catch {
    return null;
  }
};
const tagged: RenderTex = (tex, display) => (tex.includes("\\bad") ? null : `<K${display ? " d" : ""}>${tex}</K>`);

test("renders maths-class cells like R07's complexity table, including \\log", () => {
  const html = '<table><tr><td>Binary search</td><td><span class="math">O(\\log n)</span></td><td><span class="math">O(n\\log n)</span></td></tr></table>';
  const out = prerenderFigureMath(html, tagged);
  assert.ok(out.includes('<span class="math"><K>O(\\log n)</K></span>'));
  assert.ok(out.includes("<K>O(n\\log n)</K>"));
  assert.ok(prerenderFigureMath(html, render).includes('class="katex"'));
});

test("renders bare TeX, $…$, \\(…\\) and \\[…\\] in text, but not currency or prose", () => {
  assert.equal(prerenderFigureMath("<td>O(n\\log n)</td>", tagged), "<td><K>O(n\\log n)</K></td>");
  assert.equal(prerenderFigureMath("<p>Energy \\(E=hf\\) and \\[x^2\\]</p>", tagged), "<p>Energy <K>E=hf</K> and <K d>x^2</K></p>");
  assert.equal(prerenderFigureMath("<p>Cost $5 and $10 each</p>", tagged), "<p>Cost $5 and $10 each</p>");
  assert.equal(prerenderFigureMath("<p>Each step costs $x$ units here</p>", tagged), "<p>Each step costs <K>x</K> units here</p>");
  assert.equal(prerenderFigureMath("<p>The change \\Delta E is released as light here</p>", tagged), "<p>The change <K>\\Delta E</K> is released as light here</p>");
});

test("detects common commands, not only a handful", () => {
  for (const t of ["\\log n", "\\sin x", "\\alpha", "\\rightarrow", "C_{11}", "\\mathrm{J}", "\\approx 3"]) assert.ok(looksLikeBareLatex(t), t);
  assert.ok(!looksLikeBareLatex("C:\\Users path"));
  assert.ok(!looksLikeBareLatex("plain words only"));
});

test("leaves scripts, styles, code and nested markup alone; decodes entities", () => {
  const html = '<script>var s="\\\\frac{a}{b}";</script><style>.x{}</style><code>$HOME</code><span class="math">a<b>b</b></span>';
  assert.equal(prerenderFigureMath(html, tagged), html);
  assert.equal(prerenderFigureMath("<td>$a &lt; b$</td>", tagged), "<td><K>a < b</K></td>");
  assert.equal(prerenderFigureMath('<span class="math">\\bad{</span>', tagged), '<span class="math">\\bad{</span>');
});

test("turns TeX in SVG labels into Unicode and gives fixed-size SVGs a viewBox (R09)", () => {
  const out = prerenderFigureMath('<svg width="700" height="320"><text>E_3=-1.0\\times10^{-19}\\,\\mathrm{J}</text><text>\\Delta E_A</text></svg>', tagged);
  assert.ok(out.startsWith('<svg viewBox="0 0 700 320" width="700" height="320">'));
  assert.ok(out.includes("E₃=-1.0×10⁻¹⁹\u2009J"));
  assert.ok(out.includes("ΔE_A") || out.includes("ΔEₐ"));
  assert.equal(latexToUnicode("O(n\\log n)"), "O(n log n)");
  assert.ok(prerenderFigureMath('<svg viewBox="0 0 10 10" width="10" height="10"></svg>', tagged).startsWith('<svg viewBox="0 0 10 10" width'));
});
