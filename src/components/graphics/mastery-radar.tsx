"use client";

export interface RadarDatum {
  topic: string;
  /** 0-100, or null when never studied. */
  proficiency: number | null;
}

const RINGS = [0.25, 0.5, 0.75, 1];
const WIDTH = 400;
const HEIGHT = 320;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const RADIUS = HEIGHT / 2 - 40;

function point(index: number, count: number, r: number): [number, number] {
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return [CENTER_X + r * Math.cos(angle), CENTER_Y + r * Math.sin(angle)];
}

function polygonPath(count: number, r: number): string {
  return (
    Array.from({ length: count }, (_, i) => {
      const [x, y] = point(i, count, r);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ") + " Z"
  );
}

/**
 * Radar (spider) chart of per-topic proficiency: a shaded polygon over a
 * ringed grid, one axis per topic. Renders up to 8 axes; never-studied
 * topics plot at 0.
 */
export function MasteryRadar({ data }: { data: RadarDatum[] }) {
  const axes = data.slice(0, 8);
  const count = Math.max(axes.length, 3);

  const valuePath =
    axes
      .map((d, i) => {
        const r = ((d.proficiency ?? 0) / 100) * RADIUS;
        const [x, y] = point(i, count, r);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full max-w-[400px]"
      role="img"
      aria-label="Proficiency by topic radar chart"
    >
      {RINGS.map((ring) => (
        <path
          key={ring}
          d={polygonPath(count, RADIUS * ring)}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, count, RADIUS);
        return (
          <line
            key={i}
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={x}
            y2={y}
            stroke="var(--border)"
            strokeWidth={1}
          />
        );
      })}
      <path
        d={valuePath}
        fill="var(--accent)"
        fillOpacity={0.18}
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {axes.map((d, i) => {
        const r = ((d.proficiency ?? 0) / 100) * RADIUS;
        const [x, y] = point(i, count, r);
        return (
          <circle key={i} cx={x} cy={y} r={3} fill="var(--accent)" />
        );
      })}
      {axes.map((d, i) => {
        const [x, y] = point(i, count, RADIUS + 16);
        const anchor =
          Math.abs(x - CENTER_X) < 8
            ? "middle"
            : x > CENTER_X
              ? "start"
              : "end";
        const label =
          d.topic.length > 14 ? `${d.topic.slice(0, 13)}…` : d.topic;
        return (
          <text
            key={i}
            x={x}
            y={y + 3}
            textAnchor={anchor}
            className="fill-muted-foreground"
            fontSize={10}
            fontWeight={600}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
