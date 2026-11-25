"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { DiagramFigureView } from "@/components/my-notes/diagram-figure";
import { isDiagramFigure } from "@/lib/my-notes";
import { FIGURE_EVENT } from "./extensions";

export type FigureAction = "edit" | "redraw" | "delete";

/**
 * A figure block in the editor: the drawing, its caption, and (when it is
 * selected) what can be done with it. The actions are raised as a DOM event
 * the editor component hears, so this view holds no editor state of its own.
 */
export function FigureNodeView({ node, selected, getPos, editor }: NodeViewProps) {
  const figure = node.attrs.figure as unknown;
  const ask = (action: FigureAction) => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor.view.dom.dispatchEvent(new CustomEvent(FIGURE_EVENT, { detail: { pos, action }, bubbles: true }));
  };
  const act = "min-h-11 rounded-[10px] px-2.5 text-small font-bold text-muted-foreground hover:bg-muted hover:text-foreground";
  return (
    <NodeViewWrapper as="figure" className="se-figure" data-selected={selected || undefined} contentEditable={false}>
      {isDiagramFigure(figure) ? <DiagramFigureView figure={figure} /> : <p className="rounded-2xl bg-muted px-4 py-6 text-center text-ui text-muted-foreground">This figure can&apos;t be shown.</p>}
      {isDiagramFigure(figure) && figure.caption && <figcaption className="mt-2 px-1 text-small text-muted-foreground">{figure.caption}</figcaption>}
      {editor.isEditable && selected && (
        <div className="mt-1 flex flex-wrap items-center gap-x-1" role="toolbar" aria-label="Figure">
          <button type="button" className={act} onClick={() => ask("edit")}>
            Edit description
          </button>
          <button type="button" className={act} onClick={() => ask("redraw")}>
            Redraw
          </button>
          <button type="button" className={`${act} hover:!text-rose-600`} onClick={() => ask("delete")}>
            Delete
          </button>
        </div>
      )}
    </NodeViewWrapper>
  );
}
