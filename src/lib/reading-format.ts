/**
 * Formatting helpers for readings (pure, unit-tested).
 *
 * Source-first readings show the student's own notes verbatim with a few
 * labelled additions written by Scribe. The markdown carries them as
 * paragraphs that start with a bold label ("**In short:** …",
 * "**Note (added by Scribe):** …", "**Key term — osmosis:** …",
 * "**Worked example**\n<step>\n<step>"), so every client can show them; this
 * module turns those into calm, flat callouts and keeps bold key terms
 * without breaking highlight offsets (which index the text with the `**`
 * markers removed).
 */

export type BoldRange = [number, number];

/** `**x**` spans as [start, end) offsets into the text with markers removed. */
export function boldRanges(raw: string): BoldRange[] {
  const ranges: BoldRange[] = [];
  let removed = 0;
  for (const m of raw.matchAll(/\*\*([^*\n]+)\*\*/g)) {
    const start = (m.index ?? 0) - removed;
    ranges.push([start, start + m[1].length]);
    removed += 4;
  }
  return ranges;
}

/** Pieces of `text[from, to)` split at bold boundaries. */
export function splitBold(
  text: string,
  from: number,
  to: number,
  ranges: BoldRange[],
): { text: string; bold: boolean; start: number }[] {
  const cuts = new Set<number>([from, to]);
  for (const [s, e] of ranges) {
    if (s > from && s < to) cuts.add(s);
    if (e > from && e < to) cuts.add(e);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: { text: string; bold: boolean; start: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [s, e] = [points[i], points[i + 1]];
    if (e <= s) continue;
    const bold = ranges.some(([bs, be]) => s >= bs && e <= be);
    out.push({ text: text.slice(s, e), bold, start: s });
  }
  return out;
}

export type CalloutKind =
  | "in_short"
  | "note"
  | "common_mistake"
  | "key_term"
  | "objective"
  | "worked_example";

export interface Callout {
  kind: CalloutKind;
  /** The label as written ("In short", "Note (added by Scribe)", "Key term — osmosis"). */
  label: string;
  /** Body markdown (may contain **bold** and $math$). */
  body: string;
  /** Worked examples: one step per line. */
  lines?: string[];
  /** Written by Scribe (not the student's notes). */
  scribe: boolean;
}

const CALLOUT_RE =
  /^\*\*(In short|Objective|Note \(added by Scribe\)|Common mistake \(added by Scribe\)|Note|Common mistake|Key term — [^*:]{1,60}):\*\*\s*([\s\S]*)$/;

/** A labelled paragraph as a callout, or null for ordinary text. */
export function parseCallout(raw: string): Callout | null {
  const text = raw.trim();
  const worked = text.match(/^\*\*Worked example\*\*\s*\n([\s\S]+)$/);
  if (worked) {
    const lines = worked[1].split("\n").map((l) => l.trim()).filter(Boolean);
    return { kind: "worked_example", label: "Worked example", body: lines.join("\n"), lines, scribe: false };
  }
  const m = text.match(CALLOUT_RE);
  if (!m) return null;
  const label = m[1];
  const kind: CalloutKind = label === "In short"
    ? "in_short"
    : label === "Objective"
      ? "objective"
      : label.startsWith("Key term")
        ? "key_term"
        : label.startsWith("Common mistake")
          ? "common_mistake"
          : "note";
  const scribe = kind === "in_short" || /added by Scribe/.test(label);
  return { kind, label, body: m[2].trim(), scribe };
}

/** True when a callout has nothing to show under its label. */
export function calloutIsEmpty(callout: Callout): boolean {
  if (callout.lines?.length) return false;
  return callout.body.replace(/\*\*|\$/g, "").trim().length === 0;
}

/** Items of a list paragraph ("- a" lines, or "1. a" lines), else null. */
export function parseList(lines: string[]): { ordered: boolean; items: string[] } | null {
  if (lines.length === 0) return null;
  if (lines.every((l) => /^[-*]\s+/.test(l))) {
    return { ordered: false, items: lines.map((l) => l.replace(/^[-*]\s+/, "")) };
  }
  if (lines.every((l) => /^\d{1,2}[.)]\s+/.test(l))) {
    return { ordered: true, items: lines.map((l) => l.replace(/^\d{1,2}[.)]\s+/, "")) };
  }
  return null;
}

export interface ReadingCheck {
  type: "check";
  question: string;
  options: string[];
  correctIndex: number;
  feedbackCorrect: string;
  feedbackWrong: string;
}

interface Block {
  type: string;
  text?: string;
}

/**
 * Inline quick checks keyed by the heading of the section they follow
 * ("" for checks before any heading). Blocks come in reading order: a
 * check belongs to the last heading before it.
 */
export function checksBySection(blocks: unknown): Map<string, ReadingCheck[]> {
  const out = new Map<string, ReadingCheck[]>();
  if (!Array.isArray(blocks)) return out;
  let heading = "";
  for (const b of blocks as Block[]) {
    if (!b || typeof b !== "object") continue;
    if (b.type === "heading" && typeof b.text === "string") heading = b.text.trim();
    if (b.type === "check") {
      const c = b as unknown as ReadingCheck;
      if (
        typeof c.question !== "string" ||
        !Array.isArray(c.options) ||
        c.options.length < 2 ||
        typeof c.correctIndex !== "number" ||
        c.correctIndex < 0 ||
        c.correctIndex >= c.options.length
      )
        continue;
      out.set(heading, [...(out.get(heading) ?? []), c]);
    }
  }
  return out;
}
