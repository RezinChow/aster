import type { OsNavIcon } from './destinations';

export function OsIcon({
  name,
  size = 16,
  strokeWidth = 1.7,
}: {
  name: OsNavIcon;
  size?: number;
  strokeWidth?: number;
}) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'overview':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="9" rx="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1.5" />
        </svg>
      );
    case 'organizations':
      return (
        <svg {...props}>
          <path d="M4 20V8l8-4 8 4v12" />
          <path d="M9 20v-5h6v5" />
          <path d="M9 11h.01M15 11h.01M12 11h.01" />
        </svg>
      );
    case 'departments':
      return (
        <svg {...props}>
          <circle cx="12" cy="5" r="2.25" />
          <circle cx="6" cy="18" r="2.25" />
          <circle cx="18" cy="18" r="2.25" />
          <path d="M12 7.25V11M12 11H6.5v4.5M12 11h5.5v4.5" />
        </svg>
      );
    case 'users':
      return (
        <svg {...props}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 19a6 6 0 0 1 12 0" />
          <circle cx="17" cy="9" r="2.25" />
          <path d="M14.5 19a4.5 4.5 0 0 1 6.5-4" />
        </svg>
      );
    case 'roles':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3" />
          <path d="M6 19a6 6 0 0 1 12 0" />
          <path d="M17.5 6.5 19 8l2.5-3" />
        </svg>
      );
    case 'permissions':
      return (
        <svg {...props}>
          <rect x="4" y="10" width="16" height="10" rx="2" />
          <path d="M8 10V8a4 4 0 0 1 8 0v2" />
          <circle cx="12" cy="15" r="1.25" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'agents':
      return (
        <svg {...props}>
          <rect x="5" y="7" width="14" height="12" rx="3" />
          <path d="M9 11h.01M15 11h.01M9 15h6" />
          <path d="M12 7V4M9 4h6" />
        </svg>
      );
    case 'workflows':
      return (
        <svg {...props}>
          <path d="M5 6h9a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h11" />
          <path d="M17 6l2 2-2 2M7 18l-2-2 2-2" />
        </svg>
      );
    case 'tasks':
      return (
        <svg {...props}>
          <path d="M9 6h11M9 12h11M9 18h11" />
          <path d="M5 6h.01M5 12h.01M5 18h.01" />
        </svg>
      );
    case 'functions':
      return (
        <svg {...props}>
          <path d="M15 3.5c-4.2 0-6.2 2.4-6.2 6.6V21" />
          <path d="M6.5 12h10" />
          <path d="M8.8 21c1.4 1.6 3.4 2 5.4 1" />
        </svg>
      );
    case 'cells':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="8" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
          <rect x="13" y="13" width="8" height="8" rx="1.5" />
        </svg>
      );
    case 'modelService':
      return (
        <svg {...props}>
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z" />
        </svg>
      );
    case 'marketplace':
      return (
        <svg {...props}>
          <path d="M4 9h16l-1.5 9.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 9Z" />
          <path d="M8 9V7a4 4 0 0 1 8 0v2" />
        </svg>
      );
    case 'entitlements':
      return (
        <svg {...props}>
          <path d="M5 6h14v12H5z" />
          <path d="M8 10h8M8 14h5" />
          <path d="M16.5 13.5l1 1 2-2" />
        </svg>
      );
    case 'applications':
      return (
        <svg {...props}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M4 9h16M9 9v11" />
        </svg>
      );
    case 'models':
      return (
        <svg {...props}>
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
          <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
        </svg>
      );
    case 'applets':
      return (
        <svg {...props}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'apiServices':
      return (
        <svg {...props}>
          <path d="M8 7h8v3H8zM8 14h8v3H8z" />
          <path d="M5 8.5H3M5 15.5H3M21 8.5h-2M21 15.5h-2" />
          <path d="M12 10v4" />
        </svg>
      );
    case 'connectors':
      return (
        <svg {...props}>
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="7" r="2.5" />
          <circle cx="18" cy="17" r="2.5" />
          <path d="M8.4 11.2 15.6 8.2M8.4 12.8 15.6 15.8" />
        </svg>
      );
    case 'plugins':
      return (
        <svg {...props}>
          <path d="M9 3h6v4h4v6h-4v4H9v-4H5V7h4V3Z" />
          <path d="M11 9h2v6M9 11h6" />
        </svg>
      );
    case 'skills':
      return (
        <svg {...props}>
          <path d="M12 3l1.8 5.5H19l-4.4 3.2 1.7 5.3L12 14.8 7.7 17l1.7-5.3L5 8.5h5.2L12 3Z" />
        </svg>
      );
    case 'tools':
      return (
        <svg {...props}>
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-2.5 2.5-2.5Z" />
        </svg>
      );
    case 'knowledgeBases':
      return (
        <svg {...props}>
          <path d="M4 5h7a2 2 0 0 1 2 2v12a1.5 1.5 0 0 0-1.5-1.5H4V5Z" />
          <path d="M20 5h-7a2 2 0 0 0-2 2v12a1.5 1.5 0 0 1 1.5-1.5H20V5Z" />
        </svg>
      );
    case 'fleet':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
          <path d="M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M16.3 7.7l2.1-2.1M5.6 18.4l2.1-2.1" />
        </svg>
      );
    case 'gateway':
      return (
        <svg {...props}>
          <path d="M4 12h16" />
          <path d="M12 4v16" />
          <circle cx="12" cy="12" r="3" />
          <path d="M4 7h3M17 7h3M4 17h3M17 17h3" />
        </svg>
      );
    case 'topology':
      return (
        <svg {...props}>
          <path d="M4 14c2-4 4-6 8-6s6 2 8 6" />
          <path d="M4 18c2-3 4-4.5 8-4.5s6 1.5 8 4.5" />
          <circle cx="12" cy="8" r="2" />
        </svg>
      );
    case 'events':
      return (
        <svg {...props}>
          <path d="M4 6h16M4 12h10M4 18h13" />
          <circle cx="18" cy="12" r="2" />
          <circle cx="19" cy="18" r="2" />
        </svg>
      );
    case 'customers':
      return (
        <svg {...props}>
          <path d="M3 20h18" />
          <path d="M5 20V9l7-5 7 5v11" />
          <path d="M10 20v-5h4v5" />
        </svg>
      );
    case 'channels':
      return (
        <svg {...props}>
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="7" r="2.5" />
          <circle cx="18" cy="17" r="2.5" />
          <path d="M8.4 11.2L15.6 8.2M8.4 12.8L15.6 15.8" />
        </svg>
      );
    case 'suppliers':
      return (
        <svg {...props}>
          <path d="M3 20h18" />
          <path d="M5 20V10l3-3h8l3 3v10" />
          <path d="M9 20v-5h6v5" />
          <path d="M9 10h6" />
        </svg>
      );
    case 'orders':
      return (
        <svg {...props}>
          <path d="M6 4h12v16H6z" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </svg>
      );
    case 'subscriptions':
      return (
        <svg {...props}>
          <path d="M4 8h16v11H4z" />
          <path d="M8 8V6a4 4 0 0 1 8 0v2" />
          <path d="M9 13h6" />
        </svg>
      );
    case 'usage':
      return (
        <svg {...props}>
          <path d="M4 19.5h16" />
          <path d="M7.5 19.5V13" />
          <path d="M12 19.5V6.5" />
          <path d="M16.5 19.5V10" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852 1.01 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'settingsNotices':
      return (
        <svg {...props}>
          <path d="M7 3.5h7l4 4V20.5H7z" />
          <path d="M14 3.5V8h4" />
          <path d="M9.5 12h5M9.5 15.5h5" />
        </svg>
      );
    case 'settingsApps':
      return (
        <svg {...props}>
          <rect x="3" y="5" width="11" height="8" rx="1.5" />
          <path d="M7 13.5V16h4" />
          <rect x="15" y="8" width="6" height="11" rx="1.2" />
        </svg>
      );
    case 'settingsSystem':
      return (
        <svg {...props}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 9h8M8 12h8M8 15h5" />
        </svg>
      );
    case 'settingsBootstrap':
      return (
        <svg {...props}>
          <path d="M12 3v7" />
          <path d="M8.5 8.5 12 12l3.5-3.5" />
          <path d="M5 14.5A7 7 0 0 0 12 21a7 7 0 0 0 7-6.5" />
        </svg>
      );
    case 'settingsSms':
      return (<svg {...props}><path d="M21 14a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" /><path d="M8 9h8M8 13h5" /></svg>);
    case 'settingsLogin':
      return (
        <svg {...props}>
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <path d="m10 17 5-5-5-5M15 12H3" />
        </svg>
      );
    case 'settingsEntries':
      return (
        <svg {...props}>
          <path d="M8 7h12M8 12h12M8 17h8" />
          <path d="M4 7h.01M4 12h.01M4 17h.01" />
        </svg>
      );
    case 'settingsDebug':
      return (
        <svg {...props}>
          <path d="M8 4v3M16 4v3" />
          <path d="M9 20h6" />
          <path d="M8 17H6.5A2.5 2.5 0 0 1 4 14.5V10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v4.5a2.5 2.5 0 0 1-2.5 2.5H16" />
          <path d="M9 10h.01M15 10h.01M10 13.5h4" />
        </svg>
      );
    case 'settingsRegions':
      return (
        <svg {...props}>
          <path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" />
          <circle cx="12" cy="11" r="2" />
        </svg>
      );
    case 'settingsIndustries':
      return (
        <svg {...props}>
          <path d="M3 21h18" />
          <path d="M5 21V8l7-4 7 4v13" />
          <path d="M9 21v-5h6v5" />
          <path d="M9 11h.01M15 11h.01" />
        </svg>
      );
    case 'settingsChains':
      return (
        <svg {...props}>
          <path d="M10 13a5 5 0 0 0 7.54.54l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-2 2a5 5 0 0 0 7.07 7.07l1.15-1.15" />
        </svg>
      );
    case 'settingsAdministration':
      return (
        <svg {...props}>
          <path d="M4 21h16" />
          <path d="M12 3 3 10h18L12 3z" />
          <path d="M6 10v11" />
          <path d="M10 10v11" />
          <path d="M14 10v11" />
          <path d="M18 10v11" />
        </svg>
      );
    case 'settingsParks':
      return (
        <svg {...props}>
          <path d="M3 21h18" />
          <path d="M6 21V10l4-2v13" />
          <path d="M10 21V7l5-2v16" />
          <path d="M15 21V11h4v10" />
        </svg>
      );
    case 'settingsUniversities':
      return (
        <svg {...props}>
          <path d="M22 10 12 5 2 10l10 5 10-5z" />
          <path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
          <path d="M22 10v6" />
        </svg>
      );
    case 'settingsTags':
      return (
        <svg {...props}>
          <path d="M20.2 13.3 12.8 20.7a2 2 0 0 1-2.8 0L3 13.7V4h9.7l7.5 7.5a2 2 0 0 1 0 2.8z" />
          <circle cx="7.5" cy="8.5" r="1" />
        </svg>
      );
    case 'hubDocuments':
      return (
        <svg {...props}>
          <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
          <path d="M14 3.5V8h4M8.5 12h7M8.5 16h5" />
        </svg>
      );
    case 'hubWiki':
      return (
        <svg {...props}>
          <path d="M5 5.5h6.5A2.5 2.5 0 0 1 14 8v11.5H7.5A2.5 2.5 0 0 0 5 22V5.5Z" />
          <path d="M19 5.5h-6.5A2.5 2.5 0 0 0 10 8v11.5h6.5A2.5 2.5 0 0 1 19 22V5.5Z" />
        </svg>
      );
    case 'hubArtifacts':
      return (
        <svg {...props}>
          <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z" />
          <path d="M12 12.5 20 8.5M12 12.5v7.5M12 12.5 4 8.5" />
        </svg>
      );
    default:
      return null;
  }
}
