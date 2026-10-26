'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { caseFlags, caseOutcome, executive, inRange, quality, weekMoney, type CaseFlags, type DashBooking } from '@hulul/shared/dashboard';
import { useAdmin } from './AdminShell';
import { BookingListDrawer, catName, Donut, fmtDay, HBars, Kpi, Loading, money, PageHead, percent, PeriodBar, WeekBars } from './ui';

const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
const stars = (x: number | null) => (x === null ? '—' : `★ ${x.toFixed(2).replace('.', ',')}`);

/**
 * Resumen ejecutivo: dinero de la semana (lo que entra y lo que HULUL paga) y la
 * calidad del servicio. Cada número abre la lista de reservas que lo forman.
 * Las etapas (programadas, en ejecución…) viven en Reservas (CRM).
 */
export function ExecutivePanel() {
  const { view, range, now, can } = useAdmin();
  const [drill, setDrill] = useState<{ title: string; ids: string[] } | null>(null);
  const open = (title: string, ids: string[]) => setDrill({ title, ids });

  const ex = useMemo(() => (view ? executive(view.bookings, range) : null), [view, range]);
  const q = useMemo(() => (view ? quality(view.bookings, range) : null), [view, range]);
  const wm = useMemo(() => (view ? weekMoney(view, now) : null), [view, now]);
  const rows = useMemo(() => (view?.bookings ?? []).filter((b) => inRange(b.date, range)), [view, range]);
  const ids = (pred: (b: DashBooking, f: CaseFlags) => boolean) => rows.filter((b) => pred(b, caseFlags(b))).map((b) => b.id);

  return (
    <>
      <PageHead title="Resumen ejecutivo" lead="Dinero de la semana y cómo se está dando el servicio. Toca cualquier número para ver de dónde sale." />
      <PeriodBar />
      {!ex || !q || !wm ? <Loading /> : (
        <>
          {can('contabilidad') && (
            <section className="adm-card">
              <h2>Dinero de esta semana</h2>
              <p className="sub">Del {fmtDay(wm.week.from)} al {fmtDay(wm.week.to)}. No depende del periodo elegido arriba.</p>
              <div className="adm-kpis">
                <Kpi accent label="Entra (cobrado con tarjeta)" value={money(wm.collected)} hint={`Ingreso propio de HULUL ${money(wm.income)}`} href="/admin/contabilidad?vista=movimientos" />
                <Kpi label="HULUL debe pagar hoy" value={money(wm.toPayNow.amount)} hint={wm.toPayNow.count ? `${n(wm.toPayNow.count, 'liquidación', 'liquidaciones')} por transferir` : 'Nada pendiente'} href="/admin/contabilidad?vista=pagar" />
                <Kpi label={`Pago del lunes ${fmtDay(wm.nextPayout.date)}`} value={money(wm.nextPayout.estimate)} hint={`Estimado · ${n(wm.nextPayout.pros, 'profesional', 'profesionales')}`} href="/admin/contabilidad?vista=pagar" />
                <Kpi label="IVA y créditos a clientes" value={money(wm.vatDue + wm.credits)} hint={`IVA ${money(wm.vatDue)} · créditos ${money(wm.credits)}`} href="/admin/contabilidad" />
              </div>
            </section>
          )}

          <div className="adm-kpis">
            <Kpi accent label="Reservas en el periodo" value={ex.total} hint={`${ex.closed} terminadas · ${ex.open} por atender`} onClick={() => open('Reservas del periodo', rows.map((b) => b.id))} />
            <Kpi label="Casos de éxito" value={ex.closed ? percent(ex.rates.success) : '—'} hint={`${ex.counts.success} de ${ex.closed} terminadas`} onClick={() => open('Casos de éxito', ids((_, f) => f.success))} />
            <Kpi label="Calificación promedio" value={stars(q.avgRating)} hint={`${q.rated} calificaciones`} onClick={() => open('Reservas calificadas', ids((b) => b.rating !== null))} />
            <Kpi label="Llegaron a tiempo" value={q.punctuality.arrived ? percent(q.punctuality.onTime.count / q.punctuality.arrived) : '—'} hint={q.punctuality.avgLateMin ? `Los tardes, ${q.punctuality.avgLateMin} min en promedio` : 'Tolerancia 15 min'} onClick={() => open('Llegaron tarde', q.punctuality.late.ids)} />
            <Kpi label="Clientes que vuelven" value={q.loyalty.clients ? percent(q.loyalty.returning.count / q.loyalty.clients) : '—'} hint={`${q.loyalty.returning.count} de ${q.loyalty.clients} clientes`} onClick={() => open('Clientes que vuelven a reservar', q.loyalty.returning.ids)} />
            <Kpi label="Ventas del periodo" value={money(ex.gross)} hint={`Ingreso HULUL ${money(ex.hulul)}`} onClick={() => open('Reservas cobradas', ids((b) => b.status === 'completada' || (b.status === 'cancelada' && b.cancelFee > 0)))} />
          </div>

          <div className="adm-grid g-21">
            <section className="adm-card">
              <h2>Del 100 % de lo terminado</h2>
              <p className="sub">Cada reserva terminada o cancelada cuenta una vez, con su resultado principal. Toca una fila para ver los casos.</p>
              {ex.closed ? (
                <Donut center={percent(ex.rates.success)} sub="de éxito" items={ex.outcomes.map((o) => ({
                  label: o.label, color: o.color, count: o.count,
                  onClick: () => open(o.label, ids((b, f) => caseOutcome(b, f) === o.key)),
                }))} />
              ) : <div className="adm-empty">Aún no hay reservas terminadas en este periodo. Prueba con «Todo» o marca «Incluir pruebas».</div>}
            </section>
            <section className="adm-card">
              <h2>Lo que opinan los clientes</h2>
              <p className="sub">Estrellas que dieron al profesional en el periodo.</p>
              <HBars max={Math.max(1, ...q.stars.map((s) => s.count))} items={q.stars.map((s) => ({
                label: s.label, value: s.count, display: `${s.count}${q.rated ? ` · ${percent(s.count / q.rated)}` : ''}`,
                color: Number(s.key) >= 4 ? '#206344' : Number(s.key) === 3 ? '#C98A1B' : '#B42318',
                onClick: s.count ? () => open(`Calificaciones de ${s.label}`, s.ids) : undefined,
              }))} />
              <h3 style={{ margin: '16px 0 8px', fontSize: 14 }}>Comentarios con 3 estrellas o menos</h3>
              {q.comments.length ? (
                <div className="adm-grid" style={{ gap: 10 }}>
                  {q.comments.map((c) => (
                    <div key={c.id} className="adm-quote adm-clickrow" role="button" tabIndex={0} onClick={() => open(`Reserva ${c.code}`, [c.id])}>
                      <p>«{c.text}»</p>
                      <small>{'★'.repeat(Math.round(c.rating))} · {catName(c.category)} · {c.proName} · {fmtDay(c.date)}</small>
                    </div>
                  ))}
                </div>
              ) : <p className="muted" style={{ fontSize: 13, margin: 0 }}>Sin comentarios bajos en el periodo.</p>}
            </section>
          </div>

          <div className="adm-grid g-3">
            <section className="adm-card">
              <h2>Cómo quedó el trabajo</h2>
              <p className="sub">Lo que marcó el profesional al terminar.</p>
              <HBars items={q.outcomes.map((o) => ({ label: o.label, value: o.count, display: o.count, color: o.key === 'resuelto' ? '#206344' : o.key === 'parcial' ? '#C98A1B' : '#B42318', onClick: o.count ? () => open(o.label, o.ids) : undefined }))} />
            </section>
            <section className="adm-card">
              <h2>Puntualidad y respuesta</h2>
              <p className="sub">Llegada a la dirección y tiempo para aceptar.</p>
              <HBars items={[
                { label: 'A tiempo', value: q.punctuality.onTime.count, display: q.punctuality.onTime.count, color: '#206344', onClick: q.punctuality.onTime.count ? () => open('Llegaron a tiempo', q.punctuality.onTime.ids) : undefined },
                { label: 'Tarde (+15 min)', value: q.punctuality.late.count, display: q.punctuality.late.count, color: '#C98A1B', onClick: q.punctuality.late.count ? () => open('Llegaron tarde', q.punctuality.late.ids) : undefined },
              ]} />
              <p className="muted" style={{ fontSize: 13, margin: '12px 0 0' }}>
                Aceptan en {q.accept.avgMin !== null ? `${q.accept.avgMin} min en promedio` : '—'}{q.accept.count ? ` · ${percent(q.accept.within15 / q.accept.count)} en menos de 15 min` : ''}.
              </p>
            </section>
            <section className="adm-card">
              <h2>Fidelidad</h2>
              <p className="sub">Señal de que el servicio gustó.</p>
              <HBars max={Math.max(1, q.loyalty.clients)} items={[
                { label: 'Vuelven a reservar', value: q.loyalty.returning.count, display: `${q.loyalty.returning.count} de ${q.loyalty.clients}`, color: '#123F43', onClick: q.loyalty.returning.count ? () => open('Clientes que vuelven', q.loyalty.returning.ids) : undefined },
                { label: 'Mismo profesional', value: q.loyalty.samePro.count, display: `${q.loyalty.samePro.count} de ${q.loyalty.clients}`, color: '#1F4E79', onClick: q.loyalty.samePro.count ? () => open('Repiten con el mismo profesional', q.loyalty.samePro.ids) : undefined },
              ]} />
            </section>
          </div>

          <div className="adm-grid g-2">
            <section className="adm-card">
              <h2>Calificación por servicio</h2>
              <p className="sub">Promedio de estrellas y trabajos completados por categoría.</p>
              <HBars max={5} items={q.categories.slice(0, 10).map((c) => ({
                label: catName(c.category), value: c.avg ?? 0, display: `${c.avg !== null ? stars(c.avg) : 'sin nota'} · ${c.done}`,
                color: (c.avg ?? 5) >= 4.5 ? '#206344' : (c.avg ?? 5) >= 3.5 ? '#C98A1B' : '#B42318', onClick: c.ids.length ? () => open(catName(c.category), c.ids) : undefined,
              }))} />
            </section>
            <section className="adm-card">
              <h2>Por qué se cae o se reclama</h2>
              <p className="sub">Motivos de cancelación y de reclamo en el periodo.</p>
              <HBars items={[
                ...q.cancelReasons.map((c) => ({ label: c.label, value: c.count, display: c.count, color: '#8FA6A3', onClick: () => open(`Canceladas: ${c.label}`, c.ids) })),
                ...q.claimReasons.map((c) => ({ label: `Reclamo: ${c.label}`, value: c.count, display: c.count, color: '#6A3A8C', onClick: () => open(`Reclamo: ${c.label}`, c.ids) })),
              ]} />
            </section>
          </div>

          <section className="adm-card">
            <h2>Semana a semana</h2>
            <p className="sub">Casos de éxito, con problema y por atender cada semana.</p>
            <WeekBars
              weeks={ex.byWeek.map((w) => ({ week: w.week, parts: [
                { value: w.success, color: '#206344', label: 'Éxito' },
                { value: w.problems, color: '#C98A1B', label: 'Con problema' },
                { value: Math.max(0, w.total - w.success - w.problems), color: '#9DB6C9', label: 'Por atender' },
              ] }))}
              legend={[{ label: 'Éxito', color: '#206344' }, { label: 'Con problema', color: '#C98A1B' }, { label: 'Por atender', color: '#9DB6C9' }]}
            />
          </section>

          <div className="adm-grid g-3">
            <section className="adm-card">
              <h2>Mejores profesionales</h2>
              <p className="sub">Más casos de éxito en el periodo.</p>
              {ex.topPros.length ? (
                <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8, fontSize: 14 }}>
                  {ex.topPros.map((p) => <li key={p.proId}><Link href={`/admin/proveedores?id=${p.proId}`}><b>{p.name || '—'}</b></Link><div className="muted" style={{ fontSize: 12.5 }}>{p.success} de {p.done} con éxito{p.rating ? ` · ${stars(p.rating)}` : ''}</div></li>)}
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
              ) : <div className="adm-empty">Nadie con problemas.</div>}
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
        </>
      )}
      {drill && <BookingListDrawer title={drill.title} ids={drill.ids} onClose={() => setDrill(null)} />}
    </>
  );
}
