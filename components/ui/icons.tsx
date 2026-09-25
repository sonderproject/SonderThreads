/** Minimal line icons for the mobile tab bar. Inherit color from currentColor. */
type IconProps = { className?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export const HomeIcon = ({ className = "h-6 w-6" }: IconProps) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M4 17l6-5-6-5" />
    <path d="M12 19h8" />
  </svg>
);

export const PeopleIcon = ({ className = "h-6 w-6" }: IconProps) => (
  <svg {...base} className={className} aria-hidden>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
    <path d="M16 4.8a3.5 3.5 0 010 6.4M18.5 14.8c1.6.8 2.6 2.6 3 5.2" />
  </svg>
);

export const TasksIcon = ({ className = "h-6 w-6" }: IconProps) => (
  <svg {...base} className={className} aria-hidden>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
    <path d="M8 12.5l2.8 2.8L16.5 9" />
  </svg>
);

export const CalendarIcon = ({ className = "h-6 w-6" }: IconProps) => (
  <svg {...base} className={className} aria-hidden>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);

export const MoreIcon = ({ className = "h-6 w-6" }: IconProps) => (
  <svg {...base} className={className} aria-hidden>
    <circle cx="5.5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1.2" fill="currentColor" />
  </svg>
);

export const PlusIcon = ({ className = "h-6 w-6" }: IconProps) => (
  <svg {...base} strokeWidth={2.2} className={className} aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const SnoozeIcon = ({ className = "h-4 w-4" }: IconProps) => (
  <svg {...base} className={className} aria-hidden>
    <circle cx="12" cy="13" r="7.5" />
    <path d="M12 9.5V13l2.5 1.5M4.5 4.5l2.5-2M19.5 4.5l-2.5-2" />
  </svg>
);

export const MicIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg {...base} className={className} aria-hidden>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" />
  </svg>
);

export const SendIcon = ({ className = "h-5 w-5" }: IconProps) => (
  <svg {...base} strokeWidth={2} className={className} aria-hidden>
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
);
