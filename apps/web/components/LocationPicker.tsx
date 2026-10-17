'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { LatLng } from '@hulul/shared';
import { Icon } from '@/components/Icon';
import 'leaflet/dist/leaflet.css';

/**
 * Ubicación del servicio en el mapa.
 *
 * En el formulario se ve un botón ("Marcar en el mapa") o, si ya se marcó,
 * la ubicación elegida. El mapa se abre a pantalla completa con el pin fijo en
 * el centro: el cliente mueve el mapa, busca su sector o usa su ubicación
 * actual, y confirma. A pantalla completa para que el mapa no se pelee con el
 * desplazamiento de la página en el celular.
 *
 * Mapa: OpenStreetMap (gratis, sin clave). Búsqueda y nombre del sector:
 * Nominatim, también de OpenStreetMap, solo cuando el cliente lo pide.
 */

/** Centro de Guayaquil, para abrir el mapa si aún no hay ubicación. */
const GYE: LatLng = { lat: -2.1709, lng: -79.9224 };
const NOMINATIM = 'https://nominatim.openstreetmap.org';

type GeoError = '' | 'denegado' | 'no-disponible';

async function placeName(p: LatLng): Promise<string> {
  try {
    const r = await fetch(`${NOMINATIM}/reverse?format=jsonv2&zoom=17&accept-language=es&lat=${p.lat}&lon=${p.lng}`);
    if (!r.ok) return '';
    const j = await r.json();
    const a = j.address ?? {};
    const parts = [a.road, a.neighbourhood ?? a.suburb ?? a.quarter ?? a.residential, a.city ?? a.town ?? a.village ?? a.county]
      .filter(Boolean);
    return [...new Set(parts)].slice(0, 3).join(', ');
  } catch {
    return '';
  }
}

function currentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('no-disponible'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'denegado' : 'no-disponible')),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  });
}

interface Props {
  value: LatLng | null;
  onChange: (v: LatLng | null) => void;
}

export function LocationPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');

  const confirm = (p: LatLng) => {
    onChange(p);
    setOpen(false);
    setLabel('');
    placeName(p).then(setLabel);
  };

  return (
    <div className="field">
      <span className="field-label">Ubicación en el mapa</span>
      {value ? (
        <div className="loc-chosen">
          <span className="loc-icon"><Icon name="pin" size={20} color="var(--success)" strokeWidth={2.2} /></span>
          <div className="stack" style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ fontSize: 15 }}>Ubicación marcada</strong>
            <span className="muted loc-label">{label || 'Lista para el profesional'}</span>
          </div>
          <button type="button" className="link-btn" onClick={() => setOpen(true)}>Cambiar</button>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost loc-open" onClick={() => setOpen(true)}>
          <Icon name="pin" size={20} color="var(--primary)" strokeWidth={2.2} />
          Marcar en el mapa
        </button>
      )}
      {!value && <span className="muted" style={{ fontSize: 13 }}>Así el profesional llega directo, sin perderse.</span>}
      {open && createPortal(<MapSheet initial={value} onClose={() => setOpen(false)} onConfirm={confirm} />, document.body)}
    </div>
  );
}

function MapSheet({ initial, onClose, onConfirm }: { initial: LatLng | null; onClose: () => void; onConfirm: (p: LatLng) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<import('leaflet').Map | null>(null);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<GeoError>('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<{ name: string; p: LatLng }[] | null>(null);

  const goTo = (p: LatLng, zoom = 18) => map.current?.setView([p.lat, p.lng], zoom);

  const locate = useCallback(async () => {
    setLocating(true);
    setGeoError('');
    try {
      const p = await currentPosition();
      map.current?.setView([p.lat, p.lng], 18);
    } catch (e) {
      setGeoError((e as Error).message === 'denegado' ? 'denegado' : 'no-disponible');
    } finally {
      setLocating(false);
    }
  }, []);

  // Crea el mapa al abrir; Leaflet se carga solo aquí.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !box.current) return;
      const start = initial ?? GYE;
      const m = L.map(box.current, { zoomControl: false, attributionControl: false })
        .setView([start.lat, start.lng], initial ? 18 : 13);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      }).addTo(m);
      L.control.attribution({ prefix: false }).addTo(m);
      L.control.zoom({ position: 'bottomright' }).addTo(m);
      map.current = m;
      setReady(true);
      // Sin ubicación previa, se intenta la actual: para eso tocó el botón.
      if (!initial) locate();
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [initial, locate]);

  // Bloquea el desplazamiento de la página y cierra con Escape.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const search = async (e: FormEvent) => {
    // El buscador vive dentro del formulario de reserva (React propaga el
    // evento a través del portal): que no envíe la reserva.
    e.preventDefault();
    e.stopPropagation();
    const q = query.trim();
    if (q.length < 3 || searching) return;
    setSearching(true);
    try {
      // Prioriza Guayaquil, Samborondón y Daule, sin salir de Ecuador.
      const url = `${NOMINATIM}/search?format=jsonv2&limit=5&countrycodes=ec&accept-language=es` +
        `&viewbox=-80.15,-1.75,-79.65,-2.35&q=${encodeURIComponent(q)}`;
      const r = await fetch(url);
      const list: { display_name: string; lat: string; lon: string }[] = r.ok ? await r.json() : [];
      setResults(list.map((x) => ({
        name: x.display_name.split(', ').slice(0, 3).join(', '),
        p: { lat: Number(x.lat), lng: Number(x.lon) },
      })));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const center = (): LatLng | null => {
    const c = map.current?.getCenter();
    return c ? { lat: Number(c.lat.toFixed(6)), lng: Number(c.lng.toFixed(6)) } : null;
  };

  return (
    <div className="map-sheet" role="dialog" aria-modal="true" aria-label="Marcar la ubicación del servicio">
      <div className="map-top">
        <button type="button" className="map-round" aria-label="Cerrar" onClick={onClose}>
          <Icon name="chevronLeft" size={22} strokeWidth={2.2} />
        </button>
        <form className="map-search" onSubmit={search} role="search">
          <Icon name="search" size={18} color="var(--muted)" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setResults(null); }}
            placeholder="Busca tu urbanización o sector"
            enterKeyHint="search"
            aria-label="Buscar dirección"
          />
          {query && <button type="submit" className="link-btn" disabled={searching}>{searching ? '…' : 'Buscar'}</button>}
        </form>
      </div>
      {results && (
        <ul className="map-results">
          {results.length === 0 && <li className="muted">No encontramos ese lugar. Mueve el mapa hasta tu casa.</li>}
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" onClick={() => { goTo(r.p, 17); setResults(null); }}>{r.name}</button>
            </li>
          ))}
        </ul>
      )}

      <div className="map-area">
        <div className="map-box" ref={box} />
        {/* Pin fijo en el centro: se mueve el mapa, no el pin. */}
        <div className="map-pin" aria-hidden>
          <svg width="40" height="52" viewBox="0 0 40 52">
            <path d="M20 51s17-17.2 17-30A17 17 0 0 0 3 21c0 12.8 17 30 17 30z" fill="var(--primary)" stroke="#fff" strokeWidth="2.5" />
            <circle cx="20" cy="20" r="6.5" fill="#fff" />
          </svg>
        </div>
      </div>

      <div className="map-bottom">
        <button type="button" className="btn btn-ghost" onClick={locate} disabled={!ready || locating}>
          <Icon name="pin" size={18} color="var(--primary)" strokeWidth={2.2} />
          {locating ? 'Buscando tu ubicación…' : 'Usar mi ubicación actual'}
        </button>
        {geoError && (
          <p className="map-hint" role="alert">
            {geoError === 'denegado'
              ? 'No diste permiso de ubicación. Puedes activarlo en los ajustes del navegador, o mover el mapa hasta tu casa.'
              : 'No pudimos obtener tu ubicación. Mueve el mapa hasta tu casa o busca tu sector.'}
          </p>
        )}
        {!geoError && <p className="map-hint">Mueve el mapa hasta que el pin quede sobre tu casa.</p>}
        <button type="button" className="btn btn-primary" style={{ minHeight: 52 }} disabled={!ready}
          onClick={() => { const c = center(); if (c) onConfirm(c); }}>
          Confirmar ubicación
        </button>
      </div>
    </div>
  );
}
