import { Extension, Node, mergeAttributes } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { goToNextCell, tableEditing } from "@tiptap/pm/tables";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findQuote } from "@/lib/quote-match";

/* ---------- Marked passages (anchors) ---------- */

/** A passage of the document that something outside it (a feedback item, a comment) points at, found by its words. */
export interface EditorAnchor {
  id: string;
  quote: string;
}

interface AnchorState {
  anchors: EditorAnchor[];
  active: string | null;
  decorations: DecorationSet;
}

export const anchorKey = new PluginKey<AnchorState>("scribeAnchors");

/** The text of a block and, for each character, where it sits in the document. */
function blockText(node: PmNode, pos: number): { text: string; at: number[] } {
  let text = "";
  const at: number[] = [];
  node.forEach((child, offset) => {
    const start = pos + 1 + offset;
    if (child.isText && child.text) {
      for (let i = 0; i < child.text.length; i++) {
        text += child.text[i];
        at.push(start + i);
      }
    } else {
      // An inline node (a formula) is one character wide and never part of a quote.
      text += "\u0000";
      at.push(start);
    }
  });
  return { text, at };
}

function decorate(doc: PmNode, anchors: EditorAnchor[], active: string | null): DecorationSet {
  if (anchors.length === 0) return DecorationSet.empty;
  const decos: Decoration[] = [];
  const found = new Set<string>();
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (found.size === anchors.length || node.content.size === 0) return false;
    const { text, at } = blockText(node, pos);
    for (const a of anchors) {
      if (found.has(a.id)) continue;
      const ranges = findQuote(text, a.quote);
      if (ranges.length === 0) continue;
      found.add(a.id);
      for (const r of ranges) {
        decos.push(
          Decoration.inline(at[r.start], at[r.end - 1] + 1, {
            class: a.id === active ? "se-anchor se-anchor--active" : "se-anchor",
            "data-anchor": a.id,
          }),
        );
      }
    }
    return false;
  });
  return DecorationSet.create(doc, decos);
}

/**
 * Marks the passages named by `anchors` (found by their words, so they follow
 * the text as it is edited and disappear when the words change) and reports a
 * tap on one as an ANCHOR_EVENT on the editor's element. Set them with `view.dispatch(tr.setMeta(anchorKey, { anchors, active }))`.
 */
export const ANCHOR_EVENT = "scribe-anchor";

export const Anchors = Extension.create({
  name: "scribeAnchors",
  addProseMirrorPlugins() {
    return [
      new Plugin<AnchorState>({
        key: anchorKey,
        state: {
          init: () => ({ anchors: [], active: null, decorations: DecorationSet.empty }),
          apply(tr, prev) {
            const meta = tr.getMeta(anchorKey) as { anchors?: EditorAnchor[]; active?: string | null } | undefined;
            if (!meta && !tr.docChanged) return prev;
            const anchors = meta?.anchors ?? prev.anchors;
            const active = meta && "active" in meta ? (meta.active ?? null) : prev.active;
            return { anchors, active, decorations: decorate(tr.doc, anchors, active) };
          },
        },
        props: {
          decorations: (state) => anchorKey.getState(state)?.decorations,
          handleClick(view, _pos, event) {
            const el = (event.target as HTMLElement | null)?.closest?.("[data-anchor]");
            const id = el?.getAttribute("data-anchor");
            if (!id) return false;
            // Heard by the editor component (a DOM event keeps the plugin free of React state).
            view.dom.dispatchEvent(new CustomEvent(ANCHOR_EVENT, { detail: id, bubbles: true }));
            return false;
          },
        },
      }),
    ];
  },
});

/* ---------- Image ---------- */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    scribeImage: {
      insertImage: (attrs: { src: string; alt?: string }) => ReturnType;
    };
    scribeTable: {
      insertTable: (size?: { rows?: number; cols?: number }) => ReturnType;
    };
  }
}

/** A picture on its own line. Where the file lives is the host's business (`uploadImage`). */
export const Image = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null }, alt: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "img[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes({ class: "se-image", loading: "lazy" }, HTMLAttributes)];
  },
  addCommands() {
    return {
      insertImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

/* ---------- Table (prosemirror-tables, without a separate package) ---------- */

const cellAttrs = {
  colspan: { default: 1 },
  rowspan: { default: 1 },
  colwidth: { default: null },
};

const cell = (name: string, tag: "td" | "th") =>
  Node.create({
    name,
    content: "paragraph+",
    isolating: true,
    addAttributes() {
      return cellAttrs;
    },
    parseHTML() {
      return [{ tag }];
    },
    renderHTML({ HTMLAttributes }) {
      const { colwidth: _colwidth, ...rest } = HTMLAttributes as Record<string, unknown>;
      void _colwidth;
      return [tag, rest, 0];
    },
  });

export const TableCell = cell("tableCell", "td");
export const TableHeader = cell("tableHeader", "th");

export const TableRow = Node.create({
  name: "tableRow",
  content: "(tableCell | tableHeader)*",
  parseHTML() {
    return [{ tag: "tr" }];
  },
  renderHTML() {
    return ["tr", 0];
  },
});

const ROLES: Record<string, string> = { table: "table", tableRow: "row", tableCell: "cell", tableHeader: "header_cell" };

export const Table = Node.create({
  name: "table",
  group: "block",
  content: "tableRow+",
  isolating: true,
  parseHTML() {
    return [{ tag: "table" }];
  },
  renderHTML() {
    return ["div", { class: "se-table" }, ["table", ["tbody", 0]]];
  },
  // prosemirror-tables finds its nodes by this role.
  extendNodeSchema(extension) {
    const role = ROLES[extension.name];
    return role ? { tableRole: role } : {};
  },
  addCommands() {
    return {
      insertTable:
        ({ rows = 3, cols = 3 } = {}) =>
        ({ commands }) => {
          const para = { type: "paragraph" };
          const row = (type: string) => ({ type: "tableRow", content: Array.from({ length: cols }, () => ({ type, content: [para] })) });
          return commands.insertContent({ type: "table", content: [row("tableHeader"), ...Array.from({ length: rows - 1 }, () => row("tableCell"))] });
        },
    };
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => goToNextCell(1)(this.editor.state, this.editor.view.dispatch),
      "Shift-Tab": () => goToNextCell(-1)(this.editor.state, this.editor.view.dispatch),
    };
  },
  addProseMirrorPlugins() {
    return [tableEditing()];
  },
});
