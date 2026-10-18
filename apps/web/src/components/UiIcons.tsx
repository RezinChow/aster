import type { ReactNode, SVGProps } from 'react';

const base: SVGProps<SVGSVGElement> = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export function IconSearch(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16.5 16.5 21 21" />
    </svg>
  );
}

export function IconPlus(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconDownload(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />
    </svg>
  );
}

export function IconCopy(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="1.5" />
      <path d="M6.5 15.5H5.5A1.5 1.5 0 0 1 4 14V5.5A1.5 1.5 0 0 1 5.5 4H14A1.5 1.5 0 0 1 15.5 5.5V6.5" />
    </svg>
  );
}

export function IconPath(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 12h7.5" />
      <path d="M9 8.5 12.5 12 9 15.5" />
      <path d="M14 7h3.5A2.5 2.5 0 0 1 20 9.5v5a2.5 2.5 0 0 1-2.5 2.5H14" />
    </svg>
  );
}

export function IconFileText(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3.5h7.2L19.5 8.8V19.5A1.5 1.5 0 0 1 18 21H7A1.5 1.5 0 0 1 5.5 19.5V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14.2 3.5V8.5H19" />
      <path d="M8.5 12.5h7M8.5 16h5" />
    </svg>
  );
}

export function IconPlay(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M8 6.5v11l10-5.5L8 6.5Z" />
    </svg>
  );
}

export function IconMore(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconUser(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5 19a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function IconEdit(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M13.5 6.5l3 3" />
    </svg>
  );
}

export function IconBan(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M7 7l10 10" />
    </svg>
  );
}

export function IconLock(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function IconCheck(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  );
}

export function IconCheckSquare(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="m8.5 12 2.4 2.4 4.6-5" />
    </svg>
  );
}

export function IconSwap(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h13" />
      <path d="m13.5 3.5 4 3.5-4 3.5" />
      <path d="M20 17H7" />
      <path d="m10.5 13.5-4 3.5 4 3.5" />
    </svg>
  );
}

export function IconX(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconEye(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconClock(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

export function IconRotateCcw(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  );
}

export function IconChevronDown(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconChevronRight(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function IconMail(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4.5 7.5 7.5 6 7.5-6" />
    </svg>
  );
}

export function IconLogOut(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M10 6H6.5A2.5 2.5 0 0 0 4 8.5v7A2.5 2.5 0 0 0 6.5 18H10" />
      <path d="M14 12H21M18 8l4 4-4 4" />
    </svg>
  );
}

export function IconBuilding(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20V8l8-4 8 4v12" />
      <path d="M9 20v-5h6v5" />
      <path d="M9 11h.01M15 11h.01M12 11h.01" />
    </svg>
  );
}

export function IconLayers(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5 3.5 8 12 12.5 20.5 8 12 3.5z" />
      <path d="M3.5 12.5 12 17l8.5-4.5" />
      <path d="M3.5 16.5 12 21l8.5-4.5" />
    </svg>
  );
}

export function IconFilter(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

export function IconBarChart(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 19.5h16" />
      <path d="M7 16V10.5" />
      <path d="M12 16V6.5" />
      <path d="M17 16v-3.5" />
    </svg>
  );
}

export function IconSettings(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6" />
    </svg>
  );
}

export function IconTerminal(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="m7.5 9.5 3 3-3 3" />
      <path d="M12.5 15.5h4" />
    </svg>
  );
}

export function IconServer(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3.5" width="18" height="6.5" rx="1.5" />
      <rect x="3" y="14" width="18" height="6.5" rx="1.5" />
      <path d="M7 6.75h.01M7 17.25h.01" />
    </svg>
  );
}

export function withIcon(icon: ReactNode, label: string) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="opacity-80">{icon}</span>
      {label}
    </span>
  );
}

export function IconTrash(props?: SVGProps<SVGSVGElement>) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
    </svg>
  );
}
