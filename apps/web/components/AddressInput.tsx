'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { LatLng } from '@hulul/shared';
import { Icon } from '@/components/Icon';

/**
 * Dirección con sugerencias mientras se escribe (urbanizaciones, calles,
 * edificios). Al elegir una, también marca el punto en el mapa.
 * Usa Photon (datos de OpenStreetMap, gratis y sin clave), con prioridad en
 * Guayaquil, Samborondón y Daule. El cliente igual puede escribir manzana y
 * villa a mano: muchas villas no están en ningún mapa.
 */

interface Suggestion { label: string; detail: string; p: LatLng }

const PHOTON = 'https://photon.komoot.io/api/';

async function search(q: string, signal: AbortSignal): Promise<Suggestion[]> {
  const url = `${PHOTON}?q=${encodeURIComponent(q)}&limit=6&lat=-2.15&lon=-79.89&bbox=-81.1,-5.1,-75.1,1.5`;
  const r = await fetch(url, { signal });
  if (!r.ok) return [];
  const j = await r.json();
  const seen = new Set<string>();
  const out: Suggestion[] = [];
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

export function AddressInput({ onPlace }: { onPlace: (p: LatLng, label: string) => void }) {
  const listId = useId();
  const [value, setValue] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const picked = useRef('');

  useEffect(() => {
    const q = value.trim();
    if (q.length < 3 || q === picked.current) { setItems([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      search(q, ctrl.signal).then((r) => { setItems(r); setActive(-1); }).catch(() => {});
    }, 350);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value]);

  const choose = (s: Suggestion) => {
    const text = [s.label, s.detail.split(',')[0]].filter(Boolean).join(', ');
    picked.current = text;
    setValue(text + ', ');
    setOpen(false);
    onPlace(s.p, text);
  };

  const show = open && items.length > 0;

  return (
    <div className="field addr">
      <label htmlFor="direccion">Dirección y referencia</label>
      <div style={{ position: 'relative' }}>
      <input id="direccion" name="direccion" required minLength={8} maxLength={300} autoComplete="off"
        placeholder="Escribe tu urbanización o calle"
        role="combobox" aria-expanded={show} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        value={value}
        onChange={(e) => { setValue(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
          else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(items[active]); }
          else if (e.key === 'Escape') setOpen(false);
        }} />
      {show && (
        <ul id={listId} role="listbox" className="ac-panel addr-panel" aria-label="Lugares sugeridos">
          {items.map((s, i) => (
            <li key={s.label + s.detail} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button type="button" className={`ac-item ${i === active ? 'on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(s)}>
                <span className="ac-icon"><Icon name="pin" size={18} color="var(--copper)" /></span>
                <span className="stack" style={{ minWidth: 0 }}>
                  <span className="ac-label">{s.label}</span>
                  {s.detail && <span className="ac-cat">{s.detail}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      </div>
      <span className="muted" style={{ fontSize: 13 }}>Elige tu urbanización o calle de la lista y completa con manzana y villa.</span>
    </div>
  );
}
