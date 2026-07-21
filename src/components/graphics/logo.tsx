export function ScribeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label="Scribe logo">
      <circle cx="12" cy="12.5" r="9" fill="#6fd420" />
      <circle cx="20.5" cy="19.5" r="9" fill="#3e8f04" opacity="0.9" />
      <circle cx="16" cy="16" r="4" fill="#eaf5df" />
    </svg>
  );
}

export function ScribeLogo({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className ?? ""} hover:cursor-pointer`}>
      <ScribeMark className="h-6 w-6" />
      <span className="text-sm font-medium tracking-tight">Scribe</span>
    </span>
  );
}
