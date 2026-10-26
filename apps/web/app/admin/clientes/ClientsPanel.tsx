'use client';

import { useEffect, useMemo, useState } from 'react';
import { bookingMoney, caseFlags, clientStats, inRange, stageOf, STAGES, toCsv, type ClientStats, type DashBooking } from '@hulul/shared/dashboard';
import { useAdmin } from '../AdminShell';
import { Badge, BookingCard, BookingDetail, downloadCsv, fmtDay, initials, Kpi, Loading, money, PageHead, PeriodBar } from '../ui';

type Sort = 'reciente' | 'reservas' | 'gasto' | 'riesgo' | 'nombre';
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const risk = (c: ClientStats) => c.reported * 3 + c.absent * 2 + c.cancelled + ((c.profile?.balance ?? 0) > 0 ? 1 : 0);

export function ClientsPanel() {
  const { view, range, now } = useAdmin();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('reciente');
  const [onlyPeriod, setOnlyPeriod] = useState(true);
  const [sel, setSel] = useState('');

  useEffect(() => { const id = new URLSearchParams(window.location.search).get('id'); if (id) setSel(id); }, []);
  const pick = (id: string) => { setSel(id); window.history.replaceState(null, '', id ? `/admin/clientes?id=${encodeURIComponent(id)}` : '/admin/clientes'); window.scrollTo({ top: 0 }); };

  const all = useMemo(() => (view ? clientStats(view, now) : []), [view, now]);
  const rows = useMemo(() => {
    const nq = norm(q.trim());
    const list = all.filter((c) => (!onlyPeriod || c.bookings.some((b) => inRange(b.date, range))) && (!nq || norm(`${c.name} ${c.phone} ${c.clientId}`).includes(nq)));
    const by: Record<Sort, (a: ClientStats, b: ClientStats) => number> = {
      reciente: (a, b) => (b.last ?? b.next ?? '').localeCompare(a.last ?? a.next ?? ''),
      reservas: (a, b) => b.total - a.total, gasto: (a, b) => b.spent - a.spent, riesgo: (a, b) => risk(b) - risk(a), nombre: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(by[sort]);
  }, [all, q, sort, onlyPeriod, range]);

  const current = sel ? all.find((c) => c.clientId === sel) : null;

  const exportCsv = () => downloadCsv('hulul-clientes.csv', toCsv(rows.map((c) => ({
    cliente: c.name, celular: c.phone, reservas: c.total, completadas: c.done, programadas: c.scheduled, canceladas: c.cancelled, ausencias: c.absent,
    reportes: c.reported, reclamos: c.claims, gastado: c.spent, saldo_pendiente: c.profile?.balance ?? 0, primera: c.first ?? '', ultima: c.last ?? '', proxima: c.next ?? '',
  })), ['cliente', 'celular', 'reservas', 'completadas', 'programadas', 'canceladas', 'ausencias', 'reportes', 'reclamos', 'gastado', 'saldo_pendiente', 'primera', 'ultima', 'proxima'].map((k) => ({ key: k, label: k.replace(/_/g, ' ') }))));

  if (current) return <ClientDetail c={current} onBack={() => pick('')} />;

  return (
    <>
      <PageHead title="Clientes" lead="Cada cliente con su historial, su estado de cuenta y cómo se ha portado." />
      <PeriodBar />
      {!view ? <Loading /> : (
        <>
          <div className="adm-kpis">
            <Kpi accent label="Clientes en la vista" value={rows.length} hint={onlyPeriod ? 'Con reservas en el periodo' : 'Todos los cargados'} />
            <Kpi label="Repiten (2+ servicios)" value={rows.filter((c) => c.done >= 2).length} />
            <Kpi label="Reportados o ausentes" value={rows.filter((c) => c.reported + c.absent > 0).length} />
            <Kpi label="Con saldo pendiente" value={rows.filter((c) => (c.profile?.balance ?? 0) > 0).length} hint={money(rows.reduce((t, c) => t + Math.max(0, c.profile?.balance ?? 0), 0))} />
          </div>
          <div className="adm-bar">
            <input className="adm-input adm-search" type="search" placeholder="Buscar por nombre o celular" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="adm-select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar">
              <option value="reciente">Más recientes</option><option value="reservas">Más reservas</option><option value="gasto">Más gasto</option><option value="riesgo">Más reportes y ausencias</option><option value="nombre">Nombre</option>
            </select>
            <label className="adm-toggle"><input type="checkbox" checked={onlyPeriod} onChange={(e) => setOnlyPeriod(e.target.checked)} /> Solo con reservas en el periodo</label>
            <button type="button" className="adm-btn" onClick={exportCsv} disabled={!rows.length}>Exportar CSV</button>
          </div>
          {rows.length === 0 ? <div className="adm-card adm-empty">No hay clientes en esta vista.</div> : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Cliente</th><th className="num">Reservas</th><th className="num">Completadas</th><th className="num">Gastado</th><th>Última / próxima</th><th>Señales</th></tr></thead>
                <tbody>
                  {rows.slice(0, 500).map((c) => (
                    <tr key={c.clientId} className="click" onClick={() => pick(c.clientId)}>
                      <td><b>{c.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{c.phone}</div></td>
                      <td className="num">{c.total}</td>
                      <td className="num">{c.done}</td>
                      <td className="num">{money(c.spent)}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{c.last ? fmtDay(c.last) : '—'}{c.next ? <div className="muted">Próxima: {fmtDay(c.next)}</div> : null}</td>
                      <td><div className="flags">
                        {c.reported > 0 && <Badge tone="t-bad">{c.reported} reportes</Badge>}
                        {c.absent > 0 && <Badge tone="t-warm">{c.absent} ausente</Badge>}
                        {c.cancelled > 1 && <Badge tone="t-mute">{c.cancelled} cancelaciones</Badge>}
                        {c.claims > 0 && <Badge tone="t-violet">{c.claims} reclamos</Badge>}
                        {(c.profile?.balance ?? 0) > 0 && <Badge tone="t-bad">Debe {money(c.profile!.balance)}</Badge>}
                        {c.done >= 2 && <Badge tone="t-ok">Frecuente</Badge>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

function ClientDetail({ c, onBack }: { c: ClientStats; onBack: () => void }) {
  const [open, setOpen] = useState<DashBooking | null>(null);
  const [tab, setTab] = useState<'historial' | 'cuenta'>('historial');
  const groups = STAGES.map((s) => ({ ...s, list: c.bookings.filter((b) => stageOf(b) === s.key) })).filter((g) => g.list.length);
  const moves = c.bookings.filter((b) => b.status === 'completada' || (b.status === 'cancelada' && b.cancelFee > 0) || b.clientCredit > 0);
  return (
    <>
      <button type="button" className="adm-back" onClick={onBack}>← Clientes</button>
      <div className="adm-card adm-head-card">
        <div className="adm-avatar">{initials(c.name)}</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>{c.name}</h1>
          <div className="muted" style={{ fontSize: 13.5 }}>{[c.phone, c.profile?.email].filter(Boolean).join(' · ')}{c.profile?.createdAt ? ` · cliente desde ${new Date(c.profile.createdAt).toLocaleDateString('es-EC', { month: 'short', year: 'numeric' })}` : ''}</div>
        </div>
        <div className="flags">
          {c.reported > 0 && <Badge tone="t-bad">Reportado {c.reported} {c.reported === 1 ? 'vez' : 'veces'}</Badge>}
          {c.absent > 0 && <Badge tone="t-warm">Ausente {c.absent}</Badge>}
          {c.done >= 2 && <Badge tone="t-ok">Frecuente</Badge>}
        </div>
      </div>
      <div className="adm-kpis">
        <Kpi accent label="Servicios" value={c.total} hint={`${c.done} completados · ${c.scheduled} programados`} />
        <Kpi label="Gastado en HULUL" value={money(c.spent)} />
        <Kpi label="Saldo pendiente" value={money(c.profile?.balance ?? 0)} hint="Cargos por ausencia o cancelación sin pagar" />
        <Kpi label="Calificación que da" value={c.avgStarsGiven ? `★ ${c.avgStarsGiven}` : '—'} hint={c.avgStarsReceived ? `Recibe ★ ${c.avgStarsReceived} de los profesionales` : 'Aún sin nota de profesionales'} />
        <Kpi label="Cancelaciones" value={c.cancelled} hint={`${c.claims} reclamos`} />
      </div>
      <div className="adm-tabs" role="tablist">
        <button type="button" role="tab" className="adm-tab" aria-selected={tab === 'historial'} onClick={() => setTab('historial')}>Historial ({c.bookings.length})</button>
        <button type="button" role="tab" className="adm-tab" aria-selected={tab === 'cuenta'} onClick={() => setTab('cuenta')}>Estado de cuenta</button>
      </div>
      {tab === 'historial' ? (
        groups.length ? groups.map((g) => (
          <section key={g.key} className="adm-grid" style={{ gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>{g.label} <span className="muted" style={{ fontWeight: 600 }}>· {g.list.length}</span></h2>
            <div className="adm-cards">{g.list.map((b) => <BookingCard key={b.id} b={b} onOpen={setOpen} showStage />)}</div>
          </section>
        )) : <div className="adm-card adm-empty">Este cliente aún no ha reservado en el rango cargado.</div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Fecha</th><th>Reserva</th><th>Concepto</th><th className="num">Cobrado</th><th className="num">Crédito</th></tr></thead>
            <tbody>
              {moves.length ? moves.map((b) => {
                const f = caseFlags(b);
                return (
                  <tr key={b.id} className="click" onClick={() => setOpen(b)}>
                    <td>{fmtDay(b.date)}</td><td>{b.code}</td>
                    <td>{b.status === 'completada' ? `Servicio ${b.proName ? `con ${b.proName}` : ''}` : f.clientAbsent ? 'Cliente ausente (visita)' : b.cancelFee > 0 ? 'Cancelación tardía' : 'Crédito por falta del profesional'}</td>
                    <td className="num">{b.status === 'completada' ? money(bookingMoney(b).gross) : b.cancelFee > 0 ? money(b.cancelFee) : '—'}</td>
                    <td className="num">{b.clientCredit > 0 ? money(b.clientCredit) : '—'}</td>
                  </tr>
                );
              }) : <tr><td colSpan={5} className="adm-empty">Sin movimientos.</td></tr>}
            </tbody>
            {moves.length > 0 && <tfoot><tr><td colSpan={3}>Total</td><td className="num">{money(c.spent)}</td><td className="num">{money(moves.reduce((t, b) => t + b.clientCredit, 0))}</td></tr></tfoot>}
          </table>
        </div>
      )}
      {open && <BookingDetail b={open} onClose={() => setOpen(null)} />}
    </>
  );
}
