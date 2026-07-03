export function ScribeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label="Scribe logo">
      <rect width="32" height="32" rx="8" fill="#171c12" />
      <path
        d="M23.5 6.5c-4.6.4-8.7 2.3-11 5.2-1.7 2.1-2.5 4.7-2.3 7.4l-2.7 4.9c-.3.5.4 1.1.9.7l4.5-3.4c2.7-.1 5.2-1.2 7.1-3.2 2.6-2.7 3.8-7 3.5-11.6z"
        fill="#6fd420"
      />
      <path
        d="M23.5 6.5c-4.3 2.5-8.2 6-11.6 10.6l-1.4 2.5.9.5 1.6-2.4C16.5 13.4 20 10 23.5 6.5z"
        fill="#171c12"
        opacity="0.35"
      />
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
