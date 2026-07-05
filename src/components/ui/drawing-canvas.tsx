"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Eraser, Pen, Trash2, Undo2 } from "lucide-react";

interface DrawingCanvasProps {
  /** Called whenever the drawing changes; null when the canvas is empty. */
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  className?: string;
}

const WIDTH = 640;
const HEIGHT = 400;

export function DrawingCanvas({
  onChange,
  disabled,
  className,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const history = useRef<ImageData[]>([]);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [strokes, setStrokes] = useState(0);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getCtx = () => canvasRef.current?.getContext("2d") ?? null;

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const emitChange = (count: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(count > 0 ? canvas.toDataURL("image/png") : null);
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    history.current.push(ctx.getImageData(0, 0, WIDTH, HEIGHT));
    if (history.current.length > 30) history.current.shift();
    drawing.current = true;
    const { x, y } = pointFromEvent(e);
    ctx.strokeStyle = tool === "pen" ? "#1f2937" : "#ffffff";
    ctx.lineWidth = tool === "pen" ? 2.5 : 18;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = pointFromEvent(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const next = strokes + 1;
    setStrokes(next);
    emitChange(next);
  };

  const undo = () => {
    const ctx = getCtx();
    const prev = history.current.pop();
    if (!ctx || !prev) return;
    ctx.putImageData(prev, 0, 0);
    const next = Math.max(0, strokes - 1);
    setStrokes(next);
    emitChange(next);
  };

  const clear = () => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    history.current = [];
    setStrokes(0);
    onChange(null);
  };

  return (
    <div className={cn("rounded-lg border border-border-strong bg-background overflow-hidden", className)}>
      <div className="flex items-center gap-1 border-b border-border bg-muted/40 px-2 py-1.5">
        {(
          [
            { id: "pen" as const, icon: Pen, label: "Pen" },
            { id: "eraser" as const, icon: Eraser, label: "Eraser" },
          ]
        ).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            title={label}
            disabled={disabled}
            onClick={() => setTool(id)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md",
              tool === id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <div className="mx-1 h-4 w-px bg-border" />
        <button
          type="button"
          title="Undo"
          disabled={disabled || strokes === 0}
          onClick={undo}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Clear"
          disabled={disabled || strokes === 0}
          onClick={clear}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <span className="ml-auto text-[10px] text-muted-foreground pr-1">
          Sketch your diagram
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
        className={cn(
          "block w-full touch-none bg-white",
          disabled ? "cursor-not-allowed opacity-70" : "cursor-crosshair",
        )}
      />
    </div>
  );
}
