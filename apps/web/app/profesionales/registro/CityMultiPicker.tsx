'use client';

import { useMemo, useState } from 'react';
import { searchServiceCities, serviceCity } from '@hulul/shared';

/**
 * Ciudades donde trabaja el profesional: los 222 cantones del Ecuador (la
 * misma lista que usa el cliente para elegir su ciudad), con buscador y sin
 * límite de selección.
 */
export function CityMultiPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => searchServiceCities(q), [q]);
  const toggle = (slug: string) => onChange(value.includes(slug) ? value.filter((x) => x !== slug) : [...value, slug]);

  return (
    <div className="stack gap-12">
      {value.length > 0 && (
        <div className="tag-row" aria-label="Ciudades elegidas">
          {value.map((slug) => (
            <button key={slug} type="button" className="tag on" onClick={() => toggle(slug)} aria-label={`Quitar ${serviceCity(slug)?.name ?? slug}`}>
              {serviceCity(slug)?.name ?? slug} ✕
            </button>
          ))}
        </div>
      )}
      <input className="own-job" style={{ borderStyle: 'solid' }} value={q} maxLength={40}
        placeholder="Busca tu ciudad o cantón (ej.: Quito, Cuenca, Ambato)"
        aria-label="Buscar ciudad o cantón" onChange={(e) => setQ(e.target.value)} />
      <div className="city-results city-results-inline" role="list">
        {results.map((c) => {
          const on = value.includes(c.slug);
          return (
            <button key={c.slug} type="button" role="listitem" className="city-option" aria-pressed={on} onClick={() => toggle(c.slug)}>
              <strong>{on ? '✓ ' : ''}{c.name}</strong>
              <small>{c.province}</small>
            </button>
          );
        })}
        {!results.length && <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>No encontramos esa ciudad. Prueba con el nombre del cantón.</p>}
      </div>
      <span className="muted" style={{ fontSize: 12.5 }}>Puedes elegir todas las ciudades donde trabajas. Solo te llegarán reservas de esas ciudades.</span>
    </div>
  );
}
