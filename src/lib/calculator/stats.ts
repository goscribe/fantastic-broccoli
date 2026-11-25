/**
 * Stats mode: a typed or pasted list of numbers and its summary. Numbers are
 * split on commas, semicolons, spaces and new lines ("3, 5 8\n12").
 */

export interface ListParse {
  values: number[];
  /** Entries that are not numbers, as typed, so the student can fix them. */
  invalid: string[];
}

export function parseList(text: string): ListParse {
  const values: number[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/[\s,;]+/)) {
    const token = raw.trim().replace(/[−–]/g, "-");
    if (!token) continue;
    const v = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(token) ? Number(token) : NaN;
    if (Number.isFinite(v)) values.push(v);
    else invalid.push(raw.trim());
  }
  return { values, invalid };
}

export interface Summary {
  n: number;
  sum: number;
  mean: number;
  median: number;
  /** Population standard deviation (σ, divides by n). */
  sdPopulation: number;
  /** Sample standard deviation (s, divides by n − 1); null for a single value. */
  sdSample: number | null;
  min: number;
  max: number;
}

/** The summary of a list, or null when it is empty. */
export function summarise(values: number[]): Summary | null {
  const n = values.length;
  if (n === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const squares = values.reduce((a, v) => a + (v - mean) ** 2, 0);
  const mid = Math.floor(n / 2);
  return {
    n,
    sum,
    mean,
    median: n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
    sdPopulation: Math.sqrt(squares / n),
    sdSample: n > 1 ? Math.sqrt(squares / (n - 1)) : null,
    min: sorted[0],
    max: sorted[n - 1],
  };
}
