'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { accounting, BUCKET_LABEL, ecDate, KIND_LABEL, msInRange, toCsv, type DashPayout } from '@hulul/shared/dashboard';
import { useAdmin } from '../AdminShell';
import { Badge, downloadCsv, fmtWeek, fmtWhen, HBars, Kpi, Loading, money, PageHead, PeriodBar, WeekBars } from '../ui';

type Tab = 'resumen' | 'liquidaciones' | 'movimientos';
const PAYOUT_TONE: Record<string, string> = { por_pagar: 't-warn', pagado: 't-ok' };

export function AccountingPanel() {
  const { view, range, now, reload } = useAdmin();
  const [tab, setTab] = useState<Tab>('resumen');
  const [bucket, setBucket] = useState('');
  const [payStatus, setPayStatus] = useState<'por_pagar' | 'pagado' | 'todas'>('por_pagar');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const acc = useMemo(() => (view ? accounting(view, range, now) : null), [view, range, now]);
  const proName = useMemo(() => new Map((view?.providers ?? []).map((p) => [p.uid, p.name])), [view]);
  const bookingCode = useMemo(() => new Map((view?.bookings ?? []).map((b) => [b.id, b.code])), [view]);

  const moves = useMemo(() => (view?.ledger ?? []).filter((e) => msInRange(e.createdAt, range) && (!bucket || e.bucket === bucket)
    && (!q || `${proName.get(e.proId) ?? ''} ${bookingCode.get(e.bookingId ?? '') ?? ''} ${e.bookingId ?? ''}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)), [view, range, bucket, q, proName, bookingCode]);

  const payouts = useMemo(() => (view?.payouts ?? []).filter((p) => payStatus === 'todas' || p.status === payStatus)
    .filter((p) => p.status === 'por_pagar' || payStatus === 'por_pagar' || (p.week >= range.from && p.week <= range.to))
    .sort((a, b) => b.week.localeCompare(a.week)), [view, payStatus, range]);

  const markPaid = async (p: DashPayout) => {
    const ref = window.prompt(`Liquidación de ${proName.get(p.proId) ?? 'el profesional'} por ${money(p.net)}.\nEscribe el número o la referencia de la transferencia:`);
    if (!ref) return;
    setBusy(p.id); setMsg('');
    try {
      const { adminMarkPayoutPaid } = await import('@hulul/shared/firebase');
      await adminMarkPayoutPaid(p.id, ref);
      setMsg(`Liquidación marcada como pagada (${ref}).`);
      reload();
    } catch (e) {
      setMsg((e as { message?: string }).message || 'No se pudo marcar.');
    } finally { setBusy(''); }
  };

  const exportMoves = () => downloadCsv(`hulul-movimientos-${range.from}_${range.to}.csv`, toCsv(moves.map((e) => ({
    fecha: e.createdAt ? ecDate(e.createdAt) : '', reserva: bookingCode.get(e.bookingId ?? '') ?? e.bookingId ?? '', profesional: proName.get(e.proId) ?? e.proId,
    concepto: KIND_LABEL[e.kind] ?? e.kind, bolsa: BUCKET_LABEL[e.bucket] ?? e.bucket, base: e.base ?? '', iva: e.iva ?? '', monto: e.amount, efecto_profesional: e.proDelta,
    pago: e.paymentMethod, liquidacion: e.payoutId ?? 'pendiente', reverso: e.reverses ? 'sí' : '',
  })), ['fecha', 'reserva', 'profesional', 'concepto', 'bolsa', 'base', 'iva', 'monto', 'efecto_profesional', 'pago', 'liquidacion', 'reverso'].map((k) => ({ key: k, label: k.replace(/_/g, ' ') }))));

  const exportPayouts = () => downloadCsv('hulul-liquidaciones.csv', toCsv(payouts.map((p) => ({
    semana: p.week, profesional: proName.get(p.proId) ?? p.proId, estado: p.status, bruto: p.gross, descuentos: p.deductions, retencion_renta: p.retentions.renta,
    retencion_iva: p.retentions.iva, neto: p.net, cuenta: p.bank, pagado: p.paidAt ? fmtWhen(p.paidAt) : '',
  })), ['semana', 'profesional', 'estado', 'bruto', 'descuentos', 'retencion_renta', 'retencion_iva', 'neto', 'cuenta', 'pagado'].map((k) => ({ key: k, label: k.replace(/_/g, ' ') }))));

  return (
    <>
      <PageHead title="Contabilidad" lead="El dinero de cada reserva antes, durante y después: lo que viene, lo retenido y lo liquidado." />
      <PeriodBar />
      {!acc ? <Loading /> : (
        <>
          <div className="adm-flow">
            <section className="adm-card" style={{ ['--c' as string]: '#1F4E79' }}>
              <span className="step">Antes · por cobrar</span>
              <dl className="adm-kv">
                <dt>Reservas programadas o en curso</dt><dd className="big">{acc.before.count}</dd>
                <dt>Venta esperada</dt><dd>{money(acc.before.gross)}</dd>
                <dt>Ingreso HULUL esperado</dt><dd>{money(acc.before.hulul)}</dd>
                <dt>Para profesionales</dt><dd>{money(acc.before.pro)}</dd>
              </dl>
              <small className="muted">Del periodo elegido. Se cobra al terminar la visita.</small>
            </section>
            <section className="adm-card" style={{ ['--c' as string]: '#C98A1B' }}>
              <span className="step">Durante · retenido hoy</span>
              <dl className="adm-kv">
                <dt>En las 48 h de reclamos</dt><dd className="big">{money(acc.during.held)}</dd>
                <dt>Detenido por reclamo</dt><dd>{money(acc.during.disputed)}</dd>
                <dt>Listo para la liquidación del lunes</dt><dd>{money(acc.during.available)}</dd>
                <dt>Deuda de profesionales (efectivo, multas)</dt><dd style={{ color: acc.during.owedByPros ? 'var(--bad)' : undefined }}>{money(acc.during.owedByPros)}</dd>
              </dl>
              <small className="muted">{acc.during.entries} movimientos sin liquidar.</small>
            </section>
            <section className="adm-card" style={{ ['--c' as string]: '#206344' }}>
              <span className="step">Después · liquidado</span>
              <dl className="adm-kv">
                <dt>Por transferir ({acc.after.toPayCount})</dt><dd className="big" style={{ color: acc.after.toPay ? 'var(--warn)' : undefined }}>{money(acc.after.toPay)}</dd>
                <dt>Pagado en el periodo ({acc.after.paidCount})</dt><dd>{money(acc.after.paid)}</dd>
              </dl>
              {acc.after.toPayCount > 0 && <button type="button" className="adm-btn" onClick={() => { setTab('liquidaciones'); setPayStatus('por_pagar'); }}>Ver lo que hay que pagar</button>}
            </section>
          </div>

          <div className="adm-tabs" role="tablist">
            {(['resumen', 'liquidaciones', 'movimientos'] as Tab[]).map((t) => (
              <button key={t} type="button" role="tab" className="adm-tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                {{ resumen: 'Estado de resultados', liquidaciones: 'Liquidaciones semanales', movimientos: `Libro de movimientos (${moves.length})` }[t]}
              </button>
            ))}
          </div>
          {msg && <div className="adm-note" role="status">{msg}</div>}

          {tab === 'resumen' && (
            <>
              <div className="adm-kpis">
                <Kpi accent label="Ingreso de HULUL" value={money(acc.incomeTotal)} hint="Lo único que HULUL declara como venta" />
                <Kpi label="IVA por pagar" value={money(acc.vatDue)} hint="De las facturas de HULUL" />
                <Kpi label="Recaudo con tarjeta" value={money(acc.collected)} hint="Para cuadrar con la pasarela" />
                <Kpi label="Dinero de terceros" value={money(acc.thirdParty)} hint="Facturas de los profesionales" />
                <Kpi label="Créditos a clientes" value={money(acc.clientCredits)} hint="Pasivo por faltas del profesional" />
              </div>
              <div className="adm-grid g-2">
                <section className="adm-card">
                  <h2>Ingreso de HULUL por concepto</h2>
                  <p className="sub">Movimientos registrados en el periodo.</p>
                  <HBars items={acc.income.map((i) => ({ label: i.label, value: i.amount, display: money(i.amount) }))} />
                </section>
                <section className="adm-card">
                  <h2>Por semana</h2>
                  <p className="sub">Ingreso de HULUL registrado cada semana.</p>
                  <WeekBars weeks={acc.byWeek.map((w) => ({ week: w.week, parts: [{ value: w.income, color: '#123F43', label: 'Ingreso HULUL' }] }))} legend={[{ label: 'Ingreso HULUL', color: '#123F43' }]} format={money} />
                </section>
              </div>
              <section className="adm-card">
                <h2>Saldos por bolsa</h2>
                <p className="sub">Cómo se separa el dinero (modelo de mercado en línea): solo «Ingreso de HULUL» es venta propia.</p>
                <div className="adm-table-wrap" style={{ border: 'none' }}>
                  <table className="adm-table">
                    <thead><tr><th>Bolsa</th><th className="num">Monto del periodo</th></tr></thead>
                    <tbody>{acc.buckets.map((b) => <tr key={b.bucket}><td>{b.label}</td><td className="num">{money(b.amount)}</td></tr>)}</tbody>
                  </table>
                </div>
              </section>
              <div className="adm-note">Las retenciones están en 0 hasta que el contador defina los porcentajes. Las facturas electrónicas aún no se emiten desde HULUL: los montos son los que corresponde facturar.</div>
            </>
          )}

          {tab === 'liquidaciones' && (
            <>
              <div className="adm-bar">
                {(['por_pagar', 'pagado', 'todas'] as const).map((s) => <button key={s} type="button" className="adm-chip" aria-pressed={payStatus === s} onClick={() => setPayStatus(s)}>{{ por_pagar: 'Por pagar', pagado: 'Pagadas', todas: 'Todas' }[s]}</button>)}
                <button type="button" className="adm-btn" onClick={exportPayouts} disabled={!payouts.length}>Exportar CSV</button>
              </div>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr><th>Semana</th><th>Profesional</th><th>Estado</th><th className="num">Bruto</th><th className="num">Descuentos</th><th className="num">Retenciones</th><th className="num">Neto</th><th>Cuenta</th><th /></tr></thead>
                  <tbody>
                    {payouts.length ? payouts.map((p) => (
                      <tr key={p.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtWeek(p.week)}</td>
                        <td><Link href={`/admin/proveedores?id=${p.proId}`}>{proName.get(p.proId) ?? p.proId}</Link></td>
                        <td><Badge tone={PAYOUT_TONE[p.status] ?? 't-mute'}>{p.status === 'por_pagar' ? 'Por pagar' : p.status === 'pagado' ? 'Pagado' : p.status}</Badge>{p.paidAt && <div className="muted" style={{ fontSize: 12 }}>{fmtWhen(p.paidAt)}</div>}</td>
                        <td className="num">{money(p.gross)}</td><td className="num">{money(p.deductions)}</td><td className="num">{money(p.retentions.renta + p.retentions.iva)}</td>
                        <td className="num"><b>{money(p.net)}</b></td>
                        <td style={{ fontSize: 13 }}>{p.bank || <span style={{ color: 'var(--bad)' }}>Sin cuenta</span>}</td>
                        <td>{p.status === 'por_pagar' && <button type="button" className="adm-btn solid" disabled={busy === p.id} onClick={() => markPaid(p)}>{busy === p.id ? 'Guardando…' : 'Marcar pagada'}</button>}</td>
                      </tr>
                    )) : <tr><td colSpan={9} className="adm-empty">No hay liquidaciones en esta vista.</td></tr>}
                  </tbody>
                  {payouts.length > 0 && <tfoot><tr><td colSpan={6}>{payouts.length} liquidaciones</td><td className="num">{money(payouts.reduce((t, p) => t + p.net, 0))}</td><td colSpan={2} /></tr></tfoot>}
                </table>
              </div>
              <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Cada lunes a las 06:00 se arma la liquidación de lo que ya pasó las 48 h y no tiene reclamo. Transfiere desde la cuenta de la empresa y márcala aquí con la referencia.</p>
            </>
          )}

          {tab === 'movimientos' && (
            <>
              <div className="adm-bar">
                <input className="adm-input adm-search" type="search" placeholder="Buscar profesional o código de reserva" value={q} onChange={(e) => setQ(e.target.value)} />
                <select className="adm-select" value={bucket} onChange={(e) => setBucket(e.target.value)} aria-label="Bolsa">
                  <option value="">Todas las bolsas</option>
                  {Object.entries(BUCKET_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button type="button" className="adm-btn" onClick={exportMoves} disabled={!moves.length}>Exportar CSV</button>
              </div>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr><th>Fecha</th><th>Reserva</th><th>Profesional</th><th>Concepto</th><th>Bolsa</th><th className="num">Monto</th><th className="num">Al profesional</th><th>Estado</th></tr></thead>
                  <tbody>
                    {moves.length ? moves.slice(0, 800).map((e) => (
                      <tr key={e.id} style={e.reverses || e.reversedBy ? { opacity: .6 } : undefined}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtWhen(e.createdAt)}</td>
                        <td>{bookingCode.get(e.bookingId ?? '') ?? (e.bookingId ? e.bookingId.slice(-6).toUpperCase() : '—')}</td>
                        <td>{proName.get(e.proId) ?? '—'}</td>
                        <td>{KIND_LABEL[e.kind] ?? e.kind}{e.reverses && <Badge tone="t-mute">reverso</Badge>}</td>
                        <td style={{ fontSize: 12.5 }}>{BUCKET_LABEL[e.bucket] ?? e.bucket}</td>
                        <td className="num">{money(e.amount)}</td>
                        <td className="num" style={{ color: e.proDelta < 0 ? 'var(--bad)' : e.proDelta > 0 ? 'var(--ok)' : 'var(--muted)' }}>{e.proDelta ? money(e.proDelta) : '—'}</td>
                        <td>{e.payoutId ? <Badge tone="t-ok">Liquidado</Badge> : (e.availableAt ?? 0) > now ? <Badge tone="t-warn">Retenido</Badge> : <Badge tone="t-info">Pendiente</Badge>}</td>
                      </tr>
                    )) : <tr><td colSpan={8} className="adm-empty">Sin movimientos en el periodo.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
