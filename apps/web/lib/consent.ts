import { PRIVACY_VERSION, type CookieCategoryId } from '@hulul/shared';

/**
 * Elección de cookies del visitante, guardada en una cookie propia.
 * Se vuelve a preguntar después de 12 meses o si cambia PRIVACY_VERSION.
 */
export interface Consent {
  v: string;
  analitica: boolean;
  publicidad: boolean;
  at: string;
}

const COOKIE = 'hulul_consent';
const MAX_AGE = 60 * 60 * 24 * 365;
export const OPEN_EVENT = 'hulul:open-cookie-settings';
export const CHANGE_EVENT = 'hulul:consent-changed';

export function readConsent(): Consent | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie.split('; ').find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return null;
  try {
    const c = JSON.parse(decodeURIComponent(raw.slice(COOKIE.length + 1))) as Consent;
    return c.v === PRIVACY_VERSION ? c : null;
  } catch {
    return null;
  }
}

export function saveConsent(choice: { analitica: boolean; publicidad: boolean }) {
  const value: Consent = { v: PRIVACY_VERSION, ...choice, at: new Date().toISOString() };
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: value }));
}

/**
 * Úsalo antes de cargar cualquier script de analítica o publicidad:
 * `if (hasConsent('analitica')) { ...cargar Google Analytics... }`
 */
export function hasConsent(category: CookieCategoryId): boolean {
  if (category === 'necesarias') return true;
  const c = readConsent();
  return !!c && c[category];
}

/** true si el navegador envía la señal Global Privacy Control. */
export function globalPrivacyControl(): boolean {
  return typeof navigator !== 'undefined' && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}
