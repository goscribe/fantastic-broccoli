/**
 * Model bake-off for the flashcard generator. Runs scripts/generate-flashcards.mjs
 * (the real harness: same prompt, checks and fact-check pass) once per
 * candidate model on the same sample of topics, then has judge models score
 * every deck blind against its source note. Prints a table and writes
 * <out>/report.json and <out>/report.md.
 *
 *   OPENROUTER_API_KEY=… node --experimental-strip-types scripts/eval-flashcards.mjs \
 *     --models deepseek/deepseek-v4.1-flash,z-ai/glm-5.3-flash \
 *     [--judges anthropic/claude-opus-5.5,google/gemini-4-carbon] [--topics 10] [--seed 7] [--out /tmp/fc-eval]
 *
 * Scores (1–5, from each judge, averaged): accuracy (every card true and
 * supported by the note), coverage (the note's key ideas), cards (one clear
 * question each, a fair answer, nothing given away), preview (the first three
 * are the topic's most important ideas), format (maths and wording read well).
 * Judges also list factual errors, counted per deck.
 */
import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values: opt } = parseArgs({
  options: {
    models: { type: "string" },
    judges: { type: "string", default: "anthropic/claude-opus-5.5,google/gemini-4-carbon" },
    topics: { type: "string", default: "10" },
    seed: { type: "string", default: "7" },
    out: { type: "string", default: "/tmp/fc-eval" },
    api: { type: "string", default: "https://api.scribe.study" },
    "skip-generate": { type: "boolean", default: false },
  },
});
const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY || !opt.models) {
  console.error("usage: OPENROUTER_API_KEY=… node --experimental-strip-types scripts/eval-flashcards.mjs --models a,b [--judges x,y]");
  process.exit(2);
}
const models = opt.models.split(",");
const judges = opt.judges.split(",");
const slug = (m) => m.replace(/[^a-z0-9]+/gi, "_");

async function api(path, input) {
  const qs = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const body = await (await fetch(`${opt.api}/trpc/publicNotes.${path}${qs}`)).json();
  return body.result.data.json;
}

/* ---------- A fixed, varied sample: one topic from each of N courses (seeded) ---------- */
let seed = Number(opt.seed);
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const courses = (await api("courses")).filter((c) => c.noteCount > 0);
const picked = [...courses].sort(() => rand() - 0.5).slice(0, Number(opt.topics));
const sample = [];
for (const c of picked) {
  const course = await api("course", { courseId: c.id });
  const rows = course.units.flatMap((u) => u.topics).filter((t) => t.note && !t.locked);
  const row = rows[Math.floor(rand() * rows.length)];
  if (row) sample.push(`${c.id}/${row.id}`);
}
console.log(`sample: ${sample.join(", ")}`);

/* ---------- Generate with each candidate (in parallel, one process per model) ---------- */
function run(model) {
  return new Promise((resolve) => {
    const dir = join(opt.out, slug(model));
    const p = spawn(
      process.execPath,
      ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/generate-flashcards.mjs", "--model", model, "--only", sample.join(","), "--force", "--concurrency", "5", "--out", dir],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let log = "";
    p.stdout.on("data", (d) => (log += d));
    p.stderr.on("data", (d) => (log += d));
    p.on("close", () => resolve(log));
  });
}
if (!opt["skip-generate"]) {
  const logs = await Promise.all(models.map(run));
  logs.forEach((l, i) => console.log(`\n== ${models[i]}\n${l.trim().split("\n").slice(-4).join("\n")}`));
}

async function lastRun(model) {
  const dir = join(opt.out, slug(model), "_runs");
  const files = (await readdir(dir)).sort();
  return JSON.parse(await readFile(join(dir, files.at(-1)), "utf8"));
}

/* ---------- Judge every deck, blind ---------- */
const noteCache = new Map();
async function noteFor(pair) {
  if (!noteCache.has(pair)) {
    const [courseId, topicId] = pair.split("/");
    const t = await api("topic", { courseId, topicId });
    const c = t.note.content;
    const text = c.sections
      .map((s) => `## ${s.heading}\n${s.blocks.map((b) => b.text ?? b.items?.map((i) => `- ${i.text}`).join("\n") ?? (b.type === "example" ? `${b.title}: ${b.problem} → ${b.steps.join(" ")} = ${b.answer}` : b.type === "table" ? `${b.headers.join(" | ")}\n${b.rows.map((r) => r.join(" | ")).join("\n")}` : b.paragraphs?.join(" ") ?? "")).join("\n")}`)
      .join("\n\n");
    noteCache.set(pair, `# ${c.topicCode} ${c.topicName} (${t.course.title})\n\n${text}\n\nKey terms: ${c.keyTerms.map((k) => `${k.term}: ${k.definition}`).join("; ")}`);
  }
  return noteCache.get(pair);
}

const SCORE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["accuracy", "coverage", "cards", "preview", "format", "errors", "comment"],
  properties: {
    accuracy: { type: "integer" },
    coverage: { type: "integer" },
    cards: { type: "integer" },
    preview: { type: "integer" },
    format: { type: "integer" },
    errors: { type: "array", items: { type: "string" } },
    comment: { type: "string" },
  },
};
const JUDGE_PROMPT = `You grade a deck of revision flashcards written from a topic note for 16–18 year old exam students. Be strict and consistent; a 5 means you would ship it unchanged.
Score 1–5 each:
- accuracy: every card is true and supported by the note (one wrong fact caps this at 3; two or more at 2).
- coverage: the deck covers the note's key ideas without padding.
- cards: each card asks one clear thing, has one fair answer, and the front or hint never gives the answer away.
- preview: the first three cards are the topic's most important ideas (they are the free preview).
- format: clear, concise wording; maths written correctly in $…$ LaTeX.
errors: list each factual error as "Card N: …" (empty if none). comment: one sentence.
Reply with JSON only.`;

async function judge(judgeModel, note, deck) {
  const list = deck.cards.map((c, i) => `${i + 1}. [${c.kind}] Q: ${c.front}\n   A: ${c.back}${c.hint ? `\n   Hint: ${c.hint}` : ""}`).join("\n");
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: judgeModel,
          temperature: 0,
          max_tokens: 3000,
          messages: [
            { role: "system", content: JUDGE_PROMPT },
            { role: "user", content: `The note:\n\n${note}\n\nThe deck:\n\n${list}` },
          ],
          response_format: { type: "json_schema", json_schema: { name: "grade", strict: true, schema: SCORE_SCHEMA } },
          usage: { include: true },
        }),
      });
      const body = await res.json();
      if (!res.ok || body.error) throw new Error(body.error?.message ?? res.status);
      const t = body.choices[0].message.content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
      const g = JSON.parse(t.match(/\{[\s\S]*\}/)[0]);
      judgeCost += body.usage?.cost ?? 0;
      return g;
    } catch (e) {
      if (attempt === 4) return { error: String(e.message ?? e) };
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

let judgeCost = 0;
const AXES = ["accuracy", "coverage", "cards", "preview", "format"];
const rows = [];
for (const model of models) {
  const run = await lastRun(model);
  const tasks = [];
  for (const pair of sample) {
    const [courseId, topicId] = pair.split("/");
    let deck = null;
    try {
      deck = JSON.parse(await readFile(join(opt.out, slug(model), courseId, `${topicId}.json`), "utf8"));
    } catch {
      /* failed for this topic */
    }
    if (!deck) continue;
    const note = await noteFor(pair);
    for (const j of judges) tasks.push(judge(j, note, deck).then((g) => ({ pair, judge: j, g, cards: deck.cards.length })));
  }
  const grades = await Promise.all(tasks);
  const ok = grades.filter((x) => !x.g.error);
  const mean = (f) => (ok.length ? ok.reduce((s, x) => s + f(x), 0) / ok.length : NaN);
  const stats = run.topics.map((t) => t.stats);
  const written = run.written;
  rows.push({
    model,
    written,
    failed: run.failed,
    passRate: written / sample.length,
    firstTry: stats.filter((s) => s.attempts === 1).length / sample.length,
    secondsPerDeck: stats.reduce((s, x) => s + x.ms, 0) / stats.length / 1000,
    costPerDeck: stats.reduce((s, x) => s + x.cost, 0) / stats.length,
    cards: mean((x) => x.cards),
    ...Object.fromEntries(AXES.map((a) => [a, mean((x) => x.g[a])])),
    overall: mean((x) => AXES.reduce((s, a) => s + x.g[a], 0) / AXES.length),
    errorsPerDeck: mean((x) => x.g.errors.length),
    judgeFailures: grades.length - ok.length,
    grades,
  });
  console.log(`judged ${model}`);
}

rows.sort((a, b) => b.overall - a.overall);
const f = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "–");
const md = [
  `# Flashcard model eval`,
  ``,
  `Sample (${sample.length} topics): ${sample.join(", ")}`,
  `Judges: ${judges.join(", ")} · judging cost $${judgeCost.toFixed(2)}`,
  ``,
  `| Model | Overall | Accuracy | Coverage | Cards | Preview | Format | Errors/deck | Written | 1st try | s/deck | $/deck | $ for all 1,297 |`,
  `|---|---|---|---|---|---|---|---|---|---|---|---|---|`,
  ...rows.map((r) => `| ${r.model} | **${f(r.overall)}** | ${f(r.accuracy)} | ${f(r.coverage)} | ${f(r.cards)} | ${f(r.preview)} | ${f(r.format)} | ${f(r.errorsPerDeck)} | ${r.written}/${sample.length} | ${f(r.firstTry * 100, 0)}% | ${f(r.secondsPerDeck, 0)} | ${f(r.costPerDeck, 4)} | ${f(r.costPerDeck * 1297, 2)} |`),
  ``,
  `## Factual errors found`,
  ...rows.flatMap((r) => [`### ${r.model}`, ...r.grades.flatMap((x) => (x.g.errors ?? []).map((e) => `- ${x.pair} (${x.judge.split("/")[1]}): ${e}`)), ""]),
].join("\n");
await mkdir(opt.out, { recursive: true });
await writeFile(join(opt.out, "report.json"), JSON.stringify({ sample, judges, judgeCost, rows }, null, 2));
await writeFile(join(opt.out, "report.md"), md);
console.log(`\n${md.split("## Factual")[0]}`);
