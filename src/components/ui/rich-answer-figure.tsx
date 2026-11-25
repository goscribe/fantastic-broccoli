"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Eraser, ImageUp, Loader2, Minus, PenLine, Pencil, Trash2, Undo2 } from "lucide-react";
import { MAX_ANSWER_FIGURES, cleanCaption } from "@/lib/rich-answer";
import { useI18n } from "@/lib/i18n";
import "@/lib/i18n/answer-media";
import { cn } from "@/lib/utils";

/** Stores a picture (shrunk first) and answers with the URL the answer keeps. */
export type FigureUploader = (picture: Blob, opts: { keepPng?: boolean }) => Promise<string>;

const pill =
  "inline-flex h-11 shrink-0 touch-manipulation items-center justify-center gap-2 rounded-full px-4 text-[14px] font-bold transition-colors disabled:opacity-45";

/**
 * The Figure tool's panel under the answer box: upload a picture, take one
 * with the phone's camera, or sketch one; then an optional caption, and
 * "Add figure" stores it and puts it in the answer.
 */
export function FigurePanel({
  upload,
  onInsert,
  onCancel,
  initial,
  used,
}: {
  upload: FigureUploader;
  onInsert: (src: string, caption: string) => void;
  onCancel: () => void;
  /** A picture pasted or dropped into the box: the panel opens on it. */
  initial?: File | null;
  /** Figures already in the answer. */
  used: number;
}) {
  const { t } = useI18n();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"choose" | "sketch" | "ready">(initial ? "ready" : "choose");
  const [picture, setPicture] = useState<{ blob: Blob; sketch: boolean } | null>(initial ? { blob: initial, sketch: false } : null);
  // The picture's preview address, made with the picture and let go when it changes.
  const preview = useMemo(() => (picture ? URL.createObjectURL(picture.blob) : null), [picture]);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = used >= MAX_ANSWER_FIGURES;

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const pick = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setPicture({ blob: file, sketch: false });
    setMode("ready");
  };

  const add = async () => {
    if (!picture || busy) return;
    setBusy(true);
    setError(null);
    try {
      const src = await upload(picture.blob, { keepPng: picture.sketch });
      onInsert(src, cleanCaption(caption));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "We couldn't add that picture. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 rounded-[18px] bg-card px-3.5 py-3 shadow-[0_8px_24px_-16px_rgba(17,17,20,.35)] ring-1 ring-border" data-figure-panel role="group" aria-label={t("rich.figureTitle")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] font-extrabold text-foreground">{t("rich.figureTitle")}</p>
        <button type="button" onClick={onCancel} className="min-h-11 px-1 text-[13.5px] font-bold text-muted-foreground hover:text-foreground">
          {t("rich.figureCancel")}
        </button>
      </div>

      {full ? (
        <p className="pb-1 text-[13.5px] font-semibold text-muted-foreground" role="status">
          {t("rich.figureLimit").replace("{n}", String(MAX_ANSWER_FIGURES))}
        </p>
      ) : mode === "choose" ? (
        <>
          <div className="mt-1 flex flex-wrap gap-2">
            <button type="button" className={cn(pill, "bg-muted text-foreground hover:bg-[var(--edge)]")} onClick={() => fileInput.current?.click()}>
              <ImageUp className="size-4" aria-hidden /> {t("rich.figureUpload")}
            </button>
            <button type="button" className={cn(pill, "bg-muted text-foreground hover:bg-[var(--edge)]")} onClick={() => cameraInput.current?.click()}>
              <Camera className="size-4" aria-hidden /> {t("rich.figureCamera")}
            </button>
            <button type="button" className={cn(pill, "bg-muted text-foreground hover:bg-[var(--edge)]")} onClick={() => setMode("sketch")}>
              <Pencil className="size-4" aria-hidden /> {t("rich.figureSketch")}
            </button>
          </div>
          <p className="mt-2 text-[13px] font-medium leading-snug text-muted-foreground">{t("rich.figureHint")}</p>
        </>
      ) : mode === "sketch" ? (
        <SketchPad
          onDone={(png) => {
            setPicture({ blob: png, sketch: true });
            setMode("ready");
          }}
        />
      ) : (
        <div className="mt-1">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={t("rich.figurePreview")} className="max-h-56 w-auto max-w-full rounded-xl border border-border bg-white object-contain" />
          )}
          <label className="mt-3 block text-[13px] font-bold text-muted-foreground" htmlFor="rich-figure-caption">
            {t("rich.figureCaption")}
          </label>
          <input
            id="rich-figure-caption"
            value={caption}
            maxLength={140}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              }
            }}
            placeholder={t("rich.figureCaptionPlaceholder")}
            data-calculator-ignore
            className="mt-1 h-11 w-full rounded-xl bg-muted px-3 text-[15px] text-foreground placeholder:text-faint focus:bg-card focus:outline-none focus:ring-2 focus:ring-[var(--border-strong)]"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPicture(null);
                setMode("choose");
              }}
              className="min-h-11 text-[13.5px] font-bold text-muted-foreground hover:text-foreground"
            >
              {t("rich.figureBack")}
            </button>
            <button type="button" disabled={busy || !picture} onClick={() => void add()} className={cn(pill, "bg-accent text-white")}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {busy ? t("rich.figureAdding") : t("rich.figureAdd")}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="mt-2 text-[13.5px] font-semibold text-rose-600" role="alert">
          {error}
        </p>
      )}
      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
    </div>
  );
}

type SketchTool = "pen" | "eraser" | "line";
interface Stroke {
  tool: SketchTool;
  points: Array<[number, number]>;
}

const SKETCH_W = 1000;
const SKETCH_H = 625;
const INK = "#16161a";

function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SKETCH_W, SKETCH_H);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of strokes) {
    if (!s.points.length) continue;
    ctx.strokeStyle = s.tool === "eraser" ? "#ffffff" : INK;
    ctx.lineWidth = s.tool === "eraser" ? 28 : 4;
    ctx.beginPath();
    const pts = s.tool === "line" ? [s.points[0], s.points[s.points.length - 1]] : s.points;
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 1) ctx.lineTo(pts[0][0] + 0.1, pts[0][1]);
    for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
    ctx.stroke();
  }
}

/**
 * A simple sketch canvas: pen, eraser, straight line, undo and clear, drawn
 * with a finger, a stylus or the mouse. "Use sketch" hands back a PNG.
 */
export function SketchPad({ onDone }: { onDone: (png: Blob) => void }) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<SketchTool>("pen");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const drawing = useRef<Stroke | null>(null);

  const redraw = useCallback((list: Stroke[]) => {
    const ctx = canvas.current?.getContext("2d");
    if (ctx) paint(ctx, list);
  }, []);
  useEffect(() => redraw(strokes), [strokes, redraw]);

  const at = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * SKETCH_W, ((e.clientY - r.top) / r.height) * SKETCH_H];
  };

  const tools: Array<{ id: SketchTool; label: string; Icon: typeof PenLine }> = [
    { id: "pen", label: t("rich.sketchPen"), Icon: PenLine },
    { id: "eraser", label: t("rich.sketchEraser"), Icon: Eraser },
    { id: "line", label: t("rich.sketchLine"), Icon: Minus },
  ];
  const btn = "grid size-11 shrink-0 touch-manipulation place-items-center rounded-full transition-colors disabled:opacity-35";

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label={t("rich.figureSketch")}>
        {tools.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={tool === id}
            onClick={() => setTool(id)}
            className={cn(btn, tool === id ? "bg-foreground text-background" : "bg-muted text-foreground hover:bg-[var(--edge)]")}
          >
            <Icon className="size-[18px]" aria-hidden />
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-border" aria-hidden />
        <button type="button" title={t("rich.sketchUndo")} aria-label={t("rich.sketchUndo")} disabled={!strokes.length} onClick={() => setStrokes((s) => s.slice(0, -1))} className={cn(btn, "bg-muted text-foreground hover:bg-[var(--edge)]")}>
          <Undo2 className="size-[18px]" aria-hidden />
        </button>
        <button type="button" title={t("rich.sketchClear")} aria-label={t("rich.sketchClear")} disabled={!strokes.length} onClick={() => setStrokes([])} className={cn(btn, "bg-muted text-foreground hover:bg-[var(--edge)]")}>
          <Trash2 className="size-[18px]" aria-hidden />
        </button>
        <button
          type="button"
          disabled={!strokes.some((s) => s.tool !== "eraser")}
          onClick={() => canvas.current?.toBlob((b) => b && onDone(b), "image/png")}
          className={cn(pill, "ml-auto bg-accent text-white")}
        >
          {t("rich.sketchUse")}
        </button>
      </div>
      <canvas
        ref={canvas}
        width={SKETCH_W}
        height={SKETCH_H}
        aria-label={t("rich.sketchArea")}
        role="img"
        data-sketch-pad
        className="mt-2 block aspect-[16/10] w-full cursor-crosshair touch-none rounded-xl border border-border bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = { tool, points: [at(e)] };
          redraw([...strokes, drawing.current]);
        }}
        onPointerMove={(e) => {
          const s = drawing.current;
          if (!s) return;
          const p = at(e);
          if (s.tool === "line") s.points = [s.points[0], p];
          else s.points.push(p);
          redraw([...strokes, s]);
        }}
        onPointerUp={() => {
          const s = drawing.current;
          drawing.current = null;
          if (s) setStrokes((list) => [...list, s]);
        }}
        onPointerCancel={() => {
          drawing.current = null;
          redraw(strokes);
        }}
      />
    </div>
  );
}
