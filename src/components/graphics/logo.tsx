export function ScribeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label="Scribe logo">
      <rect width="32" height="32" rx="8" fill="#171c12" />
      <circle cx="12" cy="12" r="6.5" fill="#6fd420" />
      <circle cx="21" cy="19" r="6.5" fill="#4a9f06" opacity="0.85" />
      <circle cx="16.5" cy="15.5" r="3" fill="#eaf5df" />
    </svg>
  );
}

export function ScribeLogo({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className ?? ""}`}>
      <ScribeMark className="h-6 w-6" />
      <span className="font-bold text-sm tracking-tight">Scribe</span>
    </span>
  );
}
