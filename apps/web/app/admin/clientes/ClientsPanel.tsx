'use client';

import { useEffect, useMemo, useState } from 'react';
import { bookingInvoices, bookingMoney, caseFlags, clientStats, inRange, toCsv, type ClientStats, type DashBooking } from '@hulul/shared/dashboard';
import { useAdmin } from '../AdminShell';
import { Badge, BookingDetail, BookingListDrawer, BookingsCrm, downloadCsv, downloadPdf, fmtDay, initials, Kpi, Loading, money, PageHead, PeriodBar } from '../ui';

type Sort = 'reciente' | 'reservas' | 'gasto' | 'riesgo' | 'nombre';
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const risk = (c: ClientStats) => c.reported * 3 + c.absent * 2 + c.cancelled + ((c.profile?.balance ?? 0) > 0 ? 1 : 0);

export function ClientsPanel() {
  const { view, range, now } = useAdmin();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('reciente');
  const [onlyPeriod, setOnlyPeriod] = useState(true);
  const [sel, setSel] = useState('');
  const [seg, setSeg] = useState<'' | 'repiten' | 'riesgo' | 'saldo'>('');
  const SEG_LABEL = { repiten: 'Repiten (2+ servicios)', riesgo: 'Reportados o ausentes', saldo: 'Con saldo pendiente' } as const;

  useEffect(() => { const id = new URLSearchParams(window.location.search).get('id'); if (id) setSel(id); }, []);
  const pick = (id: string) => { setSel(id); window.history.replaceState(null, '', id ? `/admin/clientes?id=${encodeURIComponent(id)}` : '/admin/clientes'); window.scrollTo({ top: 0 }); };

  const all = useMemo(() => (view ? clientStats(view, now) : []), [view, now]);
  const rows = useMemo(() => {
    const nq = norm(q.trim());
    const list = all.filter((c) => (!onlyPeriod || c.bookings.some((b) => inRange(b.date, range))) && (!nq || norm(`${c.name} ${c.phone} ${c.clientId}`).includes(nq)));
    const segList = list.filter((c) => !seg || (seg === 'repiten' ? c.done >= 2 : seg === 'riesgo' ? c.reported + c.absent > 0 : (c.profile?.balance ?? 0) > 0));
    const by: Record<Sort, (a: ClientStats, b: ClientStats) => number> = {
      reciente: (a, b) => (b.last ?? b.next ?? '').localeCompare(a.last ?? a.next ?? ''),
      reservas: (a, b) => b.total - a.total, gasto: (a, b) => b.spent - a.spent, riesgo: (a, b) => risk(b) - risk(a), nombre: (a, b) => a.name.localeCompare(b.name),
    };
    return segList.sort(by[sort]);
  }, [all, q, sort, onlyPeriod, range, seg]);
  const base = useMemo(() => all.filter((c) => !onlyPeriod || c.bookings.some((b) => inRange(b.date, range))), [all, onlyPeriod, range]);
  const go = (k: typeof seg) => { setSeg((cur) => (cur === k ? '' : k)); setTimeout(() => document.getElementById('lista-clientes')?.scrollIntoView({ behavior: 'smooth' }), 50); };

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
            <Kpi accent label="Clientes en la vista" value={base.length} hint={onlyPeriod ? 'Con reservas en el periodo' : 'Todos los cargados'} onClick={() => go('')} />
            <Kpi label="Repiten (2+ servicios)" value={base.filter((c) => c.done >= 2).length} hint={seg === 'repiten' ? 'Filtrando la lista ✓' : 'Ver quiénes'} onClick={() => go('repiten')} />
            <Kpi label="Reportados o ausentes" value={base.filter((c) => c.reported + c.absent > 0).length} hint={seg === 'riesgo' ? 'Filtrando la lista ✓' : 'Ver quiénes'} onClick={() => go('riesgo')} />
            <Kpi label="Con saldo pendiente" value={base.filter((c) => (c.profile?.balance ?? 0) > 0).length} hint={`${money(base.reduce((t, c) => t + Math.max(0, c.profile?.balance ?? 0), 0))}${seg === 'saldo' ? ' · filtrando ✓' : ''}`} onClick={() => go('saldo')} />
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
            <div className="adm-table-wrap" id="lista-clientes">
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
  const [tab, setTab] = useState<'historial' | 'cuenta' | 'facturas'>('historial');
  const { view } = useAdmin();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const rucOf = (proId: string) => view?.providers.find((p) => p.uid === proId)?.ruc ?? '';
  const invoices = c.bookings.flatMap((b) => bookingInvoices(b, rucOf(b.proId)));
  const getPdf = async () => {
    setBusy('pdf'); setMsg('');
    try { const { adminClientStatementPdf } = await import('@hulul/shared/firebase'); const f = await adminClientStatementPdf(c.clientId); downloadPdf(f.fileName, f.content); }
    catch (e) { setMsg((e as { message?: string }).message || 'No se pudo generar el PDF.'); } finally { setBusy(''); }
  };
  const sendPdf = async () => {
    if (!window.confirm(`¿Enviar a ${c.name} su estado de cuenta de los últimos 90 días en PDF?`)) return;
    setBusy('mail'); setMsg('');
    try { const { adminSendClientStatement } = await import('@hulul/shared/firebase'); setMsg(`Enviado a ${await adminSendClientStatement(c.clientId)}.`); }
    catch (e) { setMsg((e as { message?: string }).message || 'No se pudo enviar.'); } finally { setBusy(''); }
  };
  const [drill, setDrill] = useState<{ title: string; ids: string[] } | null>(null);
  const pick = (title: string, pred: (b: DashBooking) => boolean) => setDrill({ title: `${c.name}: ${title}`, ids: c.bookings.filter(pred).map((b) => b.id) });
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
        <div className="adm-grid" style={{ gap: 8 }}>
          <button type="button" className="adm-btn solid" disabled={!!busy} onClick={getPdf}>{busy === 'pdf' ? 'Generando…' : 'Estado de cuenta (PDF)'}</button>
          <button type="button" className="adm-btn" disabled={!!busy} onClick={sendPdf}>{busy === 'mail' ? 'Enviando…' : 'Enviar por correo'}</button>
        </div>
        <div className="flags">
          {c.reported > 0 && <Badge tone="t-bad">Reportado {c.reported} {c.reported === 1 ? 'vez' : 'veces'}</Badge>}
          {c.absent > 0 && <Badge tone="t-warm">Ausente {c.absent}</Badge>}
          {c.done >= 2 && <Badge tone="t-ok">Frecuente</Badge>}
        </div>
      </div>
      <div className="adm-kpis">
        <Kpi accent label="Servicios" value={c.total} hint={`${c.done} completados · ${c.scheduled} programados`} onClick={() => pick('servicios', () => true)} />
        <Kpi label="Gastado en HULUL" value={money(c.spent)} onClick={() => setTab('cuenta')} />
        <Kpi label="Saldo pendiente" value={money(c.profile?.balance ?? 0)} hint="Cargos por ausencia o cancelación sin pagar" onClick={() => setTab('cuenta')} />
        <Kpi label="Calificación que da" value={c.avgStarsGiven ? `★ ${c.avgStarsGiven}` : 'Sin calificar'} hint={c.avgStarsReceived ? `Recibe ★ ${c.avgStarsReceived} de los profesionales` : 'Aún sin nota de profesionales'} onClick={() => pick('calificaciones', (b) => b.rating !== null || b.clientStars !== null)} />
        <Kpi label="Cancelaciones" value={c.cancelled} hint={`${c.claims} reclamos`} onClick={() => pick('cancelaciones y reclamos', (b) => b.status === 'cancelada' || !!b.claim)} />
      </div>
      <div className="adm-tabs" role="tablist">
        <button type="button" role="tab" className="adm-tab" aria-selected={tab === 'historial'} onClick={() => setTab('historial')}>Historial ({c.bookings.length})</button>
        <button type="button" role="tab" className="adm-tab" aria-selected={tab === 'cuenta'} onClick={() => setTab('cuenta')}>Estado de cuenta</button>
        <button type="button" role="tab" className="adm-tab" aria-selected={tab === 'facturas'} onClick={() => setTab('facturas')}>Facturas ({invoices.length})</button>
      </div>
      {msg && <div className="adm-note" role="status">{msg}</div>}
      {tab === 'facturas' ? (
        <>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Fecha</th><th>Reserva</th><th>Emite</th><th>Concepto</th><th className="num">Base</th><th className="num">IVA</th><th className="num">Total</th><th>Estado</th></tr></thead>
              <tbody>
                {invoices.length ? invoices.map((i, k) => (
                  <tr key={k} className="click" onClick={() => setDrill({ title: `Reserva ${i.code}`, ids: [i.bookingId] })} style={i.status === 'anulada' ? { opacity: .55 } : undefined}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDay(i.date)}</td><td>{i.code}</td>
                    <td><b>{i.issuer === 'hulul' ? 'HULUL' : 'Profesional'}</b><div className="muted" style={{ fontSize: 12 }}>{i.issuerName}{i.issuerRuc ? ` · RUC ${i.issuerRuc}` : ''}</div></td>
                    <td>{i.concept}</td><td className="num">{money(i.base)}</td><td className="num">{money(i.iva)}</td><td className="num"><b>{money(i.total)}</b></td>
                    <td><Badge tone={i.status === 'anulada' ? 't-mute' : 't-warn'}>{i.status === 'anulada' ? 'Anulada' : 'Por emitir'}</Badge></td>
                  </tr>
                )) : <tr><td colSpan={8} className="adm-empty">Sin comprobantes: aún no hay servicios cobrados.</td></tr>}
              </tbody>
              {invoices.length > 0 && <tfoot><tr><td colSpan={4}>Total</td><td className="num">{money(invoices.reduce((t, i) => t + i.base, 0))}</td><td className="num">{money(invoices.reduce((t, i) => t + i.iva, 0))}</td><td className="num">{money(invoices.reduce((t, i) => t + i.total, 0))}</td><td /></tr></tfoot>}
            </table>
          </div>
          <div className="adm-note">Por cada servicio cobrado el cliente recibe dos comprobantes: el del profesional (visita, IVA según su régimen) y el de HULUL (cargo de plataforma con IVA). «Por emitir»: la facturación electrónica aún no está conectada.</div>
        </>
      ) : tab === 'historial' ? (
        c.bookings.length ? <BookingsCrm bookings={c.bookings} /> : <div className="adm-card adm-empty">Este cliente aún no ha reservado en el rango cargado.</div>
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
      {drill && <BookingListDrawer title={drill.title} ids={drill.ids} onClose={() => setDrill(null)} />}
    </>
  );
}
