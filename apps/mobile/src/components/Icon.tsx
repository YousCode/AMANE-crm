import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

/* Icônes trait 1.6 px sur grille 24, comme le CRM. */
const P: Record<string, string> = {
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  wa: 'M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3zM9 8.5c.3-.6.6-.6 1-.6h.6c.2 0 .4 0 .6.5l.7 1.7c.1.2 0 .4-.1.6l-.5.6c-.1.2-.2.3 0 .5a7 7 0 0 0 3.2 2.9c.2.1.4.1.5-.1l.7-.9c.2-.2.3-.2.6-.1l1.7.8c.3.1.4.2.4.4a2 2 0 0 1-1.4 2c-.6.2-1.3.3-3.3-.5-2.6-1.1-4.2-3.7-4.4-3.9-.1-.2-1-1.3-1-2.5 0-1.2.6-1.8.8-2z',
  nav: 'M3 11l18-8-8 18-2-8z',
  right: 'M9 6l6 6-6 6',
  left: 'M15 6l-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a8 8 0 0 1 16 0v1',
  demandes: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z',
  planning: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  clients: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a7 7 0 0 1 14 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-4-4.9',
  salon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  messages: 'M4 5h16v11H9l-5 4z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z',
  send: 'M4 12l16-8-6 16-3-7z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  image: 'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4M16 9h.01',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM6 11a6 6 0 0 0 12 0M12 17v4',
  play: 'M8 5l11 7-11 7z',
  pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
  pin: 'M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  check: 'M5 12l5 5 9-10',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM20 20l-4.5-4.5',
  alert: 'M12 3l10 18H2zM12 10v4M12 17.5v.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  car: 'M5 11l2-5h10l2 5M4 11h16v6h-2a2 2 0 0 1-4 0h-4a2 2 0 0 1-4 0H4zM7 14h.01M17 14h.01',
  book: 'M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12M9 8h6M9 11h4',
  euro: 'M18 6a7 7 0 1 0 0 12M4 10h10M4 14h10',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1.2-1.4-2.4-2.3.6-1.2-1.2.6-2.3L14.2 4 13 6h-2L9.8 4 7.3 5.5l.6 2.3-1.2 1.2-2.3-.6L3 10.8 5 12l-2 1.2 1.4 2.4 2.3-.6 1.2 1.2-.6 2.3 2.5 1.5L11 18h2l1.2 2 2.5-1.5-.6-2.3 1.2-1.2 2.3.6 1.4-2.4z',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7M12 17h.01',
  logout: 'M10 4H5v16h5M14 8l4 4-4 4M8 12h10',
  note: 'M4 4h16v12H9l-5 4zM8 8h8M8 11h5',
  chevron: 'M6 9l6 6 6-6',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  back: 'M9 4l-5 8 5 8M4 12h17',
  backspace: 'M3 12l5-7h13v14H8zM12 9l6 6M18 9l-6 6',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  moon: 'M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z',
  key: 'M14 10a4 4 0 1 0-4 4h1l1-1 1 1h2l1-1 2 2 2-2-6-6zM10 10h.01',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z',
  bag: 'M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2',
  swap: 'M4 8h13l-3-3M20 16H7l3 3',
  video: 'M4 7h12v10H4zM16 10l4-2v8l-4-2',
  sticker: 'M4 4h16v10l-6 6H4zM14 20v-6h6',
  contact: 'M4 5h16v14H4zM9 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM5 18a4 4 0 0 1 8 0M15 9h3M15 12h3',
  wifi: 'M3 9a14 14 0 0 1 18 0M6 12.5a9 9 0 0 1 12 0M9 16a4.5 4.5 0 0 1 6 0M12 19h.01',
  wifiOff: 'M3 9a14 14 0 0 1 18 0M6 12.5a9 9 0 0 1 12 0M9 16a4.5 4.5 0 0 1 6 0M12 19h.01M3 3l18 18',
  trash: 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v6M14 11v6',
  share: 'M12 3v12M8 7l4-4 4 4M5 13v7h14v-7',
  flag: 'M5 21V4h12l-2 4 2 4H5',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  translate: 'M4 5h10M9 3v2c0 5-3 9-6 10M6 5c0 4 3 8 7 10M13 21l4-10 4 10M14.5 17h5',
};

export type IconName = keyof typeof P;
export function Icon({ name, size = 18, color = '#111', stroke = 1.6 }: { name: IconName | string; size?: number; color?: string; stroke?: number }) {
  const d = P[name] || P.more;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={d} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
export function Dot({ size = 7, color = '#111' }: { size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 10 10"><Circle cx={5} cy={5} r={5} fill={color} /></Svg>;
}
