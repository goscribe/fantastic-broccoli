/**
 * Decorative, theme-aware SVG illustrations for the marketing landing page.
 * All colors reference CSS variables (var(--accent), var(--border), …) so the
 * artwork adapts automatically to light and dark themes. Flat, minimal style
 * matching src/components/graphics/*.
 */

/** Soft accent glow blobs for section backgrounds (purely decorative). */
export function GlowField({ className }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}>
      <div
        className="absolute -left-24 -top-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent-bright), transparent 70%)" }}
      />
      <div
        className="absolute -right-16 top-1/3 h-80 w-80 rounded-full opacity-[0.12] blur-3xl"
        style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }}
      />
    </div>
  );
}

/** Faint dotted grid, masked to a soft ellipse. */
export function DotGrid({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute ${className ?? ""}`}
      style={{
        backgroundImage: "radial-gradient(var(--border-strong) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
        maskImage: "radial-gradient(ellipse 65% 65% at 50% 40%, black, transparent 72%)",
        WebkitMaskImage: "radial-gradient(ellipse 65% 65% at 50% 40%, black, transparent 72%)",
      }}
    />
  );
}

/** Step 1 — uploading source materials into Scribe. */
export function StepUploadArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 96" className={className} aria-hidden fill="none">
      <rect x="2" y="10" width="116" height="80" rx="10" fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
      {/* stacked document cards */}
      <g transform="rotate(-8 40 52)">
        <rect x="20" y="30" width="34" height="44" rx="4" fill="var(--muted)" stroke="var(--border-strong)" strokeWidth="1.4" />
      </g>
      <rect x="30" y="26" width="34" height="44" rx="4" fill="var(--card)" stroke="var(--border-strong)" strokeWidth="1.4" />
      <rect x="36" y="34" width="22" height="2.6" rx="1.3" fill="var(--accent)" />
      <rect x="36" y="40" width="22" height="2.6" rx="1.3" fill="var(--border-strong)" />
      <rect x="36" y="46" width="15" height="2.6" rx="1.3" fill="var(--border-strong)" />
      {/* upload cloud + arrow */}
      <path
        d="M78 60a9 9 0 0 1 1-17.9A12 12 0 0 1 102 40a8.5 8.5 0 0 1 1 16.9"
        fill="var(--accent-soft)"
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M90 66V48m0 0l-6 6m6-6l6 6" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Step 2 — a generated, structured study plan. */
export function StepPlanArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 96" className={className} aria-hidden fill="none">
      <rect x="10" y="8" width="100" height="84" rx="10" fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
      {/* header + progress */}
      <rect x="22" y="18" width="40" height="4" rx="2" fill="var(--accent)" />
      <rect x="22" y="26" width="76" height="4" rx="2" fill="var(--muted)" />
      <rect x="22" y="26" width="46" height="4" rx="2" fill="var(--accent-bright)" />
      {/* task rows */}
      {[42, 56, 70].map((y, i) => (
        <g key={y}>
          <rect x="22" y={y - 6} width="76" height="13" rx="4" fill="var(--muted)" opacity="0.55" />
          <circle cx="30" cy={y} r="4.5" fill={i < 2 ? "var(--accent)" : "none"} stroke="var(--accent)" strokeWidth="1.5" />
          {i < 2 && <path d={`M27.8 ${y}l1.6 1.6 3-3.2`} stroke="var(--accent-foreground)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
          <rect x="40" y={y - 1.5} width={i === 0 ? 40 : i === 1 ? 52 : 34} height="3" rx="1.5" fill="var(--foreground)" opacity="0.5" />
        </g>
      ))}
    </svg>
  );
}

/** Step 3 — studying alongside the AI copilot. */
export function StepCopilotArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 96" className={className} aria-hidden fill="none">
      <rect x="8" y="10" width="104" height="76" rx="10" fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
      {/* incoming bubble */}
      <path d="M22 30a5 5 0 0 1 5-5h34a5 5 0 0 1 5 5v9a5 5 0 0 1-5 5H31l-6 6v-6h-3a5 5 0 0 1 0-14z" fill="var(--muted)" />
      <rect x="30" y="31" width="26" height="2.6" rx="1.3" fill="var(--muted-foreground)" />
      <rect x="30" y="36" width="18" height="2.6" rx="1.3" fill="var(--muted-foreground)" opacity="0.6" />
      {/* copilot reply bubble */}
      <path d="M98 52a5 5 0 0 0-5-5H59a5 5 0 0 0-5 5v9a5 5 0 0 0 5 5h30l6 6v-6h3a5 5 0 0 0 0-14z" fill="var(--accent)" />
      <rect x="62" y="53" width="28" height="2.6" rx="1.3" fill="var(--accent-foreground)" />
      <rect x="62" y="58" width="20" height="2.6" rx="1.3" fill="var(--accent-foreground)" opacity="0.75" />
      {/* spark */}
      <path d="M92 22l1.6 4.4L98 28l-4.4 1.6L92 34l-1.6-4.4L86 28l4.4-1.6z" fill="var(--accent-bright)" />
    </svg>
  );
}

/** Small decorative "sparkle" cluster used as a section accent. */
export function SparkCluster({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden fill="none">
      <path d="M20 4l2.4 6.6L29 13l-6.6 2.4L20 22l-2.4-6.6L11 13l6.6-2.4z" fill="var(--accent)" />
      <path d="M31 22l1.3 3.6L36 27l-3.7 1.3L31 32l-1.3-3.7L26 27l3.7-1.4z" fill="var(--accent-bright)" opacity="0.8" />
    </svg>
  );
}
