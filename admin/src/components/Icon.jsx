const PATHS = {
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6 8.5-6" /></>,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
  video: <><rect x="3" y="6" width="12" height="12" rx="2" /><path d="m15 11 6-3.5v9L15 13" /></>,
  music: <><path d="M9 18V5l10-2v13" /><circle cx="6.5" cy="18" r="2.6" /><circle cx="16.5" cy="16" r="2.6" /></>,
  'message-square': <path d="M20 15.5a3 3 0 0 1-3 3H9l-4 3v-3H7a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z" />,
  dashboard: <><rect x="3.5" y="3.5" width="7" height="9" rx="1.6" /><rect x="13.5" y="3.5" width="7" height="5" rx="1.6" /><rect x="13.5" y="12" width="7" height="8.5" rx="1.6" /><rect x="3.5" y="16" width="7" height="4.5" rx="1.6" /></>,
  file: <><path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" /><path d="M13 3v6h6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  folder: <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17Z" />,
  tag: <><path d="M20.5 13.3 13 20.8a2 2 0 0 1-2.8 0L3.5 14a2 2 0 0 1-.6-1.5l.4-7A2 2 0 0 1 5.3 3.5l7-.4A2 2 0 0 1 13.8 3.7l6.7 6.7a2 2 0 0 1 0 2.9Z" /><circle cx="8.6" cy="8.6" r="1.3" /></>,
  message: <path d="M20 15.5a3 3 0 0 1-3 3H9l-4 3v-3H7a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z" />,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-5 4 4 3-2.5 4 3.5" /></>,
  settings: <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H2a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5M5 12h11" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  trash: <><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></>,
  edit: <><path d="M4 20h4l10-10-4-4L4 16z" /><path d="m14 6 4 4" /></>,
  eye: <><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="2.6" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  external: <><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  star: <path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8Z" />,
  pin: <path d="M12 21s6-5.5 6-10a6 6 0 1 0-12 0c0 4.5 6 10 6 10Z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  book: <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />,
  chart: <path d="M4 19V5M4 19h16M8 16V10M12 16V7M16 16v-4" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>,
  shield: <><path d="M12 3 4.5 6v6c0 4.5 4 7.5 7.5 9 3.5-1.5 7.5-4.5 7.5-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  hero: <><path d="M4 12h4l2 6 4-14 2 8h4" /></>,
  user: <><circle cx="12" cy="8.5" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v5h-5" /></>,
  menuBook: <><path d="M12 6.5C10.5 5 8.5 4.5 6 4.5H3v13h3c2.5 0 4.5.5 6 2" /><path d="M12 6.5c1.5-1.5 3.5-2 6-2h3v13h-3c-2.5 0-4.5.5-6 2" /></>,
};

export function Icon({ name, size = 18, className = '', strokeWidth = 1.7 }) {
  const p = PATHS[name];
  if (!p) return null;
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false">{p}</svg>
  );
}

export default Icon;
