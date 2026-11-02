'use client';

import { useMemo, useState } from 'react';
import { categoryEffectiveness, growthInsights, type DashBooking, type DateRange } from '@hulul/shared/dashboard';
import { catName, money, percent } from './ui';

/**
 * Efectividad por actividad: el porcentaje de éxito de cada categoría (no solo cuántas hubo),
 * sus problemas, la calificación y cuánto deja a HULUL por reserva; y las señales de dónde está la ganancia.
 */
type Sort = 'exito' | 'ganancia' | 'cantidad';

export function Efectividad({ bookings, range, open }: { bookings: DashBooking[]; range: DateRange; open: (title: string, ids: string[]) => void }) {
  const [sort, setSort] = useState<Sort>('exito');
  const cats = useMemo(() => categoryEffectiveness(bookings, range), [bookings, range]);
  const insights = useMemo(() => growthInsights(bookings, range, catName), [bookings, range]);
  const list = [...cats].sort((a, z) => (sort === 'exito' ? (z.closed ? z.successRate : -1) - (a.closed ? a.successRate : -1) : sort === 'ganancia' ? z.perBooking - a.perBooking : z.total - a.total));
  const tone = (r: number) => (r >= 0.85 ? '#206344' : r >= 0.7 ? '#C98A1B' : '#B42318');
  return (
    <>
      <section className="adm-card">
        <div className="adm-bar" style={{ justifyContent: 'space-between' }}>
          <div><h2 style={{ margin: 0 }}>Efectividad por actividad</h2><p className="sub" style={{ margin: 0 }}>De lo terminado en cada servicio: qué porcentaje salió bien, qué falló y cuánto deja a HULUL. Toca una fila para ver los casos.</p></div>
          <div className="adm-bar" role="group" aria-label="Ordenar">
            {([['exito', 'Por % de éxito'], ['ganancia', 'Por ganancia'], ['cantidad', 'Por cantidad']] as [Sort, string][]).map(([k, l]) => <button key={k} type="button" className="adm-chip" aria-pressed={sort === k} onClick={() => setSort(k)}>{l}</button>)}
          </div>
        </div>
        {!list.length ? <div className="adm-empty">Sin reservas en el periodo.</div> : (
          <div className="adm-table-wrap" style={{ marginTop: 12 }}>
            <table className="adm-table">
              <thead><tr><th>Actividad</th><th style={{ minWidth: 190 }}>Éxito (sobre lo terminado)</th><th>Problemas</th><th className="num">★</th><th className="num">HULUL por reserva</th><th className="num">Reservas</th></tr></thead>
              <tbody>{list.map((c) => (
                <tr key={c.category} className="click" onClick={() => open(`${catName(c.category)}: todas`, c.ids.all)}>
                  <td><b>{catName(c.category)}</b></td>
                  <td>
                    {c.closed ? (
                      <div className="row gap-8" style={{ alignItems: 'center' }}>
                        <div style={{ flex: 1, height: 10, background: '#EEF1F0', borderRadius: 6, overflow: 'hidden', minWidth: 90 }}><div style={{ width: `${c.successRate * 100}%`, height: '100%', background: tone(c.successRate) }} /></div>
                        <button type="button" className="adm-kpi-link" style={{ minWidth: 48, textAlign: 'right', color: tone(c.successRate) }} onClick={(e) => { e.stopPropagation(); open(`${catName(c.category)}: con éxito`, c.ids.success); }}>{percent(c.successRate)}</button>
                      </div>
                    ) : <span className="muted">Aún sin terminar</span>}
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    {c.closed ? (
                      <button type="button" className="adm-kpi-link" style={{ textAlign: 'left' }} onClick={(e) => { e.stopPropagation(); open(`${catName(c.category)}: con problema`, c.ids.problems); }}>
                        {percent(c.problemRate)}
                      </button>
                    ) : '—'}
                    <div className="muted">{[c.late && `${c.late} atraso${c.late > 1 ? 's' : ''}`, c.badService && `${c.badService} mal servicio`, c.claims && `${c.claims} reclamo${c.claims > 1 ? 's' : ''}`, c.proFail && `${c.proFail} no llegó/canceló`].filter(Boolean).join(' · ') || (c.closed ? 'Sin problemas' : '')}</div>
                  </td>
                  <td className="num">{c.avgRating !== null ? c.avgRating.toFixed(1).replace('.', ',') : '—'}</td>
                  <td className="num"><b>{c.perBooking ? money(c.perBooking) : '—'}</b><div className="muted" style={{ fontSize: 12 }}>{c.hulul ? `${money(c.hulul)} en total` : ''}</div></td>
                  <td className="num">{c.total}{c.open ? <div className="muted" style={{ fontSize: 12 }}>{c.open} {c.open === 1 ? 'pendiente' : 'pendientes'}</div> : null}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      {insights.length > 0 && (
        <section className="adm-card">
          <h2>Dónde está la ganancia</h2>
          <p className="sub">Lo que más dinero deja y lo que lo está frenando, según el periodo elegido.</p>
          <ul className="adm-inbox-list">
            {insights.map((i) => (
              <li key={i.title} className={i.ids?.length ? 'adm-clickrow' : undefined} onClick={() => i.ids?.length && open(i.title, i.ids)} style={{ cursor: i.ids?.length ? 'pointer' : 'default' }}>
                <i style={{ background: i.level === 'oportunidad' ? 'var(--ok)' : i.level === 'alerta' ? 'var(--bad)' : 'var(--info)' }} />
                <div><b><span className="adm-inbox-area">{i.level === 'oportunidad' ? 'Oportunidad' : i.level === 'alerta' ? 'Alerta' : 'Dato'}</span> {i.title}</b><small style={{ whiteSpace: 'normal' }}>{i.detail}</small></div>
                <span />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
