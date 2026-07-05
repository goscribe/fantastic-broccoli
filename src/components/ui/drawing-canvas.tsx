"use client";

import { useRef, useState } from "react";
import {
  ReactSketchCanvas,
  type ReactSketchCanvasRef,
} from "react-sketch-canvas";
import { cn } from "@/lib/utils";
import { Eraser, Pen, Redo2, Trash2, Undo2 } from "lucide-react";

interface DrawingCanvasProps {
  /** Called whenever the drawing changes; null when the canvas is empty. */
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  className?: string;
}

export function DrawingCanvas({
  onChange,
  disabled,
  className,
}: DrawingCanvasProps) {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");

  const emitChange = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const paths = await canvas.exportPaths();
    if (paths.length === 0) {
      onChange(null);
      return;
    }
    onChange(await canvas.exportImage("png"));
  };

  const setToolMode = (next: "pen" | "eraser") => {
    setTool(next);
    canvasRef.current?.eraseMode(next === "eraser");
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border-strong bg-background overflow-hidden",
        className,
      )}
    >
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
            onClick={() => setToolMode(id)}
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
          disabled={disabled}
          onClick={() => {
            canvasRef.current?.undo();
            void emitChange();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Redo"
          disabled={disabled}
          onClick={() => {
            canvasRef.current?.redo();
            void emitChange();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="Clear"
          disabled={disabled}
          onClick={() => {
            canvasRef.current?.clearCanvas();
            onChange(null);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <span className="ml-auto text-[10px] text-muted-foreground pr-1">
          Sketch your diagram
        </span>
      </div>
      <div className={cn(disabled && "pointer-events-none opacity-70")}>
        <ReactSketchCanvas
          ref={canvasRef}
          height="320px"
          strokeWidth={2.5}
          eraserWidth={18}
          strokeColor="#1f2937"
          canvasColor="#ffffff"
          onStroke={() => void emitChange()}
          style={{ border: "none", borderRadius: 0 }}
        />
      </div>
    </div>
  );
}
