/**
 * Flashcard generator for the public course pages: an OpenRouter model reads
 * each topic's published Scribe note and writes a deck; the harness checks it
 * (src/lib/notes-public/flashcard-deck.ts), has a second pass fact-check it
 * against the note, feeds any problems back for a rewrite, and saves the deck
 * to src/data/flashcards/<courseId>/<topicId>.json.
 *
 *   OPENROUTER_API_KEY=… node --experimental-strip-types scripts/generate-flashcards.mjs [options]
 *
 *   --courses ib-physics,ap-biology   only these courses (default: every course with notes)
 *   --topics a-1,a-2                  only these topic ids
 *   --only ib-physics/a-1,ap-biology/1-1   exactly these topics
 *   --limit 20                        stop after this many decks
 *   --model anthropic/claude-haiku-5.5
 *   --reviewer <model>                fact-check model (default: same as --model)
 *   --no-review                       skip the fact-check pass
 *   --concurrency 6
 *   --force                           rewrite decks that are already up to date
 *   --dry-run                         list what would be generated, call no model
 *   --api https://api.scribe.study    the public notes API
 *   --out src/data/flashcards
 *
 * Decks already written from the current note version are skipped, so a run
 * can be stopped and started again. A report of every run (decks written,
 * failures, tokens and cost) goes to <out>/_runs/<timestamp>.json.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { checkCards, DECK_LIMITS, FLASHCARD_KINDS, SAFE_ID } from "../src/lib/notes-public/flashcard-deck.ts";

const { values: opt } = parseArgs({
  options: {
    courses: { type: "string" },
    topics: { type: "string" },
    only: { type: "string" },
    limit: { type: "string" },
    model: { type: "string", default: "anthropic/claude-haiku-5.5" },
    reviewer: { type: "string" },
    "no-review": { type: "boolean", default: false },
    concurrency: { type: "string", default: "6" },
    force: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    api: { type: "string", default: process.env.NEXT_PUBLIC_API_URL || "https://api.scribe.study" },
    out: { type: "string", default: "src/data/flashcards" },
  },
});

const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY && !opt["dry-run"]) {
  console.error("OPENROUTER_API_KEY is not set (or pass --dry-run).");
  process.exit(2);
}
const MODEL = opt.model;
const REVIEWER = opt.reviewer ?? MODEL;
const MAX_ATTEMPTS = 3;
const only = (s) => (s ? new Set(s.split(",").map((x) => x.trim()).filter(Boolean)) : null);
const onlyPairs = only(opt.only);
const onlyCourses = only(opt.courses) ?? (onlyPairs ? new Set([...onlyPairs].map((p) => p.split("/")[0])) : null);
const onlyTopics = only(opt.topics);
const limit = opt.limit ? Number(opt.limit) : Infinity;

/* ------------------------------ Public notes API ------------------------------ */

async function api(path, input) {
  const qs = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${opt.api}/trpc/publicNotes.${path}${qs}`);
      const body = await res.json();
      if (!res.ok || body.error) throw new Error(body.error?.json?.message ?? `HTTP ${res.status}`);
      return body.result.data.json;
    } catch (e) {
      if (attempt >= 4) throw new Error(`publicNotes.${path}: ${e.message}`);
      await sleep(1000 * 2 ** attempt);
    }
  }
}

/* ------------------------------ The note as text ------------------------------ */

function noteText(content) {
  const out = [`# ${content.topicCode} ${content.topicName}`, `Unit: ${content.unitCode} ${content.unitName}`, `Objective: ${content.objectiveLine}`, ""];
  for (const s of content.sections) {
    out.push(`## [section ${s.id}] ${s.heading}`);
    for (const b of s.blocks) {
      if (b.type === "paragraph") out.push(b.text);
      else if (b.type === "bullets") b.items.forEach((it) => out.push(`- ${it.text}${it.sub.length ? ` (${it.sub.join("; ")})` : ""}`));
      else if (b.type === "callout") out.push(`${b.kind === "mistake" ? "Common mistake" : "Tip"}: ${b.text}`);
      else if (b.type === "example") out.push(`Worked example: ${b.title}. ${b.problem} Steps: ${b.steps.join(" → ")} Answer: ${b.answer}`);
      else if (b.type === "table") out.push(`Table (${b.caption}): ${b.headers.join(" | ")}; ${b.rows.map((r) => r.join(" | ")).join("; ")}`);
      else if (b.type === "deeper") out.push(`Going deeper, ${b.title}: ${b.paragraphs.join(" ")}`);
    }
    out.push("");
  }
  if (content.keyTerms.length) {
    out.push("## Key terms");
    content.keyTerms.forEach((k) => out.push(`- ${k.term} [section ${k.sectionId}]: ${k.definition}`));
    out.push("");
  }
  if (content.recall.length) {
    out.push("## Recall questions (with model answers)");
    content.recall.forEach((r) => out.push(`- ${r.question} → ${r.modelAnswer}`));
  }
  return out.join("\n");
}

/* ------------------------------ Prompts ------------------------------ */

const CARD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["cards"],
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "front", "back", "hint", "sectionId"],
        properties: {
          kind: { type: "string", enum: FLASHCARD_KINDS },
          front: { type: "string" },
          back: { type: "string" },
          hint: { type: "string" },
          sectionId: { type: "string" },
        },
      },
    },
  },
};

const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["issues"],
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["card", "problem"],
        properties: { card: { type: "integer" }, problem: { type: "string" } },
      },
    },
  },
};

function systemPrompt(content, courseTitle) {
  const us = content.locale === "en-US";
  return `You write revision flashcards for ${courseTitle} students, from one topic note written by Scribe.

Write ${DECK_LIMITS.minCards + 2}–${DECK_LIMITS.maxCards - 2} cards that cover the whole note, in the order a student should learn them.
- The FIRST THREE cards are the free preview anyone sees: make them the three most important ideas of the topic, the ones that make a student want the rest. Never open with trivia.
- Mix kinds: "term" (a key term → its definition), "concept" (why or how something works), "formula" (an equation, what each symbol means and its unit), "process" (steps in order), "mistake" (a common error → why it is wrong and what is right), "example" (a quick calculation or application with its answer).
- Only "formula" or "example" cards if the note actually has equations or calculations.
- Cover every key idea in the note: each section's main point, each key term, each worked example, each common mistake. (Check this silently; do not write the list out.)
- Front: ONE clear question, under ${DECK_LIMITS.frontMax} characters. No "and" joining two questions, no yes/no questions (ask "what", "why", "how", "which"), and never give the answer away.
- No two cards may test the same fact, even worded differently.
- Back: the answer a student could say from memory, under ${DECK_LIMITS.backMax} characters. Lead with the answer, then at most one sentence of why. **Bold** the key word.
- Hint: a short nudge (under ${DECK_LIMITS.hintMax} characters) that points to WHERE to think (a related idea, the first step, a comparison), never a word or phrase from the answer. If every hint you can think of would leak the answer, use "". Hints are optional: about half the cards should have one.
- sectionId: the id of the note section the card comes from (e.g. "s2"), or "" if it spans the note.
- Every fact must come from the note. Do not add facts the note does not state.
- Every variable, equation, number with a unit and chemical formula goes in LaTeX between single $ signs, like the note ($v = u + at$, $N$, $4.2\\,\\text{kJ}$). In the JSON, write every LaTeX backslash doubled ("$\\\\frac{a}{b}$"). Never use $$ display maths.
- ${us ? "US" : "UK"} spelling. Plain, friendly language for a 16–18 year old. No emoji.

Reply with JSON only: {"cards":[{"kind","front","back","hint","sectionId"}]}`;
}

/* ------------------------------ OpenRouter ------------------------------ */

const usage = { prompt: 0, completion: 0, cost: 0, calls: 0 };
const newMeter = () => ({ prompt: 0, completion: 0, cost: 0, calls: 0 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function chat(model, messages, schema, name, meter) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${KEY}`,
          "content-type": "application/json",
          "x-title": "Scribe flashcard generator",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.4,
          max_tokens: 6000,
          response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
          usage: { include: true },
        }),
      });
    } catch (e) {
      if (attempt >= 5) throw e;
      await sleep(1500 * 2 ** attempt);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= 5) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    const body = await res.json();
    if (!res.ok || body.error) throw new Error(`OpenRouter ${res.status}: ${body.error?.message ?? JSON.stringify(body).slice(0, 300)}`);
    for (const m of [usage, meter].filter(Boolean)) {
      m.calls++;
      m.prompt += body.usage?.prompt_tokens ?? 0;
      m.completion += body.usage?.completion_tokens ?? 0;
      m.cost += body.usage?.cost ?? 0;
    }
    const text = body.choices?.[0]?.message?.content ?? "";
    return { text, parsed: parseJson(text) };
  }
}

/**
 * LaTeX written into JSON with single backslashes: "\\frac" would parse as a
 * form feed + "rac" and "\\ " not at all. Doubles a backslash that starts a
 * LaTeX command (two or more letters) or is not a valid JSON escape. Card text
 * never needs a real tab or newline, so nothing is lost.
 */
function repairEscapes(t) {
  return t.replace(/(?<!\\)\\(?=[a-zA-Z]{2,}|[^"\\/bfnrtu])/g, "\\\\");
}

/** Models that ignore response_format still usually send JSON, sometimes fenced or after some prose. */
function parseJson(text) {
  const t = repairEscapes(text.trim()).replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(t);
  } catch {
    // Try each "{" from the first object that names a known key (cards / issues) to the last "}".
    const end = t.lastIndexOf("}");
    for (const m of t.matchAll(/\{\s*"(?:cards|issues)"/g)) {
      try {
        return JSON.parse(t.slice(m.index, end + 1));
      } catch {
        /* try the next one */
      }
    }
    return null;
  }
}

/* ------------------------------ One topic ------------------------------ */

async function generateDeck(course, row) {
  const data = await api("topic", { courseId: course.id, topicId: row.id });
  if (!data?.note) return { status: "skipped", reason: "no published note" };
  if (data.access?.locked) return { status: "skipped", reason: "locked topic (the public API only sends its preview)" };
  const content = data.note.content;
  const file = join(opt.out, course.id, `${row.id}.json`);
  if (!opt.force && existsSync(file)) {
    const old = JSON.parse(await readFile(file, "utf8"));
    if (old.noteVersion === data.note.version) return { status: "skipped", reason: "up to date" };
  }
  if (opt["dry-run"]) return { status: "would-generate" };

  const sectionIds = content.sections.map((s) => s.id);
  const note = noteText(content);
  const messages = [
    { role: "system", content: systemPrompt(content, course.title) },
    { role: "user", content: `The note:\n\n${note}` },
  ];
  let cards = null;
  let lastProblems = [];
  let reviewed = false;
  const meter = newMeter();
  const t0 = Date.now();
  let attempts = 0;
  const reviewIssues = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    attempts = attempt;
    const { text, parsed } = await chat(MODEL, messages, CARD_SCHEMA, "flashcards", meter);
    messages.push({ role: "assistant", content: text });
    if (!parsed || !Array.isArray(parsed.cards)) {
      lastProblems = [`The reply was not JSON of the form {"cards":[…]} (it began: ${JSON.stringify(text.slice(0, 120))}).`];
      messages.push({ role: "user", content: `${lastProblems[0]} Reply with the JSON only.` });
      continue;
    }
    const checked = checkCards(parsed.cards, sectionIds);
    if (checked.problems.length) {
      lastProblems = checked.problems;
      messages.push({ role: "user", content: `Fix these problems and send the whole deck again:\n- ${checked.problems.join("\n- ")}` });
      continue;
    }
    // Fact-check once: a separate call that only sees the note and the cards.
    if (!opt["no-review"] && !reviewed) {
      reviewed = true;
      const issues = await review(note, checked.cards, meter);
      reviewIssues.push(...issues.map((i) => i.problem));
      if (issues.length) {
        lastProblems = issues.map((i) => `Card ${i.card}: ${i.problem}`);
        messages.push({ role: "user", content: `A reviewer checked the deck against the note and found:\n- ${lastProblems.join("\n- ")}\nFix them (rewrite or drop those cards) and send the whole deck again.` });
        continue;
      }
    }
    cards = checked.cards;
    break;
  }
  const stats = { attempts, ms: Date.now() - t0, reviewIssues: reviewIssues.length, ...meter, cost: Number(meter.cost.toFixed(5)) };
  if (!cards) return { status: "failed", reason: lastProblems.join(" | "), stats };

  const deck = {
    schemaVersion: 1,
    courseId: course.id,
    topicId: row.id,
    topicCode: content.topicCode,
    topicName: content.topicName,
    noteVersion: data.note.version,
    model: MODEL,
    generatedAt: new Date().toISOString(),
    cards,
  };
  await mkdir(join(opt.out, course.id), { recursive: true });
  await writeFile(file, `${JSON.stringify(deck, null, 2)}\n`);
  return { status: "written", cards: cards.length, stats };
}

async function review(note, cards, meter) {
  const list = cards.map((c, i) => `${i + 1}. [${c.kind}] Q: ${c.front}\n   A: ${c.back}${c.hint ? `\n   Hint: ${c.hint}` : ""}`).join("\n");
  const { parsed } = await chat(
    REVIEWER,
    [
      {
        role: "system",
        content:
          "You fact-check revision flashcards against the note they were written from. Report a card only if its answer is wrong, not supported by the note, ambiguous (more than one fair answer to the front), gives its answer away on the front or in the hint, or has broken LaTeX. Do not report style preferences. An empty list is a fine answer. Reply with JSON only: {\"issues\":[{\"card\":<number>,\"problem\":\"…\"}]}",
      },
      { role: "user", content: `The note:\n\n${note}\n\nThe cards:\n\n${list}` },
    ],
    REVIEW_SCHEMA,
    "review",
    meter,
  );
  const issues = Array.isArray(parsed?.issues) ? parsed.issues : [];
  return issues.filter((i) => Number.isInteger(i.card) && i.card >= 1 && i.card <= cards.length && typeof i.problem === "string");
}

/* ------------------------------ Run ------------------------------ */

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }),
  );
}

const started = Date.now();
const courses = (await api("courses")).filter((c) => c.noteCount > 0 && (!onlyCourses || onlyCourses.has(c.id)));
const jobs = [];
for (const summary of courses) {
  if (!SAFE_ID.test(summary.id)) {
    console.warn(`skip course with an unexpected id: ${summary.id}`);
    continue;
  }
  const course = await api("course", { courseId: summary.id });
  for (const unit of course?.units ?? []) {
    for (const row of unit.topics) {
      if (!row.note || (onlyTopics && !onlyTopics.has(row.id)) || (onlyPairs && !onlyPairs.has(`${course.id}/${row.id}`))) continue;
      if (!SAFE_ID.test(row.id)) {
        console.warn(`skip topic with an unexpected id: ${course.id}/${row.id}`);
        continue;
      }
      jobs.push({ course, row });
    }
  }
}
console.log(`${jobs.length} topics with notes in ${courses.length} courses · model ${MODEL}${opt["no-review"] ? "" : ` · reviewer ${REVIEWER}`}`);

const results = [];
let written = 0;
let inFlight = 0;
await pool(jobs, Number(opt.concurrency), async ({ course, row }) => {
  // Topics still being written count toward --limit, so parallel workers cannot overshoot it.
  if (written + inFlight >= limit) return;
  const tag = `${course.id}/${row.id}`;
  inFlight++;
  try {
    const r = await generateDeck(course, row);
    if (r.status === "written") written++;
    results.push({ topic: tag, ...r });
    if (r.status !== "skipped") console.log(`${r.status.padEnd(14)} ${tag}${r.cards ? ` (${r.cards} cards)` : ""}${r.reason ? ` — ${r.reason}` : ""}`);
  } catch (e) {
    results.push({ topic: tag, status: "failed", reason: e.message });
    console.log(`failed         ${tag} — ${e.message}`);
  } finally {
    inFlight--;
  }
});

const count = (s) => results.filter((r) => r.status === s).length;
const report = {
  startedAt: new Date(started).toISOString(),
  seconds: Math.round((Date.now() - started) / 1000),
  model: MODEL,
  reviewer: opt["no-review"] ? null : REVIEWER,
  written: count("written"),
  skipped: count("skipped"),
  failed: count("failed"),
  usage: { ...usage, cost: Number(usage.cost.toFixed(4)) },
  failures: results.filter((r) => r.status === "failed"),
  topics: results.filter((r) => r.stats),
};
if (!opt["dry-run"]) {
  await mkdir(join(opt.out, "_runs"), { recursive: true });
  await writeFile(join(opt.out, "_runs", `${new Date(started).toISOString().replace(/[:.]/g, "-")}.json`), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(`\nwritten ${report.written} · skipped ${report.skipped} · failed ${report.failed} · ${usage.calls} calls · ${usage.prompt + usage.completion} tokens · $${report.usage.cost}`);
if (opt["dry-run"]) console.log(`would generate ${count("would-generate")}`);
process.exitCode = report.failed ? 1 : 0;
