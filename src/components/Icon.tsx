const PATHS = {
  trophy: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  users: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.74",
  calendar: "M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
  check: "M5 12.5 10 17 19 8",
  alert: "M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  close: "M6 6l12 12M18 6 6 18",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z",
  logout: "M15 17l5-5-5-5M20 12H9M12 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7",
  bracket: "M3 5h5v5H3M3 14h5v5H3M8 7.5h3v9H8M11 12h4M15 9.5h6v5h-6",
  book: "M4 19V5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h13",
  edit: "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4",
  user: "M20 21a8 8 0 1 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Bola 8 (marca do site). */
export function EightBall({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <defs>
        <radialGradient id="b8" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#5a3a8a" />
          <stop offset="45%" stopColor="#1a0b2e" />
          <stop offset="100%" stopColor="#050208" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill="url(#b8)" stroke="#9b4dff" strokeWidth="1.5" />
      <circle cx="20" cy="18" r="8.5" fill="#f5f0ff" />
      <text x="20" y="22.5" textAnchor="middle" fontSize="12" fontWeight="900" fill="#1a0b2e" fontFamily="inherit">
        8
      </text>
    </svg>
  );
}
