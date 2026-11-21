import { test } from "node:test";
import assert from "node:assert/strict";
import { matchLocal, paletteRows, resultSubline, safeHref, selectable, type LocalItem, type SearchResponse } from "./search";

const local: LocalItem[] = [
  { id: "ws-w1", label: "Biology", hint: "Subject", href: "/workspace/w1", kind: "subject" },
  { id: "page-home", label: "Home", hint: "Page", href: "/", kind: "page" },
  { id: "page-mistakes", label: "Mistakes", hint: "Page", href: "/mistakes", kind: "page" },
];
const r = (type: "session" | "material" | "mistake" | "topic" | "note", id: string, href: string) => ({
  type, id, title: id, preview: `preview ${id}`, workspaceId: "w1", workspaceTitle: "Biology", link: { kind: type, href },
});
const server: SearchResponse = {
  query: "osm", total: 4, hasLocalResults: true,
  groups: [
    { type: "material", results: [r("material", "u1", "/workspace/w1?file=u1")] },
    { type: "session", results: [r("session", "s1", "/workspace/w1/session/s1")] },
    { type: "note", results: [r("note", "n1", "/library/ib-biology/b2"), r("note", "bad", "https://evil.test/x")] },
    { type: "mistake", results: [r("mistake", "m1", "/mistakes?mistake=m1")] },
  ],
};

test("server groups come in a fixed order under headings, AI search last", () => {
  const rows = paletteRows({ query: "osm", local: matchLocal(local, "osm"), server });
  assert.deepEqual(
    rows.map((x) => (x.row === "heading" ? `#${x.group}` : x.row === "result" ? x.result.id : x.row)),
    ["#session", "s1", "#mistake", "m1", "#note", "n1", "#material", "u1", "ai"],
  );
  // Headings are not selectable.
  assert.equal(selectable(rows).length, 5);
  assert.equal(rows.at(-1)?.row, "ai");
});

test("results keep the server's link when it is an app path, and are dropped otherwise", () => {
  const rows = paletteRows({ query: "osm", local: [], server });
  const hrefs = rows.flatMap((x) => (x.row === "result" ? [x.href] : []));
  assert.ok(hrefs.includes("/mistakes?mistake=m1"));
  assert.ok(hrefs.includes("/workspace/w1?file=u1"));
  assert.ok(!hrefs.some((h) => h.includes("evil")));
  assert.equal(safeHref("//evil.test"), null);
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref("/library/a/b"), "/library/a/b");
});

test("local subjects and pages match as you type; no AI row for one letter", () => {
  const rows = paletteRows({ query: "m", local: matchLocal(local, "m"), server: null });
  assert.deepEqual(rows.map((x) => (x.row === "local" ? x.item.label : x.row === "heading" ? `#${x.group}` : x.row)), ["#pages", "Home", "Mistakes"]);
  // Empty query: everything local under its heading, no AI row.
  const empty = paletteRows({ query: "", local, server: null });
  assert.deepEqual(empty.map((x) => (x.row === "heading" ? `#${x.group}` : x.row)), ["#subjects", "local", "#pages", "local", "local"]);
});

test("a result's line under the title names the subject and the preview once", () => {
  assert.equal(resultSubline(r("session", "s1", "/x")), "Biology · preview s1");
  assert.equal(resultSubline({ ...r("session", "s1", "/x"), preview: "Biology" }), "Biology");
  assert.equal(resultSubline({ ...r("note", "n1", "/x"), workspaceTitle: null }), "preview n1");
});
