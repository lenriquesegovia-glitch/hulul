'use client';

import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { POPULAR_SEARCHES, suggestServices, type ServiceSuggestion } from '@hulul/shared';
import { Icon } from '@/components/Icon';

/**
 * Buscador del inicio con sugerencias mientras se escribe.
 * Al tocar una sugerencia va directo a la categoría; con "Buscar" va a la
 * página de resultados. Funciona también sin JavaScript (formulario normal).
 */
export function SearchBox() {
  const router = useRouter();
  const listId = useId();
  const box = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const typed = q.trim().length > 0;
  const items = useMemo(() => (typed ? suggestServices(q) : POPULAR_SEARCHES), [q, typed]);
  const show = open && (items.length > 0 || typed);

  const go = (s: ServiceSuggestion) => {
    setOpen(false);
    router.push(`/servicios/${s.slug}`);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
    else if (e.key === 'Enter' && show && active >= 0 && items[active]) { e.preventDefault(); go(items[active]); }
  };

  return (
    <form action="/buscar" className="search search-ac" role="search" ref={box}
      onBlur={(e) => { if (!box.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <Icon name="search" size={20} color="#6B6560" />
      <label htmlFor="q" className="sr-only">Buscar servicio</label>
      <input id="q" name="q" type="search" autoComplete="off" enterKeyHint="search"
        placeholder="Aire acondicionado, limpieza, uñas…"
        role="combobox" aria-expanded={show} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey} />
      <button type="submit" className="btn btn-primary">Buscar</button>

      {show && (
        <div className="ac-panel">
          {!typed && <p className="ac-head">Lo más pedido</p>}
          {items.length > 0 ? (
            <ul id={listId} role="listbox" aria-label="Sugerencias">
              {items.map((s, i) => (
                <li key={s.label} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                  <button type="button" className={`ac-item ${i === active ? 'on' : ''}`}
                    onMouseDown={(e) => e.preventDefault()} onClick={() => go(s)}>
                    <span className="ac-icon"><Icon name={s.icon} size={18} color="var(--copper)" /></span>
                    <span className="stack" style={{ minWidth: 0 }}>
                      <span className="ac-label">{s.label}</span>
                      {s.label !== s.category && <span className="ac-cat">{s.category}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ac-empty" id={listId}>No encontramos “{q.trim()}”. Toca Buscar para ver todas las categorías.</p>
          )}
        </div>
      )}
    </form>
  );
}
