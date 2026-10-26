import type { IconName } from './categories';

/**
 * Íconos de línea (viewBox 0 0 24 24, trazo 1.8) compartidos entre web y app.
 * Cada ícono es una lista de formas simples para dibujarlas con <svg> en la web
 * y con react-native-svg en el celular.
 */
export type IconShape =
  | { kind: 'path'; d: string }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx: number };

export type UiIconName =
  | IconName
  | 'pin' | 'search' | 'chevronRight' | 'chevronLeft' | 'check' | 'shield'
  | 'broom' | 'office' | 'iron' | 'window' | 'sofa' | 'rug' | 'brush' | 'tool' | 'bulb' | 'box'
  | 'card' | 'clock' | 'home' | 'calendar' | 'bell' | 'chat' | 'user' | 'logo';

export const icons: Record<UiIconName, IconShape[]> = {
  broom: [{kind:'path',d:'M15 3l-4 10M8 12l7 3-3 7-8-3 4-7zM7 17l-1 3m4-2-1 3'}],
  office: [{kind:'path',d:'M5 22V3h14v19M3 22h18M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1M10 22v-4h4v4'}],
  iron: [{kind:'path',d:'M3 18h18l-3-8H9c-3 0-5 3-6 8zM10 10V6h7l1 4M7 15h1m3 0h1'}],
  window: [{kind:'path',d:'M4 3h16v18H4zM12 3v18M4 12h16M7 6l2 2m6 7 2 2'}],
  sofa: [{kind:'path',d:'M5 12V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M5 18H3v-6h3v3h12v-3h3v6H5zM5 18v3m14-3v3'}],
  rug: [{kind:'path',d:'M5 5h14v14H5zM8 8h8v8H8zM7 2v3m5-3v3m5-3v3M7 19v3m5-3v3m5-3v3'}],
  brush: [{kind:'path',d:'M9 3h6v10l5 3v5H4v-5l5-3V3zM4 16h16M8 17v4m4-4v4m4-4v4'}],
  tool: [{kind:'path',d:'M14 3a6 6 0 0 0-7 8L3 17a2.8 2.8 0 0 0 4 4l6-6a6 6 0 0 0 8-7l-4 4-4-1-1-4 2-4z'}],
  bulb: [{kind:'path',d:'M8 16c0-3-3-4-3-7a7 7 0 0 1 14 0c0 3-3 4-3 7M8 17h8M9 20h6M10 23h4'}],
  box: [{kind:'path',d:'M3 7l9-4 9 4v11l-9 4-9-4V7zM3 7l9 4 9-4M12 11v11M7 5l9 4'}],
  snow: [{ kind: 'path', d: 'M12 2v20M4.2 6.5l15.6 11M4.2 17.5l15.6-11M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5' }],
  drop: [{ kind: 'path', d: 'M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z' }],
  bolt: [{ kind: 'path', d: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z' }],
  washer: [
    { kind: 'rect', x: 4, y: 3, width: 16, height: 18, rx: 2 },
    { kind: 'circle', cx: 12, cy: 13, r: 4 },
    { kind: 'path', d: 'M7 6.5h2' },
  ],
  sparkle: [
    { kind: 'path', d: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z' },
    { kind: 'path', d: 'M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z' },
  ],
  scissors: [
    { kind: 'circle', cx: 6, cy: 6, r: 3 },
    { kind: 'circle', cx: 6, cy: 18, r: 3 },
    { kind: 'path', d: 'M8.5 7.5L20 18M8.5 16.5L20 6' },
  ],
  paw: [
    { kind: 'circle', cx: 5.5, cy: 10, r: 2 },
    { kind: 'circle', cx: 9.5, cy: 5.5, r: 2 },
    { kind: 'circle', cx: 14.5, cy: 5.5, r: 2 },
    { kind: 'circle', cx: 18.5, cy: 10, r: 2 },
    { kind: 'path', d: 'M12 12c-3 0-6 4-6 6.5 0 1.5 1.5 2.5 3 2 1.2-.4 2-.8 3-.8s1.8.4 3 .8c1.5.5 3-.5 3-2C18 16 15 12 12 12z' },
  ],
  book: [
    { kind: 'path', d: 'M3 5.5C5.5 4 9 4 12 6c3-2 6.5-2 9-.5V19c-2.5-1.5-6-1.5-9 .5-3-2-6.5-2-9-.5V5.5z' },
    { kind: 'path', d: 'M12 6v13.5' },
  ],
  leaf: [
    { kind: 'path', d: 'M5 19c0-8.5 6-14 15-14 0 9-6 14.5-14 14.5H5z' },
    { kind: 'path', d: 'M5 19.5l8-8' },
  ],
  waves: [
    { kind: 'path', d: 'M2 8c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0' },
    { kind: 'path', d: 'M2 13c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0' },
    { kind: 'path', d: 'M2 18c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0' },
  ],
  roller: [
    { kind: 'rect', x: 3, y: 3, width: 15, height: 6, rx: 1.5 },
    { kind: 'path', d: 'M18 6h2.5v5H11v3' },
    { kind: 'rect', x: 9.5, y: 14, width: 3, height: 7, rx: 1 },
  ],
  heart: [
    { kind: 'path', d: 'M12 20s-8-4.8-8-10.5A4.5 4.5 0 0 1 12 6.8a4.5 4.5 0 0 1 8 2.7C20 15.2 12 20 12 20z' },
    { kind: 'path', d: 'M7 12h3l1.5-2.5 2 4.5 1.5-2H17' },
  ],
  key: [
    { kind: 'circle', cx: 8, cy: 15, r: 4.5 },
    { kind: 'path', d: 'M11.2 11.8L20 3M16.5 6.5l2.5 2.5M14 9l2 2' },
  ],
  saw: [
    { kind: 'path', d: 'M3 17l11-11 4 4-11 11H3v-4z' },
    { kind: 'path', d: 'M14 6l2-2 4 4-2 2M6 14l1.5 1.5M8.5 11.5L10 13M11 9l1.5 1.5' },
  ],
  brick: [
    { kind: 'rect', x: 3, y: 5, width: 18, height: 14, rx: 1.5 },
    { kind: 'path', d: 'M3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19' },
  ],
  bug: [
    { kind: 'path', d: 'M12 7.5a4 4 0 0 1 4 4V15a4 4 0 0 1-8 0v-3.5a4 4 0 0 1 4-4z' },
    { kind: 'path', d: 'M9.5 5.5L11 7.5M14.5 5.5L13 7.5M8 12H4.5M8 16l-3 2M16 12h3.5M16 16l3 2M8.5 9.5L5.5 8M15.5 9.5l3-1.5M12 11v7' },
  ],
  truck: [
    { kind: 'path', d: 'M2 6h11v10H2zM13 9h4.5l3.5 3.5V16h-8z' },
    { kind: 'circle', cx: 6.5, cy: 17.5, r: 1.8 },
    { kind: 'circle', cx: 17, cy: 17.5, r: 1.8 },
  ],
  compass: [
    { kind: 'circle', cx: 12, cy: 5, r: 2 },
    { kind: 'path', d: 'M11 6.8L6 21M13 6.8L18 21M7.8 16h8.4M12 3V2' },
  ],
  monitor: [
    { kind: 'rect', x: 3, y: 4, width: 18, height: 12, rx: 1.5 },
    { kind: 'path', d: 'M9 20h6M12 16v4' },
  ],
  pin: [
    { kind: 'path', d: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z' },
    { kind: 'circle', cx: 12, cy: 9.5, r: 2.5 },
  ],
  search: [
    { kind: 'circle', cx: 11, cy: 11, r: 7 },
    { kind: 'path', d: 'M20 20l-3.5-3.5' },
  ],
  chevronRight: [{ kind: 'path', d: 'M9 6l6 6-6 6' }],
  chevronLeft: [{ kind: 'path', d: 'M15 6l-6 6 6 6' }],
  check: [{ kind: 'path', d: 'M5 12l4 4 10-10' }],
  shield: [
    { kind: 'path', d: 'M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z' },
    { kind: 'path', d: 'M9 12l2 2 4-4' },
  ],
  card: [
    { kind: 'rect', x: 3, y: 6, width: 18, height: 13, rx: 2 },
    { kind: 'path', d: 'M3 10h18' },
  ],
  clock: [
    { kind: 'circle', cx: 12, cy: 12, r: 9 },
    { kind: 'path', d: 'M12 7v5l3 2' },
  ],
  home: [{ kind: 'path', d: 'M4 11l8-7 8 7v9H4v-9z' }],
  calendar: [
    { kind: 'rect', x: 4, y: 5, width: 16, height: 15, rx: 2 },
    { kind: 'path', d: 'M4 10h16M9 3v4M15 3v4' },
  ],
  bell: [{ kind: 'path', d: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4' }],
  chat: [{ kind: 'path', d: 'M4 5h16v11H9l-5 4V5z' }],
  user: [
    { kind: 'circle', cx: 12, cy: 8, r: 4 },
    { kind: 'path', d: 'M4 21c1-4 4.5-6 8-6s7 2 8 6' },
  ],
  logo: [
    { kind: 'path', d: 'M3 11l9-8 9 8' },
    { kind: 'path', d: 'M5.5 9v11h13V9' },
    { kind: 'path', d: 'M9 16c0-3 2-3 3-1.5S15 18 15 15s-2-3-3-1.5S9 19 9 16z' },
  ],
};
