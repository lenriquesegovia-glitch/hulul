'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { inboxItems, type InboxExtras, type InboxItem, type InboxLevel } from '@hulul/shared/dashboard';
import { MUESTRA, useAdmin } from './AdminShell';

/**
 * Bandeja de novedades del resumen ejecutivo: todo lo que hay que revisar hoy en un solo lugar
 * (reclamos, pagos, aprobaciones, SRI, nómina, plataformas…), según el rol. «Visto» se guarda en
 * este navegador y la novedad vuelve a aparecer si cambia (otro reclamo, otro monto…).
 */
const KEY = 'hulul-novedades-vistas';
const OPEN_KEY = 'hulul-novedades-abierta';
const LEVEL: Record<InboxLevel, { color: string; label: string }> = {
  alta: { color: 'var(--bad)', label: 'Urgente' },
  media: { color: 'var(--warn)', label: 'Revisar' },
  info: { color: 'var(--info)', label: 'Para saber' },
};

function readSeen(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, string>; } catch { return {}; }
}

export function Novedades({ onOpen }: { onOpen: (title: string, ids: string[]) => void }) {
  const { view, now, can } = useAdmin();
  const [extra, setExtra] = useState<InboxExtras>({});
  const [seen, setSeen] = useState<Record<string, string>>({});
  const [showSeen, setShowSeen] = useState(false);
  const [all, setAll] = useState(false);
  // Abierta u oculta: se recuerda en este navegador.
  const [openBox, setOpenBox] = useState(true);
  useEffect(() => { try { setOpenBox(localStorage.getItem(OPEN_KEY) !== '0'); } catch { /* sin almacenamiento */ } }, []);
  const toggle = () => setOpenBox((v) => { try { localStorage.setItem(OPEN_KEY, v ? '0' : '1'); } catch { /* sin almacenamiento */ } return !v; });
  const canGastos = can('contabilidad');
  const canPagos = can('pagos');

  useEffect(() => { setSeen(readSeen()); }, []);
  useEffect(() => {
    let off = false;
    (async () => {
      const next: InboxExtras = {};
      try {
        if (canGastos) {
          const g = MUESTRA ? await (await fetch('/muestra-gastos.json')).json() : await (await import('@hulul/shared/firebase')).adminExpenses();
          next.gastos = { gastos: g.gastos, roles: g.roles, pagosTarjeta: g.pagosTarjeta ?? [], empleados: g.empleados ?? [], laboral: g.laboral ?? {} };
        }
      } catch { /* sin gastos: la bandeja sigue con lo demás */ }
      try {
        if (canPagos) {
          const b = MUESTRA ? { week: '2026-10-26', status: 'borrador', items: [1, 2, 3, 4, 5, 6] } : await (await import('@hulul/shared/firebase')).adminStatementPeek();
          next.statements = { week: b.week, status: b.status, count: b.items.length };
        }
      } catch { /* sin lote */ }
      if (!off) setExtra(next);
    })();
    return () => { off = true; };
  }, [canGastos, canPagos]);

  const items = useMemo(() => (view ? inboxItems(view, can, now, extra) : []), [view, can, now, extra]);
  const fresh = items.filter((i) => seen[i.id] !== i.sig);
  const old = items.filter((i) => seen[i.id] === i.sig);
  const mark = (i: InboxItem, v: boolean) => {
    const s = { ...seen };
    if (v) s[i.id] = i.sig; else delete s[i.id];
    setSeen(s);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ }
  };
  const full = showSeen ? [...fresh, ...old] : fresh;
  const list = all ? full : full.slice(0, 6);
  const urgent = fresh.filter((i) => i.level === 'alta').length;

  return (
    <section className="adm-card adm-inbox" aria-labelledby="novedades-t">
      <div className="adm-bar" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="adm-inbox-head" aria-expanded={openBox} aria-controls="novedades-lista" onClick={toggle}>
          <span className="adm-inbox-caret" aria-hidden="true">{openBox ? '▾' : '▸'}</span>
          <span>
            <span id="novedades-t" className="adm-inbox-title">Novedades por revisar {fresh.length > 0 && <span className="adm-count" style={{ marginLeft: 6 }}>{fresh.length}</span>}{!openBox && urgent > 0 && <span className="adm-badge t-bad" style={{ marginLeft: 6 }}>{urgent} urgentes</span>}</span>
            <span className="sub" style={{ margin: 0, display: 'block' }}>{!openBox ? 'Oculta · toca para verlas' : fresh.length ? `${urgent ? `${urgent} urgentes · ` : ''}Lo pendiente de todo el panel, sin tener que recorrerlo.` : 'Todo al día: no hay nada nuevo por revisar.'}</span>
          </span>
        </button>
        {openBox && old.length > 0 && <button type="button" className="adm-chip" aria-pressed={showSeen} onClick={() => setShowSeen((v) => !v)}>{showSeen ? 'Ocultar las vistas' : `Ver también las vistas (${old.length})`}</button>}
      </div>
      {openBox && list.length > 0 && (
        <ul className="adm-inbox-list" id="novedades-lista">
          {list.map((i) => {
            const done = seen[i.id] === i.sig;
            const go = i.href
              ? <Link className="adm-btn" href={i.href}>Abrir →</Link>
              : i.ids?.length ? <button type="button" className="adm-btn" onClick={() => onOpen(i.title, i.ids!)}>Ver reservas →</button> : null;
            return (
              <li key={i.id} style={{ opacity: done ? 0.55 : 1 }}>
                <i style={{ background: LEVEL[i.level].color }} title={LEVEL[i.level].label} />
                <div>
                  <b><span className="adm-inbox-area">{i.area}</span> {i.title}</b>
                  {i.detail && <small>{i.detail}</small>}
                </div>
                <span className="adm-bar" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  {go}
                  <button type="button" className="adm-btn" onClick={() => mark(i, !done)} title={done ? 'Volver a mostrar' : 'Ya lo revisé'}>{done ? 'Deshacer' : 'Visto ✓'}</button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {openBox && full.length > 6 && <button type="button" className="adm-kpi-link" style={{ marginTop: 8 }} onClick={() => setAll((v) => !v)}>{all ? 'Mostrar menos' : `Ver las otras ${full.length - 6} →`}</button>}
    </section>
  );
}
