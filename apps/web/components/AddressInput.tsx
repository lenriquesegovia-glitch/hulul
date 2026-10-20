'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { searchPlaces, type LatLng, type PlaceSuggestion } from '@hulul/shared';
import { Icon } from '@/components/Icon';

/**
 * Dirección con sugerencias mientras se escribe (urbanizaciones, calles,
 * edificios). Al elegir una, también marca el punto en el mapa.
 * Usa Photon (datos de OpenStreetMap, gratis y sin clave), con prioridad en
 * Guayaquil, Samborondón y Daule. El cliente igual puede escribir manzana y
 * villa a mano: muchas villas no están en ningún mapa.
 */

type Suggestion = PlaceSuggestion;

export function AddressInput({ onPlace }: { onPlace: (p: LatLng, label: string) => void }) {
  const listId = useId();
  const [value, setValue] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [searching, setSearching] = useState(false);
  const picked = useRef('');

  useEffect(() => {
    const q = value.trim();
    // Recién elegida una sugerencia: no se vuelve a buscar.
    if (q.length < 3 || q === picked.current.trim() || q === `${picked.current},`) { setItems([]); setSearching(false); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setSearching(true);
      searchPlaces(q, ctrl.signal).then((r) => { setItems(r); setActive(-1); }).catch(() => {})
        .finally(() => { if (!ctrl.signal.aborted) setSearching(false); });
    }, 250);
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
      {searching && open && items.length === 0 && <span className="muted" style={{ fontSize: 13 }}>Buscando…</span>}
      <span className="muted" style={{ fontSize: 13 }}>Elige tu urbanización o calle de la lista y completa con manzana y villa.</span>
    </div>
  );
}
