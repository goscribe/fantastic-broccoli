import type { SketchSpec } from "./api/my-notes";

/** Sketches the model returned for student descriptions (server /diagram), for layout tests. */
export const SKETCH_FIXTURES: { name: string; sketch: SketchSpec }[] = [
  {
    name: "AD–AS recessionary gap (the founder's description)",
    sketch: {
      xLabel: "Real GDP (Y)",
      yLabel: "Price level (PL)",
      axes: true,
      bounds: { left: 0, right: 10, bottom: 0, top: 10 },
      curves: [
        {
          id: "c1",
          label: "LRAS",
          color: "green",
          dashed: false,
          smooth: false,
          points: [
            { x: 6, y: 0.5 },
            { x: 6, y: 9.5 },
          ],
        },
        {
          id: "c2",
          label: "SRAS",
          color: "red",
          dashed: false,
          smooth: false,
          points: [
            { x: 1, y: 2 },
            { x: 9, y: 8 },
          ],
        },
        {
          id: "c3",
          label: "AD",
          color: "blue",
          dashed: false,
          smooth: false,
          points: [
            { x: 1, y: 8 },
            { x: 8, y: 1.5 },
          ],
        },
      ],
      points: [{ label: "E", x: 4.574, y: 4.681, xGuide: "Y₁", yGuide: "PL₁" }],
      marks: [{ axis: "x", at: 6, label: "Yf" }],
      arrows: [
        {
          from: { x: 4.57, y: 0.7 },
          to: { x: 6, y: 0.7 },
          label: "Recessionary gap",
          double: true,
        },
      ],
      regions: [],
      texts: [],
    },
  },
  {
    name: "tax wedge",
    sketch: {
      xLabel: "Quantity (Q)",
      yLabel: "Price (P)",
      axes: true,
      bounds: { left: 0, right: 10, bottom: 0, top: 10 },
      curves: [
        {
          id: "c1",
          label: "S",
          color: "blue",
          dashed: false,
          smooth: false,
          points: [
            { x: 1, y: 1.5 },
            { x: 9, y: 5.5 },
          ],
        },
        {
          id: "c2",
          label: "S + tax",
          color: "blue",
          dashed: false,
          smooth: false,
          points: [
            { x: 1, y: 2.5 },
            { x: 9, y: 6.5 },
          ],
        },
        {
          id: "c3",
          label: "D",
          color: "red",
          dashed: false,
          smooth: false,
          points: [
            { x: 1, y: 8.5 },
            { x: 9, y: 4.5 },
          ],
        },
      ],
      points: [
        { label: "E₀", x: 8, y: 5, xGuide: "Q₀", yGuide: "P₀" },
        { label: "E₁", x: 7, y: 5.5, xGuide: "Q₁", yGuide: "Pc" },
        { label: null, x: 7, y: 4.5, xGuide: "", yGuide: "Pp" },
      ],
      marks: [],
      arrows: [],
      regions: [
        {
          label: "Tax revenue",
          color: "neutral",
          polygon: [
            { x: 0, y: 4.5 },
            { x: 7, y: 4.5 },
            { x: 7, y: 5.5 },
            { x: 0, y: 5.5 },
          ],
          between: null,
        },
        {
          label: "Deadweight loss",
          color: "amber",
          polygon: [
            { x: 7, y: 4.5 },
            { x: 7, y: 5.5 },
            { x: 8, y: 5 },
          ],
          between: null,
        },
      ],
      texts: [],
    },
  },
  {
    name: "energy profile with catalyst",
    sketch: {
      xLabel: "Progress of reaction",
      yLabel: "Energy",
      axes: true,
      bounds: { left: 0, right: 10, bottom: 0, top: 10 },
      curves: [
        {
          id: "c1",
          label: null,
          color: "blue",
          dashed: false,
          smooth: true,
          points: [
            { x: 0.5, y: 5 },
            { x: 2, y: 5 },
            { x: 4.5, y: 8.5 },
            { x: 7, y: 2.5 },
            { x: 9.5, y: 2.5 },
          ],
        },
        {
          id: "c2",
          label: null,
          color: "blue",
          dashed: true,
          smooth: true,
          points: [
            { x: 0.5, y: 5 },
            { x: 2, y: 5 },
            { x: 4.5, y: 6.8 },
            { x: 7, y: 2.5 },
            { x: 9.5, y: 2.5 },
          ],
        },
        {
          id: "c3",
          label: null,
          color: "neutral",
          dashed: true,
          smooth: false,
          points: [
            { x: 2, y: 5 },
            { x: 5.4, y: 5 },
          ],
        },
        {
          id: "c4",
          label: null,
          color: "neutral",
          dashed: true,
          smooth: false,
          points: [
            { x: 7, y: 5 },
            { x: 9.3, y: 5 },
          ],
        },
      ],
      points: [],
      marks: [],
      arrows: [
        {
          from: { x: 4.5, y: 5 },
          to: { x: 4.5, y: 8.5 },
          label: "Eₐ",
          double: false,
        },
        {
          from: { x: 3.6, y: 5 },
          to: { x: 3.6, y: 6.268 },
          label: "Eₐ (catalysed)",
          double: false,
        },
        {
          from: { x: 9, y: 5 },
          to: { x: 9, y: 2.5 },
          label: "ΔH",
          double: false,
        },
      ],
      regions: [],
      texts: [
        { x: 1.2, y: 5.6, text: "Reactants" },
        { x: 8.6, y: 3.1, text: "Products" },
        { x: 4.5, y: 6.2, text: "With catalyst" },
        { x: 4.5, y: 9.2, text: "Without catalyst" },
      ],
    },
  },
  {
    name: "Lorenz curve with both labels at the top corner",
    sketch: {
      xLabel: "Cumulative % of population",
      yLabel: "Cumulative % of income",
      axes: true,
      bounds: { left: 0, right: 10, bottom: 0, top: 10 },
      curves: [
        {
          id: "c1",
          label: "Line of equality",
          color: "blue",
          dashed: false,
          smooth: false,
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 10 },
          ],
        },
        {
          id: "c2",
          label: "Lorenz curve",
          color: "red",
          dashed: false,
          smooth: true,
          points: [
            { x: 0, y: 0 },
            { x: 3, y: 1 },
            { x: 5, y: 2.5 },
            { x: 7, y: 4.5 },
            { x: 9, y: 7.6 },
            { x: 10, y: 10 },
          ],
        },
      ],
      points: [],
      marks: [
        { axis: "x", at: 10, label: "100%" },
        { axis: "y", at: 10, label: "100%" },
      ],
      arrows: [],
      regions: [
        {
          label: "A",
          color: "blue",
          polygon: null,
          between: { upper: "c1", lower: "c2", from: 0, to: 10 },
        },
        {
          label: "B",
          color: "neutral",
          polygon: null,
          between: { upper: "c2", lower: null, from: 0, to: 10 },
        },
      ],
      texts: [{ x: 7.3, y: 8.3, text: "Gini = A ÷ (A + B)" }],
    },
  },
];
