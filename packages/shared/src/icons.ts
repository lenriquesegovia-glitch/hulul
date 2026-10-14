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
  | 'card' | 'clock' | 'home' | 'calendar' | 'chat' | 'user' | 'logo';

export const icons: Record<UiIconName, IconShape[]> = {
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
