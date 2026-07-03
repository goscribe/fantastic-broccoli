export function PdfArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path
        d="M9 5a3 3 0 0 1 3-3h12l7 7v26a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V5z"
        fill="#ffe4e6"
      />
      <path d="M24 2l7 7h-5a2 2 0 0 1-2-2V2z" fill="#fda4af" />
      <rect x="13" y="16" width="14" height="2" rx="1" fill="#fb7185" />
      <rect x="13" y="21" width="14" height="2" rx="1" fill="#fda4af" />
      <rect x="13" y="26" width="9" height="2" rx="1" fill="#fda4af" />
      <rect x="6" y="29" width="17" height="8" rx="2" fill="#f43f5e" />
      <text
        x="14.5"
        y="35.2"
        textAnchor="middle"
        fontSize="6"
        fontWeight="700"
        fill="#fff"
        fontFamily="inherit"
      >
        PDF
      </text>
    </svg>
  );
}

export function NoteArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect x="7" y="4" width="26" height="32" rx="3" fill="#fef3c7" />
      <path d="M33 26v7a3 3 0 0 1-3 3h-7l10-10z" fill="#fcd34d" />
      <rect x="12" y="11" width="16" height="2" rx="1" fill="#f59e0b" />
      <rect x="12" y="16" width="16" height="2" rx="1" fill="#fbbf24" />
      <rect x="12" y="21" width="11" height="2" rx="1" fill="#fbbf24" />
      <path
        d="M25 30l7-7 3 3-7 7-3.7.7.7-3.7z"
        fill="#78716c"
        transform="translate(-1 -1)"
      />
    </svg>
  );
}

export function AudioArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <circle cx="20" cy="20" r="17" fill="#eaf5df" />
      <rect x="9" y="16" width="2.5" height="8" rx="1.25" fill="#79c94c" />
      <rect x="13.5" y="12" width="2.5" height="16" rx="1.25" fill="#4a9f06" />
      <rect x="18" y="8" width="2.5" height="24" rx="1.25" fill="#3d8404" />
      <rect x="22.5" y="13" width="2.5" height="14" rx="1.25" fill="#4a9f06" />
      <rect x="27" y="17" width="2.5" height="6" rx="1.25" fill="#79c94c" />
      <circle cx="31" cy="10" r="5" fill="#f43f5e" />
      <circle cx="31" cy="10" r="2" fill="#fff" />
    </svg>
  );
}

export function SlidesArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect x="4" y="6" width="32" height="22" rx="3" fill="#e0f2fe" />
      <rect x="8" y="10" width="12" height="2" rx="1" fill="#0284c7" />
      <rect x="8" y="15" width="8" height="8" rx="1.5" fill="#7dd3fc" />
      <path d="M19 23l4-6 3 4 2.5-3 3.5 5H19z" fill="#38bdf8" />
      <rect x="19" y="30" width="2.5" height="6" rx="1" fill="#94a3b8" transform="rotate(-20 20 33)" />
      <rect x="18.5" y="30" width="2.5" height="6" rx="1" fill="#94a3b8" transform="rotate(20 20 33)" />
      <rect x="18.7" y="27" width="2.6" height="4" rx="1" fill="#64748b" />
    </svg>
  );
}

export function SessionArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path
        d="M6 10a3 3 0 0 1 3-3h9v26H9a3 3 0 0 1-3-3V10z"
        fill="#eaf5df"
      />
      <path
        d="M34 10a3 3 0 0 0-3-3h-9v26h9a3 3 0 0 0 3-3V10z"
        fill="#d3ecba"
      />
      <rect x="9" y="12" width="6" height="1.8" rx="0.9" fill="#4a9f06" />
      <rect x="9" y="16" width="6" height="1.8" rx="0.9" fill="#79c94c" />
      <rect x="25" y="12" width="6" height="1.8" rx="0.9" fill="#4a9f06" />
      <rect x="25" y="16" width="6" height="1.8" rx="0.9" fill="#79c94c" />
      <rect x="18" y="7" width="4" height="26" rx="1" fill="#3d8404" />
      <circle cx="31" cy="30" r="7" fill="#171c12" />
      <path d="M29 27l5 3-5 3v-6z" fill="#6fd420" />
    </svg>
  );
}

export function UploadArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path
        d="M11 30a8 8 0 0 1-1.5-15.9A10 10 0 0 1 29 12a7.5 7.5 0 0 1 2 14.7"
        fill="#eaf5df"
      />
      <path
        d="M20 18l6 6h-3.8v8h-4.4v-8H14l6-6z"
        fill="#4a9f06"
      />
    </svg>
  );
}
