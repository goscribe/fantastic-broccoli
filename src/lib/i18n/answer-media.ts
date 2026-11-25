import { registerTranslations } from "@/lib/i18n";

// Tables and figures in the answer box (components/ui/rich-answer-field.tsx,
// rich-answer-figure.tsx). Imported for side effect. Other locales fall back to English.
const en = {
  "rich.table": "Table",
  "rich.figure": "Figure",
  "rich.tableTools": "Table",
  "rich.addRow": "Add row",
  "rich.addColumn": "Add column",
  "rich.removeRow": "Remove row",
  "rich.removeColumn": "Remove column",
  "rich.removeTable": "Remove table",
  "rich.figureTitle": "Add a figure",
  "rich.figureUpload": "Upload a picture",
  "rich.figureCamera": "Take a photo",
  "rich.figureSketch": "Sketch it",
  "rich.figureHint": "A photo of your working, a graph or a diagram. You can also paste or drop a picture into the answer.",
  "rich.figureCaption": "Caption (optional)",
  "rich.figureCaptionPlaceholder": "e.g. velocity–time graph",
  "rich.figureAdd": "Add figure",
  "rich.figureAdding": "Adding…",
  "rich.figureCancel": "Cancel",
  "rich.figureBack": "Choose another",
  "rich.figureLimit": "An answer can have up to {n} figures.",
  "rich.figureSelected": "Figure",
  "rich.figureRemove": "Remove figure",
  "rich.figurePreview": "The figure you're adding",
  "rich.sketchPen": "Pen",
  "rich.sketchEraser": "Eraser",
  "rich.sketchLine": "Straight line",
  "rich.sketchUndo": "Undo",
  "rich.sketchClear": "Clear",
  "rich.sketchUse": "Use sketch",
  "rich.sketchArea": "Sketch area: draw with a finger, a pen or the mouse",
};

registerTranslations(en, {});
