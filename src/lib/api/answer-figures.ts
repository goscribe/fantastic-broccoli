import { apiUrl } from "./config";

/**
 * Pictures in written answers (the answer box's Figure tool). The picture is
 * shrunk here first, then its bytes go to the server's `POST /answer-figures`
 * with the session cookie; the answer keeps the URL it answers with, which
 * only its owner (and admins) can load (goscribe/server routes/answer-figures.ts).
 */

/** The server's limit, and ours after shrinking. */
export const FIGURE_MAX_BYTES = 5 * 1024 * 1024;
/** Longest side after shrinking: plenty for a marker to read handwriting and labels. */
export const FIGURE_MAX_SIDE = 1600;
export const FIGURE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif", "image/gif", "image/avif"];

export class FigureError extends Error {
  constructor(
    public readonly kind: "not_image" | "too_large" | "offline" | "failed" | "signed_out" | "daily_limit",
    message: string,
  ) {
    super(message);
  }
}

/**
 * The picture made small enough to send: at most FIGURE_MAX_SIDE on its
 * longest side, JPEG (PNG kept for a sketch, which is small and sharp-edged).
 */
export async function shrinkFigure(file: Blob, opts: { keepPng?: boolean } = {}): Promise<Blob> {
  if (file.type && !file.type.startsWith("image/")) throw new FigureError("not_image", "That isn't a picture. Choose a photo or an image file.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new FigureError("not_image", "We couldn't read that picture. Try a PNG or JPEG.");
  }
  const scale = Math.min(1, FIGURE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new FigureError("failed", "We couldn't prepare that picture.");
  // A transparent PNG turned into JPEG would go black; paint it on white.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const type = opts.keepPng ? "image/png" : "image/jpeg";
  let out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  if (out && out.size > FIGURE_MAX_BYTES) out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.6));
  if (!out) throw new FigureError("failed", "We couldn't prepare that picture.");
  if (out.size > FIGURE_MAX_BYTES) throw new FigureError("too_large", "That picture is too large. Pictures can be up to 5 MB.");
  return out;
}

/** Stores the (already shrunk) picture; answers with the URL to write into the answer. */
export async function uploadFigure(blob: Blob): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${apiUrl}/answer-figures`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": blob.type || "application/octet-stream" },
      body: blob,
    });
  } catch {
    throw new FigureError("offline", "You're offline. Add the picture again when you're back online.");
  }
  const body = (await res.json().catch(() => null)) as { url?: string; message?: string; error?: string } | null;
  if (res.ok && body?.url) return body.url;
  if (res.status === 401) throw new FigureError("signed_out", "Sign in again to add pictures.");
  if (res.status === 413) throw new FigureError("too_large", "That picture is too large. Pictures can be up to 5 MB.");
  if (res.status === 415) throw new FigureError("not_image", "Only PNG, JPEG or WebP pictures can be added.");
  if (res.status === 429) throw new FigureError("daily_limit", body?.message ?? "You've added a lot of pictures today. Try again tomorrow.");
  throw new FigureError("failed", "We couldn't add that picture. Try again.");
}

/** Shrink then store: what the Figure tool calls with a picked, pasted, dropped or drawn picture. */
export async function addFigure(file: Blob, opts: { keepPng?: boolean } = {}): Promise<string> {
  return uploadFigure(await shrinkFigure(file, opts));
}
