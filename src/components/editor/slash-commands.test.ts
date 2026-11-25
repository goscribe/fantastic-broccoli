import { test } from "node:test";
import assert from "node:assert/strict";
import { SLASH_COMMANDS, filterCommands, slashQuery } from "./slash-commands";

test("the / menu opens on a word typed after a space or at the start of a line", () => {
  assert.deepEqual(slashQuery("/"), { query: "", length: 1 });
  assert.deepEqual(slashQuery("Some text /equ"), { query: "equ", length: 4 });
  assert.equal(slashQuery("and/or"), null);
  assert.equal(slashQuery("1/2"), null);
  assert.equal(slashQuery("https://example.com/path"), null);
  assert.equal(slashQuery("/equation b"), null);
});

test("commands are found by label first, then keyword; hosts decide image and diagram", () => {
  const ctx = { image: true, diagram: false };
  assert.deepEqual(filterCommands(SLASH_COMMANDS, "equation", ctx).map((c) => c.id), ["equation", "equation-block"]);
  assert.deepEqual(filterCommands(SLASH_COMMANDS, "list", ctx).map((c) => c.id), ["bullets", "numbers"]);
  assert.deepEqual(filterCommands(SLASH_COMMANDS, "citation", ctx).map((c) => c.id), ["quote", "footnote", "reference"]);
  assert.equal(filterCommands(SLASH_COMMANDS, "math", ctx)[0].id, "equation");
  assert.equal(filterCommands(SLASH_COMMANDS, "hr", ctx)[0].id, "divider");
  // /diagram is reserved: offered only when the host can draw one.
  assert.equal(filterCommands(SLASH_COMMANDS, "", ctx).some((c) => c.id === "diagram"), false);
  assert.equal(filterCommands(SLASH_COMMANDS, "", { image: false, diagram: true }).some((c) => c.id === "diagram"), true);
  assert.equal(filterCommands(SLASH_COMMANDS, "", { image: false, diagram: false }).some((c) => c.id === "image"), false);
  assert.deepEqual(filterCommands(SLASH_COMMANDS, "zzz", ctx), []);
});
