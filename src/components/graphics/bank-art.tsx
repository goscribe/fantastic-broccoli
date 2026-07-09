export function WorksheetArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path
        d="M7 6a3 3 0 0 1 3-3h20a3 3 0 0 1 3 3v28a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V6z"
        fill="#e0f2fe"
      />
      <rect x="11" y="9" width="4" height="4" rx="1" fill="#38bdf8" />
      <rect x="18" y="10" width="11" height="2" rx="1" fill="#0284c7" />
      <rect x="11" y="17" width="4" height="4" rx="1" fill="#7dd3fc" />
      <rect x="18" y="18" width="11" height="2" rx="1" fill="#38bdf8" />
      <rect x="11" y="25" width="4" height="4" rx="1" fill="#7dd3fc" />
      <rect x="18" y="26" width="8" height="2" rx="1" fill="#38bdf8" />
      <path
        d="M11.6 10.8l1.2 1.2 2-2.4"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="31" cy="30" r="7" fill="#0ea5e9" />
      <path
        d="M28.5 30l1.8 1.8 3.2-3.8"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function FlashcardsArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect
        x="10"
        y="6"
        width="24"
        height="17"
        rx="3"
        fill="#fde68a"
        transform="rotate(6 22 14)"
      />
      <rect
        x="7"
        y="12"
        width="24"
        height="17"
        rx="3"
        fill="#fcd34d"
        transform="rotate(-3 19 20)"
      />
      <rect x="5" y="18" width="26" height="18" rx="3" fill="#f59e0b" />
      <rect x="9" y="23" width="14" height="2.2" rx="1.1" fill="#fffbeb" />
      <rect x="9" y="28" width="18" height="2.2" rx="1.1" fill="#fde68a" />
      <circle cx="33" cy="33" r="6" fill="#171c12" />
      <path
        d="M31 33a2 2 0 1 1 2 2m0 0v1.4"
        stroke="#fcd34d"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function GuideArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path
        d="M6 8a3 3 0 0 1 3-3h8a4 4 0 0 1 3 1.4A4 4 0 0 1 23 5h8a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3h-9a2 2 0 0 0-2 2 2 2 0 0 0-2-2H9a3 3 0 0 1-3-3V8z"
        fill="#eaf5df"
      />
      <path d="M20 6.4V35a2 2 0 0 0-.5-.6V6a4 4 0 0 1 .5.4z" fill="#4a9f06" />
      <rect x="10" y="11" width="7" height="1.8" rx="0.9" fill="#4a9f06" />
      <rect x="10" y="15" width="7" height="1.8" rx="0.9" fill="#79c94c" />
      <rect x="10" y="19" width="5" height="1.8" rx="0.9" fill="#79c94c" />
      <rect x="23" y="11" width="7" height="1.8" rx="0.9" fill="#4a9f06" />
      <rect x="23" y="15" width="7" height="1.8" rx="0.9" fill="#79c94c" />
      <rect x="23" y="19" width="5" height="1.8" rx="0.9" fill="#79c94c" />
      <circle cx="31" cy="31" r="6.5" fill="#3d8404" />
      <path
        d="M31 27.5v3.5l2.5 1.5"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function FigureArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect x="5" y="7" width="30" height="24" rx="3" fill="#ede9fe" />
      <circle cx="13" cy="14" r="3" fill="#c4b5fd" />
      <path d="M9 27l7-9 5 6 4-5 6 8H9z" fill="#8b5cf6" />
      <rect x="12" y="33" width="16" height="2.2" rx="1.1" fill="#a78bfa" />
    </svg>
  );
}
