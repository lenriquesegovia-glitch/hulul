'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { TAX_REGIME_LABEL, type TaxRegime } from '@hulul/shared';
import { inRange, percent, providerStats, toCsv, type DashBooking, type ProviderStats } from '@hulul/shared/dashboard';
import { useAdmin } from '../AdminShell';
import { Badge, BookingCard, BookingDetail, catName, downloadCsv, fmtDay, fmtWeek, fmtWhen, HBars, initials, Kpi, Loading, money, PageHead, PeriodBar } from '../ui';

type Sort = 'facturado' | 'trabajos' | 'calificacion' | 'problemas' | 'saldo' | 'nombre';
const STATUS: Record<string, [string, string]> = {
  aprobado: ['Aprobado', 't-ok'], en_revision: ['Por revisar', 't-info'], observado: ['Observado', 't-warn'], rechazado: ['Rechazado', 't-bad'], '': ['Sin registro', 't-mute'],
};
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const regime = (r: string) => TAX_REGIME_LABEL[r as TaxRegime] ?? r;

export function ProvidersPanel() {
  const { view, range, now } = useAdmin();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('aprobado');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState<Sort>('facturado');
  const [sel, setSel] = useState('');

  useEffect(() => { const id = new URLSearchParams(window.location.search).get('id'); if (id) setSel(id); }, []);
  const pick = (id: string) => { setSel(id); window.history.replaceState(null, '', id ? `/admin/proveedores?id=${encodeURIComponent(id)}` : '/admin/proveedores'); window.scrollTo({ top: 0 }); };

  const all = useMemo(() => (view ? providerStats(view, range, now) : []), [view, range, now]);
  const cats = useMemo(() => [...new Set(all.flatMap((p) => p.provider.categories))].sort((a, b) => catName(a).localeCompare(catName(b))), [all]);
  const rows = useMemo(() => {
    const nq = norm(q.trim());
    const by: Record<Sort, (a: ProviderStats, b: ProviderStats) => number> = {
      facturado: (a, b) => b.billed.total - a.billed.total, trabajos: (a, b) => b.done - a.done, calificacion: (a, b) => (b.provider.rating ?? 0) - (a.provider.rating ?? 0),
      problemas: (a, b) => (b.late + b.bad + b.cancelledByPro * 2) - (a.late + a.bad + a.cancelledByPro * 2), saldo: (a, b) => b.pending - a.pending,
      nombre: (a, b) => a.provider.name.localeCompare(b.provider.name),
    };
    return all.filter((p) => (status === 'todos' || p.provider.status === status) && (!cat || p.provider.categories.includes(cat))
      && (!nq || norm(`${p.provider.name} ${p.provider.ruc} ${p.provider.categories.map(catName).join(' ')}`).includes(nq))).sort(by[sort]);
  }, [all, q, status, cat, sort]);

  const current = sel ? all.find((p) => p.provider.uid === sel) : null;
  const totals = rows.reduce((t, p) => ({ billed: t.billed + p.billed.total, commission: t.commission + p.commission, toPay: t.toPay + p.toPay, done: t.done + p.done }), { billed: 0, commission: 0, toPay: 0, done: 0 });

  const exportCsv = () => downloadCsv(`hulul-proveedores-${range.from}_${range.to}.csv`, toCsv(rows.map((p) => ({
    proveedor: p.provider.name, ruc: p.provider.ruc, regimen: regime(p.provider.taxRegime), estado: p.provider.status, categorias: p.provider.categories.map(catName).join(', '),
    trabajos: p.done, exito: p.success, atrasos: p.late, mal_servicio: p.bad, faltas: p.cancelledByPro, calificacion: p.provider.rating ?? '',
    facturado_base: p.billed.base, facturado_iva: p.billed.iva, facturado_total: p.billed.total, comision_hulul: p.commission, multas: p.fines, pagado: p.paid, por_pagar: p.toPay, saldo_pendiente: p.pending,
  })), ['proveedor', 'ruc', 'regimen', 'estado', 'categorias', 'trabajos', 'exito', 'atrasos', 'mal_servicio', 'faltas', 'calificacion', 'facturado_base', 'facturado_iva', 'facturado_total', 'comision_hulul', 'multas', 'pagado', 'por_pagar', 'saldo_pendiente'].map((k) => ({ key: k, label: k.replace(/_/g, ' ') }))));

  if (current) return <ProviderDetail p={current} onBack={() => pick('')} />;

  return (
    <>
      <PageHead title="Proveedores" lead="Cada profesional con lo que ha facturado, su actividad, sus pagos y su desempeño." />
      <PeriodBar />
      {!view ? <Loading /> : (
        <>
          <div className="adm-kpis">
            <Kpi accent label="Proveedores en la vista" value={rows.length} hint={`${rows.filter((p) => p.done > 0).length} con trabajos en el periodo`} />
            <Kpi label="Facturado por ellos" value={money(totals.billed)} hint={`${totals.done} visitas completadas`} />
            <Kpi label="Comisión de HULUL" value={money(totals.commission)} />
            <Kpi label="Por transferirles" value={money(totals.toPay)} hint="Liquidaciones por pagar" />
          </div>
          <div className="adm-bar">
            <input className="adm-input adm-search" type="search" placeholder="Buscar por nombre, RUC o categoría" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="adm-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado">
              <option value="aprobado">Aprobados</option><option value="en_revision">Por revisar</option><option value="observado">Observados</option><option value="rechazado">Rechazados</option><option value="todos">Todos</option>
            </select>
            <select className="adm-select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría">
              <option value="">Todas las categorías</option>
              {cats.map((c) => <option key={c} value={c}>{catName(c)}</option>)}
            </select>
            <select className="adm-select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar">
              <option value="facturado">Más facturado</option><option value="trabajos">Más trabajos</option><option value="calificacion">Mejor calificación</option><option value="problemas">Más problemas</option><option value="saldo">Mayor saldo</option><option value="nombre">Nombre</option>
            </select>
            <button type="button" className="adm-btn" onClick={exportCsv} disabled={!rows.length}>Exportar CSV</button>
          </div>
          {rows.length === 0 ? <div className="adm-card adm-empty">No hay proveedores con estos filtros.</div> : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Proveedor</th><th>Actividad</th><th className="num">Trabajos</th><th className="num">Éxito</th><th className="num">★</th><th className="num">Facturado</th><th className="num">Comisión</th><th className="num">Saldo</th><th>Señales</th></tr></thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.provider.uid} className="click" onClick={() => pick(p.provider.uid)}>
                      <td><b>{p.provider.name || '—'}</b><div className="muted" style={{ fontSize: 12.5 }}>{p.provider.ruc || 'Sin RUC'} · {regime(p.provider.taxRegime)}</div></td>
                      <td style={{ fontSize: 13 }}>{p.provider.categories.slice(0, 3).map(catName).join(', ')}{p.provider.categories.length > 3 ? ` +${p.provider.categories.length - 3}` : ''}</td>
                      <td className="num">{p.done}{p.scheduled ? <div className="muted" style={{ fontSize: 12 }}>+{p.scheduled} prog.</div> : null}</td>
                      <td className="num">{p.done ? percent(p.success / Math.max(1, p.done + p.cancelledByPro)) : '—'}</td>
                      <td className="num">{p.provider.rating ? p.provider.rating.toFixed(1).replace('.', ',') : '—'}</td>
                      <td className="num">{money(p.billed.total)}</td>
                      <td className="num">{money(p.commission)}</td>
                      <td className="num" style={{ color: p.pending < 0 ? 'var(--bad)' : undefined }}>{money(p.pending)}</td>
                      <td><div className="flags">
                        <Badge tone={(STATUS[p.provider.status] ?? STATUS[''])[1]}>{(STATUS[p.provider.status] ?? STATUS[''])[0]}</Badge>
                        {p.provider.suspendedUntil && <Badge tone="t-bad">Suspendido</Badge>}
                        {p.provider.strikes30 > 0 && <Badge tone="t-warn">{p.provider.strikes30}/3 faltas</Badge>}
                        {p.late > 0 && <Badge tone="t-warn">{p.late} {p.late === 1 ? "atraso" : "atrasos"}</Badge>}
                        {p.bad > 0 && <Badge tone="t-bad">{p.bad} mal servicio</Badge>}
                        {p.toPay > 0 && <Badge tone="t-info">Por pagar {money(p.toPay)}</Badge>}
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

function ProviderDetail({ p, onBack }: { p: ProviderStats; onBack: () => void }) {
  const { view, range } = useAdmin();
  const [tab, setTab] = useState<'facturas' | 'pagos' | 'actividad'>('facturas');
  const [open, setOpen] = useState<DashBooking | null>(null);
  const v = p.provider;
  const st = STATUS[v.status] ?? STATUS[''];
  const recent = useMemo(() => (view?.bookings ?? []).filter((b) => b.proId === v.uid && inRange(b.date, range)).sort((a, b) => (b.at ?? 0) - (a.at ?? 0)), [view, v.uid, range]);

  const exportInvoices = () => downloadCsv(`hulul-facturas-${v.name.replace(/\s+/g, '-')}-${range.from}_${range.to}.csv`, toCsv(p.invoices.map((i) => ({
    fecha: i.date, reserva: i.code, servicio: catName(i.category), cliente: i.clientName, base: i.base, iva: i.iva, total: i.total, comision_hulul: i.commission, iva_comision: i.commissionIva, estado: i.reversed ? 'anulada' : 'por emitir',
  })), ['fecha', 'reserva', 'servicio', 'cliente', 'base', 'iva', 'total', 'comision_hulul', 'iva_comision', 'estado'].map((k) => ({ key: k, label: k.replace(/_/g, ' ') }))));

  return (
    <>
      <button type="button" className="adm-back" onClick={onBack}>← Proveedores</button>
      <div className="adm-card adm-head-card">
        <div className="adm-avatar">{initials(v.name)}</div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>{v.name || '—'}</h1>
          <div className="muted" style={{ fontSize: 13.5 }}>
            {v.kind === 'empresa' ? 'Empresa' : 'Profesional independiente'} · RUC {v.ruc || '—'} · {regime(v.taxRegime)} · {v.eSignature ? 'con firma electrónica' : 'sin firma electrónica'}
          </div>
          <div className="muted" style={{ fontSize: 13 }}>{[v.phone, v.email].filter(Boolean).join(' · ')}{v.acceptsCash ? ' · acepta efectivo' : ''}</div>
        </div>
        <div className="flags" style={{ alignSelf: 'flex-start' }}>
          <Badge tone={st[1]}>{st[0]}</Badge>
          {v.suspendedUntil && <Badge tone="t-bad">Suspendido hasta {fmtWhen(v.suspendedUntil)}</Badge>}
          {v.tester && <Badge tone="t-mute">Prueba</Badge>}
        </div>
        <Link className="adm-btn" href={`/admin/profesionales`}>Ver registro y documentos</Link>
      </div>
      {v.suspendedReason && v.suspendedUntil && <div className="adm-err">Suspensión: {v.suspendedReason}</div>}

      <div className="adm-kpis">
        <Kpi accent label="Facturado al cliente" value={money(p.billed.total)} hint={`Base ${money(p.billed.base)} · IVA ${money(p.billed.iva)}`} />
        <Kpi label="Comisión de HULUL" value={money(p.commission)} hint={p.fines ? `Multas ${money(p.fines)}` : 'Sin multas'} />
        <Kpi label="Pagado en el periodo" value={money(p.paid)} hint={p.toPay ? `Por transferir ${money(p.toPay)}` : 'Nada por transferir'} />
        <Kpi label="Saldo sin liquidar" value={money(p.pending)} hint={v.cashDebt ? `Deuda de efectivo ${money(v.cashDebt)}` : 'Se liquida el lunes'} />
        <Kpi label="Trabajos" value={p.done} hint={`${p.success} con éxito · ${p.scheduled} programados`} />
        <Kpi label="Calificación" value={v.rating ? `★ ${v.rating.toFixed(2).replace('.', ',')}` : '—'} hint={`${v.reviewCount} reseñas · ${v.strikes30}/3 faltas en 30 días`} />
      </div>

      <div className="adm-tabs" role="tablist">
        <button type="button" role="tab" className="adm-tab" aria-selected={tab === 'facturas'} onClick={() => setTab('facturas')}>Facturas ({p.invoices.length})</button>
        <button type="button" role="tab" className="adm-tab" aria-selected={tab === 'pagos'} onClick={() => setTab('pagos')}>Liquidaciones ({p.payouts.length})</button>
        <button type="button" role="tab" className="adm-tab" aria-selected={tab === 'actividad'} onClick={() => setTab('actividad')}>Actividad ({recent.length})</button>
      </div>

      {tab === 'facturas' && (
        <>
          <div className="adm-bar" style={{ justifyContent: 'space-between' }}>
            <span className="muted" style={{ fontSize: 13 }}>El profesional factura la visita al cliente; HULUL le factura la comisión cada semana.</span>
            <button type="button" className="adm-btn" onClick={exportInvoices} disabled={!p.invoices.length}>Exportar CSV</button>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Fecha</th><th>Reserva</th><th>Servicio</th><th>Cliente</th><th className="num">Base</th><th className="num">IVA</th><th className="num">Total</th><th className="num">Comisión HULUL</th><th>Estado</th></tr></thead>
              <tbody>
                {p.invoices.length ? p.invoices.map((i) => (
                  <tr key={i.bookingId} style={i.reversed ? { opacity: .55 } : undefined}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDay(i.date)}</td><td>{i.code}</td><td>{catName(i.category)}</td><td>{i.clientName}</td>
                    <td className="num">{money(i.base)}</td><td className="num">{money(i.iva)}</td><td className="num"><b>{money(i.total)}</b></td><td className="num">{money(i.commission + i.commissionIva)}</td>
                    <td>{i.reversed ? <Badge tone="t-mute">Anulada</Badge> : <Badge tone="t-warn">Por emitir</Badge>}</td>
                  </tr>
                )) : <tr><td colSpan={9} className="adm-empty">Sin facturas en el periodo.</td></tr>}
              </tbody>
              {p.invoices.length > 0 && <tfoot><tr><td colSpan={4}>Total</td><td className="num">{money(p.billed.base)}</td><td className="num">{money(p.billed.iva)}</td><td className="num">{money(p.billed.total)}</td><td className="num">{money(p.invoices.reduce((t, i) => t + i.commission + i.commissionIva, 0))}</td><td /></tr></tfoot>}
            </table>
          </div>
          <div className="adm-note">«Por emitir»: la facturación electrónica con la firma del profesional aún no está conectada. Estos son los comprobantes que corresponden a cada visita.</div>
        </>
      )}

      {tab === 'pagos' && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Semana</th><th>Estado</th><th className="num">Bruto</th><th className="num">Descuentos</th><th className="num">Neto</th><th>Cuenta</th></tr></thead>
            <tbody>
              {p.payouts.length ? p.payouts.map((x) => (
                <tr key={x.id}>
                  <td>{fmtWeek(x.week)}</td>
                  <td><Badge tone={x.status === 'pagado' ? 't-ok' : 't-warn'}>{x.status === 'pagado' ? 'Pagado' : 'Por pagar'}</Badge>{x.paidAt && <div className="muted" style={{ fontSize: 12 }}>{fmtWhen(x.paidAt)}</div>}</td>
                  <td className="num">{money(x.gross)}</td><td className="num">{money(x.deductions)}</td><td className="num"><b>{money(x.net)}</b></td><td style={{ fontSize: 13 }}>{x.bank || '—'}</td>
                </tr>
              )) : <tr><td colSpan={6} className="adm-empty">Aún no tiene liquidaciones.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'actividad' && (
        <>
          <div className="adm-grid g-2">
            <section className="adm-card">
              <h2>Lo que hace</h2>
              <p className="sub">Trabajos completados por categoría en el periodo.</p>
              <HBars items={Object.entries(p.categoriesDone).sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ label: catName(c), value: n, display: n }))} />
              <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0' }}>Registrado en: {v.categories.map((c) => `${catName(c)}${v.catStatus[c] && v.catStatus[c] !== 'aprobado' ? ` (${v.catStatus[c]})` : ''}`).join(', ') || '—'}</p>
            </section>
            <section className="adm-card">
              <h2>Desempeño</h2>
              <dl className="adm-kv">
                <dt>Completados</dt><dd>{p.done}</dd>
                <dt>Con éxito</dt><dd>{p.success}</dd>
                <dt>Llegó atrasado</dt><dd style={{ color: p.late ? 'var(--warn)' : undefined }}>{p.late}</dd>
                <dt>Mal servicio</dt><dd style={{ color: p.bad ? 'var(--bad)' : undefined }}>{p.bad}</dd>
                <dt>No llegó o canceló</dt><dd style={{ color: p.cancelledByPro ? 'var(--bad)' : undefined }}>{p.cancelledByPro}</dd>
                <dt>Reclamos</dt><dd>{p.claims}</dd>
                <dt>Último trabajo</dt><dd>{p.lastJob ? fmtDay(p.lastJob) : '—'}</dd>
                <dt>Próximo trabajo</dt><dd>{p.nextJob ? fmtDay(p.nextJob) : '—'}</dd>
              </dl>
            </section>
          </div>
          {recent.length ? <div className="adm-cards">{recent.map((b) => <BookingCard key={b.id} b={b} onOpen={setOpen} showStage />)}</div> : <div className="adm-card adm-empty">Sin reservas en el periodo.</div>}
        </>
      )}
      {open && <BookingDetail b={open} onClose={() => setOpen(null)} />}
    </>
  );
}
