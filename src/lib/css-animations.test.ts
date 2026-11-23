import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every animation the app's styles and components name must exist. An
 * `animation: x …` whose @keyframes was renamed or removed does nothing, and
 * if the element starts hidden (opacity 0 until the animation runs) it stays
 * hidden while still taking up its space.
 */
const SRC = new URL("..", import.meta.url).pathname;

function files(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files(path, ext, out);
    else if (ext.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const cssFiles = files(SRC, /\.css$/).map((path) => ({ path: path.slice(SRC.length), css: strip(readFileSync(path, "utf8")) }));
const allCss = cssFiles.map((f) => f.css).join("\n");
const codeFiles = files(SRC, /\.tsx?$/).map((path) => ({ path: path.slice(SRC.length), code: readFileSync(path, "utf8") }));
/** Keyframes from the stylesheets, and from the few components that carry their own in a <style> element. */
const keyframes = new Set([...(allCss + codeFiles.map((f) => f.code).join("\n")).matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
/** Tailwind's own. */
const BUILT_IN = new Set(["spin", "ping", "pulse", "bounce"]);
/** Words of the `animation` shorthand that are not a name. */
const KEYWORD =
  /^(none|initial|inherit|unset|revert|infinite|normal|reverse|alternate|alternate-reverse|forwards|backwards|both|running|paused|linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end)$/;

function animationNames(value: string): string[] {
  return value
    .replace(/\([^()]*(\([^()]*\)[^()]*)*\)/g, "(…)") // var(), calc(), cubic-bezier(), steps()
    .split(",")
    .flatMap((one) => one.trim().split(/\s+/))
    .filter((word) => /^[a-zA-Z_][\w-]*$/.test(word) && !KEYWORD.test(word));
}

test("every animation named in a stylesheet has its @keyframes", () => {
  assert.ok(keyframes.size > 20, "the stylesheets were read");
  const missing: string[] = [];
  for (const { path, css } of cssFiles)
    for (const m of css.matchAll(/(?:^|[;{\s])(?:animation|animation-name|--animate-[\w-]+)\s*:\s*([^;}]+)/g))
      for (const name of animationNames(m[1].replace(/!important/g, ""))) if (!keyframes.has(name) && !BUILT_IN.has(name)) missing.push(`${path}: ${name}`);
  assert.deepEqual(missing, []);
});

test("every animate-* class and inline animation used by a component exists", () => {
  const classes = new Set([...allCss.matchAll(/\.(animate-[\w-]+)/g)].map((m) => m[1]));
  const themed = new Set([...allCss.matchAll(/--(animate-[\w-]+)\s*:/g)].map((m) => m[1]));
  /** Tailwind utilities that are not an animation of ours. */
  const utility = new Set(["animate-none", ...[...BUILT_IN].map((n) => `animate-${n}`)]);
  const missing: string[] = [];
  for (const { path: where, code } of codeFiles) {
    // The class must be the whole token (not the start of "animate-in-…" prose or a longer name).
    for (const m of code.matchAll(/(?<![\w-])(animate-[a-z][a-z0-9-]*)(?![\w-])/g))
      if (!classes.has(m[1]) && !themed.has(m[1]) && !utility.has(m[1])) missing.push(`${where}: ${m[1]}`);
    for (const m of code.matchAll(/animate-\[([a-zA-Z][\w-]*)_/g)) if (!keyframes.has(m[1]) && !BUILT_IN.has(m[1])) missing.push(`${where}: animate-[${m[1]}…]`);
    for (const m of code.matchAll(/\banimation(?:Name)?:\s*[`"']([^`"'$]+)/g))
      for (const name of animationNames(m[1])) if (!keyframes.has(name) && !BUILT_IN.has(name)) missing.push(`${where}: ${name}`);
  }
  assert.deepEqual(missing, []);
});
