"use client";

import {
  DensityWidget,
  IdealGasWidget,
  OhmsLawWidget,
  ProjectileWidget,
  PendulumWidget,
  WaveWidget,
  HalfLifeWidget,
  HookeWidget,
  MatrixMultiplicationWidget,
} from "./widgets";
import {
  FunctionGrapher,
  DataSeriesGraph,
  UnitCircleWidget,
  NormalDistWidget,
  VectorAdditionWidget,
} from "./desmos";

export type WidgetId =
  | "density"
  | "ideal-gas"
  | "ohms-law"
  | "projectile"
  | "pendulum"
  | "wave"
  | "half-life"
  | "hooke"
  | "function-grapher"
  | "unit-circle"
  | "normal-distribution"
  | "vector-addition"
  | "matrix-multiplication";

export const widgetRegistry: Record<
  WidgetId,
  { label: string; component: React.ComponentType }
> = {
  density: { label: "Density explorer", component: DensityWidget },
  "ideal-gas": { label: "Ideal gas law", component: IdealGasWidget },
  "ohms-law": { label: "Ohm's law circuit", component: OhmsLawWidget },
  projectile: { label: "Projectile motion", component: ProjectileWidget },
  pendulum: { label: "Simple pendulum", component: PendulumWidget },
  wave: { label: "Travelling wave", component: WaveWidget },
  "half-life": { label: "Radioactive decay", component: HalfLifeWidget },
  hooke: { label: "Hooke's law spring", component: HookeWidget },
  "function-grapher": { label: "Function grapher", component: FunctionGrapher },
  "unit-circle": { label: "Unit circle", component: UnitCircleWidget },
  "normal-distribution": {
    label: "Normal distribution",
    component: NormalDistWidget,
  },
  "vector-addition": {
    label: "Vector addition",
    component: VectorAdditionWidget,
  },
  "matrix-multiplication": {
    label: "Matrix multiplication visualiser",
    component: MatrixMultiplicationWidget,
  },
};

export function InteractiveWidget({ id }: { id: WidgetId }) {
  const entry = widgetRegistry[id];
  if (!entry) return null;
  const Component = entry.component;
  return <Component />;
}

export { DataSeriesGraph };
export type { SeriesPoint } from "./desmos";
