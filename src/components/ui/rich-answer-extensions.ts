import { Node, mergeAttributes } from "@tiptap/core";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";

/**
 * The answer box's blocks beyond lines of text (see lib/rich-answer.ts for
 * how they are saved): tables, and figures (a picture with a caption).
 * Kept apart from rich-answer-field.tsx so the box itself only lists them.
 */

/** A cell holds lines of text and maths, not another table or a figure (a GFM cell is one line). */
const AnswerTableCell = TableCell.extend({ content: "paragraph+" });
const AnswerTableHeader = TableHeader.extend({ content: "paragraph+" });

export const answerTableExtensions = [
  Table.configure({ resizable: false, HTMLAttributes: { class: "rich-answer-table" } }),
  TableRow,
  AnswerTableHeader,
  AnswerTableCell,
];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    answerFigure: {
      insertAnswerFigure: (attrs: { src: string; caption?: string }) => ReturnType;
    };
  }
}

/** A picture on its own line with an optional caption under it. */
export const AnswerFigure = Node.create({
  name: "answerFigure",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return { src: { default: "" }, caption: { default: "" } };
  },
  parseHTML() {
    return [
      {
        tag: "figure[data-answer-figure]",
        getAttrs: (el) => ({
          src: (el as HTMLElement).querySelector("img")?.getAttribute("src") ?? "",
          caption: (el as HTMLElement).querySelector("figcaption")?.textContent ?? "",
        }),
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const caption = String(node.attrs.caption ?? "");
    return [
      "figure",
      mergeAttributes(HTMLAttributes, { "data-answer-figure": "", class: "rich-answer-figure" }),
      ["img", { src: String(node.attrs.src ?? ""), alt: caption || "Figure", loading: "lazy", draggable: "false" }],
      ...(caption ? [["figcaption", {}, caption] as const] : []),
    ];
  },
  addCommands() {
    return {
      insertAnswerFigure:
        ({ src, caption = "" }) =>
        ({ commands }) =>
          commands.insertContent([{ type: this.name, attrs: { src, caption } }, { type: "paragraph" }]),
    };
  },
});

/** How many figures the document holds. */
export function countFigures(doc: { descendants: (fn: (node: { type: { name: string } }) => boolean | void) => void }): number {
  let n = 0;
  doc.descendants((node) => {
    if (node.type.name === "answerFigure") n++;
  });
  return n;
}
