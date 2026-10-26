'use client';

import Link from 'next/link';
import { useMemo } from 'react';

const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
import { executive, STAGES } from '@hulul/shared/dashboard';
import { useAdmin } from './AdminShell';
import { catName, Donut, HBars, Kpi, Loading, money, PageHead, percent, PeriodBar, STAGE_COLOR, WeekBars } from './ui';

const RATE_STYLE: Record<string, [string, string]> = {
  success: ['var(--ok-soft)', 'var(--ok)'], late: ['var(--warn-soft)', 'var(--warn)'], badService: ['var(--bad-soft)', 'var(--bad)'],
  clientReported: ['var(--violet-soft)', 'var(--violet)'], proFault: ['var(--bad-soft)', 'var(--bad)'], clientAbsent: ['var(--copper-soft)', 'var(--copper)'], cancelled: ['#EEF1F0', 'var(--text-2)'],
};

export function ExecutivePanel() {
  const { view, range, can } = useAdmin();
  const ex = useMemo(() => (view ? executive(view.bookings, range) : null), [view, range]);

  return (
    <>
      <PageHead title="Resumen ejecutivo" lead="Cómo va HULUL en el periodo: volumen, calidad del servicio y dinero." />
      <PeriodBar />
      {!ex ? <Loading /> : (
        <>
          <div className="adm-kpis">
            <Kpi accent label="Reservas en el periodo" value={ex.total} hint={`${ex.closed} terminadas · ${ex.open} por atender`} />
            <Kpi label="Casos de éxito" value={ex.closed ? percent(ex.rates.success) : '—'} hint={`${ex.counts.success} de ${ex.closed} terminadas`} />
            <Kpi label="Ventas (cobrado a clientes)" value={money(ex.gross)} hint={`Ticket promedio ${money(ex.avgTicket)}`} />
            <Kpi label="Ingreso de HULUL" value={money(ex.hulul)} hint="Cargo de plataforma + comisión + cargos" />
            <Kpi label="Por cobrar (programado)" value={money(ex.projected)} hint={`${ex.byStage.programada + ex.byStage.ejecucion} reservas aún sin cerrar`} />
            <Kpi label="Calificación promedio" value={ex.avgRating ? `★ ${ex.avgRating.toFixed(2).replace('.', ',')}` : '—'} hint={`${ex.ratedCount} calificaciones`} />
          </div>

          <div className="adm-pipe">
            {STAGES.map((s) => (
              <Link key={s.key} href={can('reservas') ? `/admin/reservas?etapa=${s.key}` : '#'} onClick={(e) => { if (!can('reservas')) e.preventDefault(); }} style={{ ['--c' as string]: STAGE_COLOR[s.key] }} title={s.help}>
                <b>{ex.byStage[s.key]}</b><span>{s.label}</span>
              </Link>
            ))}
          </div>

          <div className="adm-grid g-21">
            <section className="adm-card">
              <h2>Del 100 % de lo terminado</h2>
              <p className="sub">Cada reserva terminada o cancelada cuenta una sola vez, con su resultado principal.</p>
              {ex.closed ? (
                <Donut items={ex.outcomes.map((o) => ({ label: o.label, color: o.color, count: o.count }))} center={percent(ex.rates.success)} sub="de éxito" />
              ) : <div className="adm-empty">Aún no hay reservas terminadas en este periodo.</div>}
            </section>
            <section className="adm-card">
              <h2>Calidad del servicio</h2>
              <p className="sub">Porcentaje sobre {ex.closed} reservas terminadas. Una reserva puede tener varias marcas.</p>
              <div className="adm-rates">
                {([
                  ['success', 'Éxito', ex.counts.success, 'Completada, a tiempo, sin reclamo ni mala nota'],
                  ['late', 'Llegaron atrasados', ex.counts.late, ex.avgLateMin ? `${ex.avgLateMin} min de atraso promedio` : 'Más de 15 min tarde'],
                  ['badService', 'Mal servicio', ex.counts.badService, '★ 1–2, no resuelto o reclamo del cliente'],
                  ['clientReported', 'Clientes reportados', ex.counts.clientReported, 'Reclamo del profesional o ★ 1–2 al cliente'],
                  ['proFault', 'Profesional no llegó o canceló', ex.counts.proFault, 'Faltas con multa'],
                  ['clientAbsent', 'Cliente ausente', ex.counts.clientAbsent, 'Se cobró la visita'],
                  ['cancelled', 'Cancelaciones', ex.counts.cancelled, 'Por cualquiera de las partes'],
                ] as const).map(([k, label, n, help]) => (
                  <div key={k} className="adm-rate" style={{ background: RATE_STYLE[k][0], color: RATE_STYLE[k][1] }}>
                    <span>{label}</span>
                    <b>{ex.closed ? percent(ex.rates[k]) : '—'}</b>
                    <small>{n} {n === 1 ? 'caso' : 'casos'} · {help}</small>
                  </div>
                ))}
              </div>
              <p className="muted" style={{ fontSize: 12.5, margin: '12px 0 0' }}>Reclamos abiertos en el periodo: <b>{ex.counts.claims}</b> {can('reclamos') && <>· <Link href="/admin/reclamos">ver reclamos</Link></>}</p>
            </section>
          </div>

          <div className="adm-grid g-2">
            <section className="adm-card">
              <h2>Reservas por semana</h2>
              <p className="sub">Éxitos y casos con algún problema (atraso, mal servicio, cancelación, ausencia).</p>
              <WeekBars
                weeks={ex.byWeek.map((w) => ({ week: w.week, parts: [
                  { value: w.success, color: '#206344', label: 'Éxito' },
                  { value: w.problems, color: '#C98A1B', label: 'Con problema' },
                  { value: Math.max(0, w.total - w.success - w.problems), color: '#9DB6C9', label: 'Por atender' },
                ] }))}
                legend={[{ label: 'Éxito', color: '#206344' }, { label: 'Con problema', color: '#C98A1B' }, { label: 'Por atender', color: '#9DB6C9' }]}
              />
            </section>
            <section className="adm-card">
              <h2>Por categoría</h2>
              <p className="sub">Reservas y ventas de cada servicio.</p>
              <HBars items={ex.byCategory.slice(0, 10).map((c) => ({ label: catName(c.category), value: c.count, display: `${c.count} · ${money(c.gross)}`, parts: [{ value: c.success, color: '#206344' }, { value: c.count - c.success, color: '#9DB6C9' }] }))} />
            </section>
          </div>

          <div className="adm-grid g-3">
            <section className="adm-card">
              <h2>Mejores profesionales</h2>
              <p className="sub">Más casos de éxito en el periodo.</p>
              {ex.topPros.length ? (
                <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8, fontSize: 14 }}>
                  {ex.topPros.map((p) => <li key={p.proId}><Link href={`/admin/proveedores?id=${p.proId}`}><b>{p.name || '—'}</b></Link><div className="muted" style={{ fontSize: 12.5 }}>{p.success} de {p.done} con éxito{p.rating ? ` · ★ ${p.rating.toFixed(2).replace(".", ",")}` : ''}</div></li>)}
                </ol>
              ) : <div className="adm-empty">Sin trabajos terminados.</div>}
            </section>
            <section className="adm-card">
              <h2>Profesionales a vigilar</h2>
              <p className="sub">Atrasos, mal servicio o faltas.</p>
              {ex.watchPros.length ? (
                <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8, fontSize: 14 }}>
                  {ex.watchPros.map((p) => <li key={p.proId}><Link href={`/admin/proveedores?id=${p.proId}`}><b>{p.name || '—'}</b></Link><div className="muted" style={{ fontSize: 12.5 }}>{[p.late && n(p.late, 'atraso', 'atrasos'), p.bad && n(p.bad, 'mal servicio', 'mal servicio'), p.noShow && n(p.noShow, 'falta', 'faltas')].filter(Boolean).join(' · ')}</div></li>)}
                </ul>
              ) : <div className="adm-empty">Nadie con problemas. 👌</div>}
            </section>
            <section className="adm-card">
              <h2>Clientes a vigilar</h2>
              <p className="sub">Reportados, ausentes o que cancelan seguido.</p>
              {ex.watchClients.length ? (
                <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8, fontSize: 14 }}>
                  {ex.watchClients.map((c) => <li key={c.clientId}>{can('clientes') ? <Link href={`/admin/clientes?id=${c.clientId}`}><b>{c.name || '—'}</b></Link> : <b>{c.name || '—'}</b>}<div className="muted" style={{ fontSize: 12.5 }}>{[c.reported && n(c.reported, 'reporte', 'reportes'), c.absent && n(c.absent, 'ausencia', 'ausencias'), c.cancelled && n(c.cancelled, 'cancelación', 'cancelaciones')].filter(Boolean).join(' · ')}</div></li>)}
                </ul>
              ) : <div className="adm-empty">Nadie con problemas.</div>}
            </section>
          </div>

          <div className="adm-kpis">
            <Kpi label="Clientes atendidos" value={ex.clients} hint={`${ex.newClients} nuevos · ${ex.repeatClients} repiten`} />
            <Kpi label="Profesionales activos" value={ex.activePros} hint="Con al menos una reserva" />
            <Kpi label="Para los profesionales" value={money(ex.pro)} hint="Visitas y adicionales, menos comisión" />
          </div>
        </>
      )}
    </>
  );
}
