/**
 * How a result is written: ten significant figures by default (a school
 * calculator's display, and enough to hide float noise), 3 or 4 significant
 * figures on request, scientific notation for very large and very small
 * values, or the exact fraction when there is one.
 *
 * The text is plain ("-1.2×10^-5", "7/4") so it can go straight into an
 * answer box: the worksheet marker reads "×10^" and fractions as numbers.
 */
import type { CalcValue } from "./engine";

export type Precision = "auto" | "sf3" | "sf4";

const AUTO_DIGITS = 10;
/** Outside these the number is written in scientific notation. */
const SCI_HIGH = 1e10;
const SCI_LOW = 1e-7;

function trimZeros(s: string): string {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

/** `value` to `digits` significant figures; `keepZeros` keeps the trailing ones that are significant (2.50). */
export function toSignificant(value: number, digits: number, keepZeros = true): string {
  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return keepZeros && digits > 1 ? `0.${"0".repeat(digits - 1)}` : "0";
  const [mantissa, expText] = value.toExponential(digits - 1).split("e");
  const exp = Number(expText);
  const abs = Math.abs(value);
  if (abs >= SCI_HIGH || abs < SCI_LOW) {
    return `${keepZeros ? mantissa : trimZeros(mantissa)}×10^${exp}`;
  }
  // Rounded to the figures asked for, then written out in full (123456 → 123000).
  const rounded = Number(`${mantissa}e${exp}`);
  const fixed = rounded.toFixed(Math.max(0, digits - 1 - exp));
  return keepZeros ? fixed : trimZeros(fixed);
}

/** The decimal form of a result. */
export function formatNumber(value: number, precision: Precision = "auto"): string {
  if (precision === "sf3") return toSignificant(value, 3);
  if (precision === "sf4") return toSignificant(value, 4);
  if (Number.isInteger(value) && Math.abs(value) < 1e15) return String(value);
  return toSignificant(value, AUTO_DIGITS, false);
}

/** True when the result can be shown as a fraction that says more than the decimal. */
export function hasFraction(result: CalcValue): boolean {
  return !!result.exact && result.exact.d !== BigInt(1) && result.exact.d.toString().length <= 12 && result.exact.n.toString().length <= 15;
}

/** "7/4", or null when the result is not an exact (non-whole) fraction. */
export function formatFraction(result: CalcValue): string | null {
  if (!hasFraction(result) || !result.exact) return null;
  return `${result.exact.n}/${result.exact.d}`;
}

/** The result as the student asked to see it. */
export function formatResult(result: CalcValue, options: { precision?: Precision; fraction?: boolean } = {}): string {
  if (options.fraction) {
    const f = formatFraction(result);
    if (f) return f;
  }
  return formatNumber(result.value, options.precision ?? "auto");
}

const SUPERSCRIPT: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };

/** For the screen only: a real minus sign and a raised exponent ("−1.2 × 10⁻⁵"). */
export function prettyResult(text: string): string {
  return text
    .replace(/×10\^(-?\d+)/, (_, e: string) => ` × 10${[...e].map((c) => SUPERSCRIPT[c] ?? c).join("")}`)
    .replace(/-/g, "−");
}
