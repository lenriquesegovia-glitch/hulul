import type { LatLng } from './models';

/**
 * Búsqueda de lugares mientras se escribe (Photon, datos de OpenStreetMap,
 * gratis y sin clave), con prioridad en Guayaquil, Samborondón y Daule.
 */
export interface PlaceSuggestion { label: string; detail: string; p: LatLng }

/** Búsquedas ya hechas: al borrar o repetir una letra, la respuesta es inmediata. */
const cache = new Map<string, PlaceSuggestion[]>();
/** Si el servicio tarda más que esto, se deja de esperar (el cliente igual puede escribir a mano). */
const SEARCH_TIMEOUT_MS = 6000;

export async function searchPlaces(q: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const key = q.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const ctrl = new AbortController();
  const stop = () => ctrl.abort();
  signal?.addEventListener('abort', stop);
  const timer = setTimeout(stop, SEARCH_TIMEOUT_MS);
  try {
    const out = await fetchPlaces(q, ctrl.signal);
    if (cache.size > 200) cache.clear();
    cache.set(key, out);
    return out;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}

async function fetchPlaces(q: string, signal: AbortSignal): Promise<PlaceSuggestion[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lat=-2.15&lon=-79.89&bbox=-81.1,-5.1,-75.1,1.5`;
  const r = await fetch(url, { signal });
  if (!r.ok) return [];
  const j = await r.json();
  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];
  for (const f of j.features ?? []) {
    const pr = f.properties ?? {};
    if (pr.countrycode && pr.countrycode !== 'EC') continue;
    const label = [pr.name, pr.street && pr.street !== pr.name ? pr.street : '', pr.housenumber].filter(Boolean).join(' ');
    const detail = [pr.district ?? pr.locality, pr.city ?? pr.county, pr.state].filter(Boolean).join(', ');
    if (!label || seen.has(label + detail)) continue;
    seen.add(label + detail);
    const [lng, lat] = f.geometry?.coordinates ?? [];
    if (typeof lat === 'number' && typeof lng === 'number') out.push({ label, detail, p: { lat, lng } });
  }
  return out;
}

/** Centro de Guayaquil, para abrir el mapa sin ubicación. */
export const GUAYAQUIL: LatLng = { lat: -2.1709, lng: -79.9224 };
