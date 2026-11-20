/**
 * Rendered audit for Scribe topic notes: opens every generated note in the
 * real reader at phone width (390px) with a mocked API and fails a note whose
 * visible text still contains raw maths ("$…$" pairs or LaTeX commands, also
 * inside figure iframes), that scrolls sideways, or that throws.
 *
 * 1. NEXT_PUBLIC_API_URL=http://api.test npx next dev --webpack -p 3412
 * 2. node scripts/audit-topic-notes.mjs <notes dir> [origin] [course,…]
 *    notes dir: goscribe/server data/topic-notes (one JSON per topic).
 * Needs Playwright (PLAYWRIGHT_DIR, default /opt/node-tools/node_modules/).
 */
import { createRequire } from "node:module";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(process.env.PLAYWRIGHT_DIR ?? "/opt/node-tools/node_modules/");
const { chromium } = require("playwright");
const appRequire = createRequire(import.meta.url);
const superjson = (await import(appRequire.resolve("superjson"))).default;
const KATEX = join(process.cwd(), "node_modules/katex/dist/");

const [dir, origin = "http://localhost:3412", only] = process.argv.slice(2);
if (!dir) {
  console.error("usage: node scripts/audit-topic-notes.mjs <notes dir> [origin] [courses]");
  process.exit(2);
}
const courses = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith("_") && (!only || only.split(",").includes(d.name))).map((d) => d.name);
const notes = courses.flatMap((c) =>
  readdirSync(join(dir, c))
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ courseId: c, topicId: f.replace(/\.json$/, ""), path: join(dir, c, f) })),
);

const RAW = /\$[^$\s][^$]*\$|\\[a-zA-Z]{2,}/;
const iso = new Date().toISOString();
const browser = await chromium.launch();
const failures = [];
for (const n of notes) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const headers = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type, trpc-accept, x-trpc-source",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  };
  await page.route(/cdn\.tailwindcss\.com|unpkg\.com\/lucide|desmos\.com/, (r) => r.fulfill({ contentType: "application/javascript", body: "window.tailwind=window.tailwind||{};" }));
  await page.route(/cdn\.jsdelivr\.net\/npm\/katex@[^/]+\/dist\/(.*)$/, (r) => {
    const f = r.request().url().replace(/.*\/dist\//, "");
    return existsSync(KATEX + f) ? r.fulfill({ body: readFileSync(KATEX + f) }) : r.abort();
  });
  await page.route("http://api.test/**", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const u = new URL(req.url());
    const paths = u.pathname.replace(/^\/trpc\//, "").split(",");
    const batched = !!u.searchParams.get("batch");
    const out = paths.map((p) => {
      let v = null;
      if (p === "auth.getSession") v = { user: { id: "u1", name: "Audit", email: "a@x.test", emailVerified: true, role: null, preferredLanguage: "en" } };
      else if (p === "topicNote.get") v = { courseId: n.courseId, topicId: n.topicId, version: 1, label: "draft", updatedAt: iso, content: JSON.parse(readFileSync(n.path, "utf8")).content };
      else if (p === "workspace.getTree") v = { folders: [], workspaces: [] };
      return { result: { data: superjson.serialize(v) } };
    });
    return route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(batched ? out : out[0]) });
  });
  const issues = [];
  try {
    await page.goto(`${origin}/notes/${n.courseId}/${n.topicId}`, { waitUntil: "load", timeout: 120000 });
    await page.waitForSelector("article h2", { timeout: 60000 });
    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => {
      const art = document.querySelector("article");
      if (!art) return "";
      const clone = art.cloneNode(true);
      clone.querySelectorAll(".katex, textarea").forEach((e) => e.remove());
      return clone.innerText;
    });
    const m = RAW.exec(text);
    if (m) issues.push(`raw maths in page text: "${text.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\s+/g, " ")}"`);
    for (const frame of page.frames().slice(1)) {
      const ft = await frame.evaluate(() => {
        const b = document.body.cloneNode(true);
        b.querySelectorAll(".katex, script, style").forEach((e) => e.remove());
        return b.innerText;
      }).catch(() => "");
      const fm = RAW.exec(ft);
      if (fm) issues.push(`raw maths in a figure: "${ft.slice(Math.max(0, fm.index - 20), fm.index + 40).replace(/\s+/g, " ")}"`);
    }
    // Elements inside an intentional horizontal scroller (key-term row, wide maths) don't count.
    const sw = await page.evaluate(() => {
      const clipped = (el) => {
        for (let p = el.parentElement; p && p.tagName !== "ARTICLE"; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === "auto" || o === "scroll" || o === "hidden") return true;
        }
        return false;
      };
      return Math.max(0, ...[...document.querySelectorAll("article *")].filter((e) => !clipped(e)).map((e) => e.getBoundingClientRect().right));
    });
    if (sw > 392) issues.push(`content extends to ${Math.round(sw)}px at 390px`);
  } catch (e) {
    issues.push(`did not render: ${e.message.slice(0, 120)}`);
  }
  for (const e of errors) issues.push(`page error: ${e.slice(0, 120)}`);
  if (issues.length) failures.push({ note: `${n.courseId}/${n.topicId}`, issues });
  console.log(`${issues.length ? "FAIL" : "ok  "} ${n.courseId}/${n.topicId}${issues.length ? `\n     ${issues.join("\n     ")}` : ""}`);
  await ctx.close();
}
await browser.close();
console.log(`\n${notes.length - failures.length}/${notes.length} notes pass the rendered audit.`);
process.exit(failures.length ? 1 : 0);
