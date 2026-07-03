function ChemistryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M9.5 3h5M10.5 3v6.2L5.8 17a3 3 0 0 0 2.7 4.4h7a3 3 0 0 0 2.7-4.4L13.5 9.2V3"
        fill="none"
        stroke="#62655c"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8.1 14.5h7.8l2 3.7a1.6 1.6 0 0 1-1.4 2.4h-9a1.6 1.6 0 0 1-1.4-2.4l2-3.7z" fill="#6fd420" />
      <circle cx="10.5" cy="17.5" r="0.9" fill="#eaf5df" />
      <circle cx="13.8" cy="18.6" r="0.7" fill="#eaf5df" />
    </svg>
  );
}

function BiologyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M8 2.5c0 5 8 6 8 11M16 2.5c0 5-8 6-8 11M8 13.5c0 5 8 3 8 8M16 13.5c0 5-8 3-8 8"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M9 5.5h6M9 10.5h6M9.5 16h5M10 19.5h4"
        stroke="#0284c7"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MathIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#fef3c7" />
      <path
        d="M8 8.2h8M8.4 8.2c2.6 2.4 4.4 5 3 7.6-.8 1.5-2.6 1.6-3.4.6M16 8.2c-2.6 2.4-4.4 5-3 7.6"
        fill="none"
        stroke="#d97706"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhysicsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <ellipse cx="12" cy="12" rx="9" ry="3.6" fill="none" stroke="#a78bfa" strokeWidth="1.5" />
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="3.6"
        fill="none"
        stroke="#7c3aed"
        strokeWidth="1.5"
        transform="rotate(60 12 12)"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="3.6"
        fill="none"
        stroke="#a78bfa"
        strokeWidth="1.5"
        transform="rotate(-60 12 12)"
      />
      <circle cx="12" cy="12" r="2" fill="#7c3aed" />
    </svg>
  );
}

function EnglishIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 5.5C10.2 4 7.6 3.4 4.5 3.6v14.8c3.1-.2 5.7.4 7.5 1.9 1.8-1.5 4.4-2.1 7.5-1.9V3.6c-3.1-.2-5.7.4-7.5 1.9v14.8"
        fill="#ffe4e6"
        stroke="#f43f5e"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M7 8h3M7 11.5h3M14 8h3M14 11.5h3" stroke="#fb7185" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

const icons: Record<string, React.ElementType> = {
  chemistry: ChemistryIcon,
  biology: BiologyIcon,
  math: MathIcon,
  physics: PhysicsIcon,
  english: EnglishIcon,
};

export function WorkspaceIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const Icon = icons[icon] ?? ChemistryIcon;
  return <Icon className={className} />;
}
