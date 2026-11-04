/* Icônes au trait (mêmes tracés que le CRM) et logo « A à serrure » (site/favicon.svg). */
export const PATHS: Record<string, string> = {
  carnet: 'M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12M9 8h6M9 11h4',
  finances: 'M4 20V10M10 20V4M16 20v-7M21 20H3',
  salon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  demandes: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z',
  planning: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  clients: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a7 7 0 0 1 14 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-4-4.9',
  flotte: 'M3 16v-3l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v3M3 16h18v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM7 12.5h.01M17 12.5h.01',
  contrats: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h4',
  services: 'M4 18h16M6 18a6 6 0 0 1 12 0M12 9V7M10 7h4',
  aide: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.2h.01',
  relances: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4.5h4.5M12 8v4.5l3 2',
  plus: 'M12 5v14M5 12h14', close: 'M6 6l12 12M18 6L6 18', spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6', copy: 'M9 9h11v11H9zM5 15H4V4h11v1', down: 'M12 4v11M7 10l5 5 5-5M5 20h14', up: 'M12 15V4M7 9l5-5 5 5M5 20h14',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a8 8 0 0 1 16 0v1',
  bag: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2', key: 'M14.5 4a5.5 5.5 0 1 1-5.2 7.3L3 17.6V21h3.4v-2h2v-2h2l1.3-1.3A5.5 5.5 0 0 1 14.5 4zM16 8h.01',
  plane: 'M10.5 13.5L3 11l1.5-1.5 8 1L17 6a2 2 0 0 1 3 3l-4.5 4.5 1 8L15 23l-2.5-7.5', star: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z',
  cam: 'M4 7h4l2-2h4l2 2h4v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', van: 'M2 16V7a1 1 0 0 1 1-1h12l5 5v5M2 16h20v2H2zM6 18a2 2 0 1 0 4 0M15 18a2 2 0 1 0 4 0M15 6v5h5',
  pin: 'M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  messages: 'M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1.4-4.6A8.5 8.5 0 1 1 21 11.5zM8.5 11.5h.01M12.5 11.5h.01M16.5 11.5h.01',
  reglages: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  phone: 'M6.6 3.5h2.6l1.5 4.2-2 1.4a12 12 0 0 0 6.2 6.2l1.4-2 4.2 1.5v2.6a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 4.6 5.6a2 2 0 0 1 2-2.1z',
  wa: 'M20.5 11.6a8.4 8.4 0 0 1-12.4 7.4L3.5 20.4l1.5-4.4a8.4 8.4 0 1 1 15.5-4.4zM9 8.6c0 3.6 2.8 6.4 6.4 6.4l1.1-1.6-2-1-1 .9a5 5 0 0 1-2.8-2.8l.9-1-1-2z',
  sms: 'M4 5h16v11H9l-5 4zM8 9.5h8M8 12.5h5', mail: 'M3.5 6h17v12h-17zM3.5 7l8.5 6 8.5-6',
  nav: 'M3.5 11.2L20.5 3.5l-7.7 17-1.9-7.4z', more: 'M5 12h.01M12 12h.01M19 12h.01',
  logout: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10', send: 'M4 12.5L20.5 4 16 20.5l-4.2-6.3zM11.8 14.2L20.5 4',
  check: 'M5 12.5l4.5 4.5L19 7.5', del: 'M9 5.5h11v13H9l-6-6.5zM12.5 9.5l5 5M17.5 9.5l-5 5', hist: 'M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4h4M12 8v4.5l3 2',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5', link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  clip: 'M21 11.5l-8.5 8.5a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10.5 17.4a1.6 1.6 0 0 1-2.3-2.3L16 7.3',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5', note: 'M4 4h16v12H9l-5 4zM8 8h8M8 11h6',
  play: 'M7 5l12 7-12 7z', globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18',
  euro: 'M18 6a7 7 0 0 0-11 5h-3M18 18a7 7 0 0 1-11-5h-3M4 11h10M4 13h10', sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z', translate: 'M4 5h8M8 3v2M11 5c-1 4-3 7-6 9M6 8c1 3 3 5 6 7M13 20l4-9 4 9M14.5 17h5',
  image: 'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4M16 9h.01', car: 'M3 16v-3l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v3M3 16h18v2H3zM7 12.5h.01M17 12.5h.01',
};
export function Icon({ k, w = 1.6, size, className, style }: { k: string; w?: number; size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={size ? { width: size, height: size, ...style } : style}>
      <path d={PATHS[k] || PATHS.spark} />
    </svg>
  );
}
export const LOGO_PATH = 'M452 -6 L560 -6 L831.93 912 Q856.67 982 930.67 982 L930.67 1000 L653.17 1000 L653.17 982 Q715.17 982 698.38 912 Z M452 -6 L486 40 L217.73 922 Q201.48 982 261.48 982 L261.48 1000 L97.19 1000 L97.19 982 Q165.19 982 184.49 922 Z M301.5 632.5 L627.38 632.5 L627.38 647.5 L301.5 647.5 Z M406.44 636 A58 58 0 1 1 522.44 636 A58 58 0 1 1 406.44 636 Z M442.44 676 L486.44 676 L510.44 832 Q512.44 842 502.44 842 L426.44 842 Q416.44 842 418.44 832 Z';
/** Le A à serrure, seul (favicon) ou sous arche (rail). */
export function Logo({ arch, size = 40, className }: { arch?: boolean; size?: number; className?: string }) {
  if (arch) return (
    <svg viewBox="-70 -10 1140 1310" aria-hidden="true" className={className} style={{ width: size, height: 'auto', display: 'block' }}>
      <g fill="currentColor" stroke="currentColor"><path d="M11 1260 V500 A489 489 0 0 1 989 500 V1260" fill="none" strokeWidth="30" /><path d="M500 51 l26 34 l-26 34 l-26 -34 Z" stroke="none" /><rect x="-60" y="1256" width="1120" height="18" stroke="none" /><path stroke="none" transform="translate(119.64 492) scale(0.74)" d={LOGO_PATH} /></g>
    </svg>
  );
  return <svg viewBox="40 -60 940 1120" aria-hidden="true" className={className} style={{ width: size, height: 'auto', display: 'block' }}><path fill="currentColor" d={LOGO_PATH} /></svg>;
}
export const CarSil = ({ van }: { van?: boolean }) => van
  ? <svg viewBox="0 0 300 90" aria-hidden="true"><path d="M14 72V30c0-10 8-18 18-18h170c9 0 17 4 22 11l26 31 30 6c7 2 12 8 12 15v4c0 4-3 7-7 7h-16M14 72v2c0 4 3 7 7 7h22M90 81h124" fill="none" stroke="currentColor" strokeWidth="2.2" /><circle cx="66" cy="78" r="15" fill="none" stroke="currentColor" strokeWidth="2.2" /><circle cx="238" cy="78" r="15" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M200 20l24 30H200zM40 22h50v26H40zM104 22h50v26h-50z" fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".7" /></svg>
  : <svg viewBox="0 0 300 90" aria-hidden="true"><path d="M8 66c0-8 6-12 14-14l40-8 34-22c8-5 18-8 28-8h56c12 0 22 4 31 11l26 20 40 6c9 1 15 7 15 15v6c0 4-3 7-7 7h-20" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M8 66v5c0 4 3 7 7 7h22M86 78h126" fill="none" stroke="currentColor" strokeWidth="2.2" /><circle cx="62" cy="76" r="16" fill="none" stroke="currentColor" strokeWidth="2.2" /><circle cx="236" cy="76" r="16" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M104 44l26-18c5-3 11-5 17-5h34c8 0 15 3 21 8l18 15z" fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".7" /></svg>;
export const SVC_ICON: Record<string, string> = { location: 'flotte', chauffeur: 'key', van: 'van', shopping: 'bag', sejour: 'star', transfert: 'plane', conciergerie: 'services', clip: 'cam' };
