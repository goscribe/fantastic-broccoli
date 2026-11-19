"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { useEquippedOutfit, type OutfitId } from "@/lib/rewards";

/**
 * The cat mascot with an optional shop outfit drawn over it.
 *
 * Each pose is a flat PNG; the outfits are hand-drawn SVG accessories placed
 * from per-pose landmarks measured in the PNG's own pixels (ear tips, eye
 * centres). The overlay uses the PNG's size as its viewBox, so it scales with
 * the image at any size. Headphone bands sit in a layer *behind* the image —
 * the PNG is transparent around the cat, so the band shows above the head
 * and disappears behind the ears.
 */

export type MascotPose =
  | "wave"
  | "cheer"
  | "flame"
  | "pencil"
  | "book"
  | "think"
  | "trophy"
  | "sleep";

type Pt = readonly [number, number];
interface PoseInfo {
  w: number;
  h: number;
  earL: Pt;
  earR: Pt;
  eyeL: Pt;
  eyeR: Pt;
  /** Outfits that can't be placed convincingly on this pose. */
  skip?: readonly OutfitId[];
}

const POSES: Record<MascotPose, PoseInfo> = {
  wave: { w: 240, h: 255, earL: [96, 0], earR: [173, 1], eyeL: [108.5, 57.5], eyeR: [163.5, 58] },
  flame: { w: 235, h: 260, earL: [105, 0], earR: [183, 0], eyeL: [118.5, 59], eyeR: [171.5, 59.5] },
  pencil: { w: 234, h: 262, earL: [102, 1], earR: [182, 0], eyeL: [118.5, 58.5], eyeR: [168.5, 60] },
  book: { w: 240, h: 260, earL: [101, 0], earR: [179, 0], eyeL: [113.5, 59.5], eyeR: [167.5, 59.5] },
  think: { w: 230, h: 259, earL: [98, 0], earR: [179, 0], eyeL: [116, 55.5], eyeR: [165.5, 57] },
  trophy: { w: 276, h: 261, earL: [119, 0], earR: [197, 1], eyeL: [132.5, 59.5], eyeR: [186, 59.5] },
  sleep: { w: 264, h: 255, earL: [97, 0], earR: [176, 0], eyeL: [110.5, 57.5], eyeR: [165.5, 57.5] },
  // Head tilted ~14° and turned: hats follow the ears; glasses follow the eyes.
  cheer: { w: 244, h: 288, earL: [93, 2], earR: [172, 22], eyeL: [95.5, 53], eyeR: [136, 66] },
};

const INK = "#3a2420";

/** Transform into a frame centred between two points, x-axis along them, scaled to `unit` px apart. */
function frame(a: Pt, b: Pt, unit: number): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const scale = Math.hypot(dx, dy) / unit;
  return `translate(${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2}) rotate(${angle.toFixed(2)}) scale(${scale.toFixed(3)})`;
}

// --- Accessories. Hat coordinates: ear tips at (±39, 0), head top dip ≈ y 24,
// head ≈ ±63 wide at y 40 and ±71 at y 60. Glasses: eyes at (±27.5, 0).

function Beanie() {
  return (
    <g stroke={INK} strokeWidth={3.5} strokeLinejoin="round">
      <path d="M-63 34 C-66 4 -44 -18 0 -19 C44 -18 66 4 63 34 Z" fill="#e8506d" />
      <path d="M-30 -10 C-34 6 -36 18 -36 30 M0 -18 L0 30 M30 -10 C34 6 36 18 36 30" fill="none" stroke="#c93a57" strokeWidth={3} />
      <rect x={-68} y={24} width={136} height={21} rx={10} fill="#f7c948" />
      <path d="M-50 28v13M-34 28v13M-18 28v13M-2 28v13M14 28v13M30 28v13M46 28v13" stroke="#dba52a" strokeWidth={3} />
      <circle cx={0} cy={-24} r={11} fill="#fff4e0" />
    </g>
  );
}

function GradCap() {
  return (
    <g stroke={INK} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round">
      <path d="M-46 12 L-46 30 C-20 37 20 37 46 30 L46 12 Z" fill="#2f2b3a" />
      <path d="M-74 4 L0 -17 L74 4 L0 25 Z" fill="#3d3850" />
      <path d="M0 4 L50 10 L54 34" fill="none" stroke="#f5b301" strokeWidth={3} />
      <path d="M49 33 h10 l-2 12 h-6 Z" fill="#f5b301" strokeWidth={2.5} />
      <circle cx={0} cy={4} r={4.5} fill="#f5b301" strokeWidth={2.5} />
    </g>
  );
}

function Crown() {
  return (
    <g stroke={INK} strokeWidth={3.5} strokeLinejoin="round" transform="rotate(-6 0 20)">
      <path d="M-25 30 L-29 2 L-13 14 L0 -6 L13 14 L29 2 L25 30 Z" fill="#f8c537" />
      <path d="M-26 22 L26 22" stroke="#d99a16" strokeWidth={3} />
      <circle cx={-29} cy={1} r={3.5} fill="#fff4e0" strokeWidth={2.5} />
      <circle cx={0} cy={-7} r={4} fill="#fff4e0" strokeWidth={2.5} />
      <circle cx={29} cy={1} r={3.5} fill="#fff4e0" strokeWidth={2.5} />
      <circle cx={0} cy={15} r={4.5} fill="#e8506d" strokeWidth={2.5} />
    </g>
  );
}

function HeadphoneBand() {
  return (
    <g fill="none" strokeLinecap="round">
      <path d="M-72 52 C-78 -34 78 -34 72 52" stroke={INK} strokeWidth={12} />
      <path d="M-72 52 C-78 -34 78 -34 72 52" stroke="#5b5f73" strokeWidth={6} />
    </g>
  );
}

function HeadphoneCups() {
  return (
    <g stroke={INK} strokeWidth={3.5}>
      <rect x={-84} y={42} width={24} height={40} rx={11} fill="#2fb6a9" />
      <rect x={60} y={42} width={24} height={40} rx={11} fill="#2fb6a9" />
      <rect x={-78} y={50} width={8} height={24} rx={4} fill="#8fe3d9" strokeWidth={0} />
      <rect x={70} y={50} width={8} height={24} rx={4} fill="#8fe3d9" strokeWidth={0} />
    </g>
  );
}

function Glasses() {
  return (
    <g stroke={INK} strokeWidth={3.5} strokeLinecap="round">
      <circle cx={-28} cy={1} r={16} fill="rgba(255,255,255,0.28)" />
      <circle cx={28} cy={1} r={16} fill="rgba(255,255,255,0.28)" />
      <path d="M-12 -1 Q0 -7 12 -1" fill="none" />
      <path d="M-44 -2 L-58 -7 M44 -2 L58 -7" fill="none" />
      <path d="M-37 -7 Q-33 -11 -28 -11" fill="none" stroke="#fff" strokeWidth={2.5} />
      <path d="M19 -7 Q23 -11 28 -11" fill="none" stroke="#fff" strokeWidth={2.5} />
    </g>
  );
}

function OutfitLayer({ pose, outfit, layer }: { pose: PoseInfo; outfit: OutfitId; layer: "back" | "front" }) {
  const head = frame(pose.earL, pose.earR, 78);
  if (layer === "back") {
    return outfit === "outfit_headphones" ? <g transform={head}><HeadphoneBand /></g> : null;
  }
  switch (outfit) {
    case "outfit_glasses":
      return <g transform={frame(pose.eyeL, pose.eyeR, 55)}><Glasses /></g>;
    case "outfit_beanie":
      return <g transform={head}><Beanie /></g>;
    case "outfit_grad_cap":
      return <g transform={head}><GradCap /></g>;
    case "outfit_crown":
      return <g transform={head}><Crown /></g>;
    case "outfit_headphones":
      return <g transform={head}><HeadphoneCups /></g>;
  }
}

export function Mascot({
  pose,
  outfit = "equipped",
  className,
  style,
  priority,
}: {
  pose: MascotPose;
  /** "equipped" wears whatever the student has on; null shows the plain cat. */
  outfit?: OutfitId | null | "equipped";
  /** Size and animation classes; applied to the wrapper so the outfit moves with the cat. */
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
}) {
  const equipped = useEquippedOutfit();
  const info = POSES[pose];
  const worn = outfit === "equipped" ? equipped : outfit;
  const shown = worn && !info.skip?.includes(worn) ? worn : null;
  const viewBox = `0 0 ${info.w} ${info.h}`;
  const svgClass = "pointer-events-none absolute inset-0 h-full w-full overflow-visible";

  return (
    <span
      aria-hidden
      className={cn("relative inline-block shrink-0 select-none", className)}
      style={{ aspectRatio: `${info.w} / ${info.h}`, ...style }}
    >
      {shown === "outfit_headphones" && (
        <svg viewBox={viewBox} className={svgClass}>
          <OutfitLayer pose={info} outfit={shown} layer="back" />
        </svg>
      )}
      <Image
        src={`/design/cat2-${pose}.png`}
        alt=""
        width={info.w}
        height={info.h}
        unoptimized
        priority={priority}
        draggable={false}
        className="relative block h-full w-full object-contain"
      />
      {shown && (
        <svg viewBox={viewBox} className={svgClass}>
          <OutfitLayer pose={info} outfit={shown} layer="front" />
        </svg>
      )}
    </span>
  );
}
