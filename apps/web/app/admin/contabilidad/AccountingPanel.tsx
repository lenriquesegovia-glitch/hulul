'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { accounting, BUCKET_LABEL, ecDate, hululSales, inRange, journal, ledgerByAccount, SUPERCIAS_ACCOUNTS, KIND_LABEL, mondayOf, msInRange, stageOf, toCsv, type DashPayout } from '@hulul/shared/dashboard';
import { useAdmin } from '../AdminShell';
import { Badge, BookingListDrawer, downloadCsv, downloadText, fmtWeek, fmtWhen, HBars, Kpi, Loading, money, PageHead, PeriodBar, WeekBars } from '../ui';

type Tab = 'resumen' | 'pagar' | 'cobrar' | 'liquidaciones' | 'movimientos';
const TABS: Tab[] = ['resumen', 'pagar', 'cobrar', 'liquidaciones', 'movimientos'];
const PAYOUT_TONE: Record<string, string> = { por_pagar: 't-warn', pagado: 't-ok' };

export function AccountingPanel() {
  const { view, range, now, reload, can } = useAdmin();
  const [tab, setTab] = useState<Tab>('resumen');
  const [bucket, setBucket] = useState('');
  const [payStatus, setPayStatus] = useState<'por_pagar' | 'pagado' | 'todas'>('por_pagar');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [drill, setDrill] = useState<{ title: string; ids: string[] } | null>(null);

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('vista') as Tab | null;
    if (v && TABS.includes(v)) setTab(v);
  }, []);

  const acc = useMemo(() => (view ? accounting(view, range, now) : null), [view, range, now]);
  const proName = useMemo(() => new Map((view?.providers ?? []).map((p) => [p.uid, p.name])), [view]);
  const bookingCode = useMemo(() => new Map((view?.bookings ?? []).map((b) => [b.id, b.code])), [view]);

  const moves = useMemo(() => (view?.ledger ?? []).filter((e) => msInRange(e.createdAt, range) && (!bucket || e.bucket === bucket)
    && (!q || `${proName.get(e.proId) ?? ''} ${bookingCode.get(e.bookingId ?? '') ?? ''} ${e.bookingId ?? ''}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)), [view, range, bucket, q, proName, bookingCode]);

  const payouts = useMemo(() => (view?.payouts ?? []).filter((p) => payStatus === 'todas' || p.status === payStatus)
    .filter((p) => p.status === 'por_pagar' || payStatus === 'por_pagar' || (p.week >= range.from && p.week <= range.to))
    .sort((a, b) => b.week.localeCompare(a.week)), [view, payStatus, range]);

  // Por profesional: lo que HULUL le debe (sin liquidar) o lo que él debe a HULUL.
  const perPro = useMemo(() => {
    const nextMonday = Date.parse(`${mondayOf(ecDate(now))}T11:00:00Z`) + 7 * 86_400_000;
    const disputed = new Set((view?.bookings ?? []).filter((b) => b.status === 'en_disputa').map((b) => b.id));
    const m = new Map<string, { ready: number; later: number; held: number; total: number; entries: number }>();
    for (const e of view?.ledger ?? []) {
      if (e.payoutId || !e.proDelta) continue;
      const r = m.get(e.proId) ?? { ready: 0, later: 0, held: 0, total: 0, entries: 0 };
      r.entries += 1; r.total = Math.round((r.total + e.proDelta) * 100) / 100;
      if (e.bookingId && disputed.has(e.bookingId)) r.held = Math.round((r.held + e.proDelta) * 100) / 100;
      else if ((e.availableAt ?? 0) <= nextMonday) r.ready = Math.round((r.ready + e.proDelta) * 100) / 100;
      else r.later = Math.round((r.later + e.proDelta) * 100) / 100;
      m.set(e.proId, r);
    }
    return [...m.entries()].map(([proId, r]) => ({ proId, name: proName.get(proId) ?? proId, ...r }));
  }, [view, now, proName]);
  const owed = perPro.filter((p) => p.total > 0).sort((a, b) => b.total - a.total);
  const debtors = perPro.filter((p) => p.total < 0).sort((a, b) => a.total - b.total);
  const batches = useMemo(() => {
    const m = new Map<string, DashPayout[]>();
    for (const p of view?.payouts ?? []) if (p.status === 'por_pagar') m.set(p.week, [...(m.get(p.week) ?? []), p]);
    return [...m.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [view]);
  const beforeIds = useMemo(() => (view?.bookings ?? []).filter((b) => inRange(b.date, range) && !b.demo && ['programada', 'ejecucion'].includes(stageOf(b))).map((b) => b.id), [view, range]);

  const downloadBatch = async (week: string) => {
    setBusy(week); setMsg('');
    try {
      const { adminBankFile } = await import('@hulul/shared/firebase');
      const f = await adminBankFile(week);
      downloadText(f.fileName, f.content, f.mime);
      setMsg(`Archivo listo: ${f.count} pagos por ${money(f.total)}. Súbelo en la banca web (Cash Management → Plataforma de Pagos → Carga Transmisión → Ingreso Archivo).${f.skipped.length ? ` Quedaron fuera ${f.skipped.length}: ${f.skipped.map((x) => `${x.name || 'profesional'} (${x.reason})`).join(', ')}.` : ''}`);
    } catch (e) {
      setMsg((e as { message?: string }).message || 'No se pudo generar el archivo.');
    } finally { setBusy(''); }
  };

  const payBatch = async (week: string, list: DashPayout[]) => {
    const total = list.filter((p) => p.bank).reduce((t, p) => t + p.net, 0);
    const ref = window.prompt(`Lote de la semana del ${fmtWeek(week)}: ${list.filter((p) => p.bank).length} pagos por ${money(total)}.\nDespués de cargarlo en el banco, escribe el número de orden que te dio:`);
    if (!ref) return;
    setBusy(week); setMsg('');
    try {
      const { adminMarkBatchPaid } = await import('@hulul/shared/firebase');
      const n = await adminMarkBatchPaid(week, ref);
      setMsg(`Listo: ${n} liquidaciones marcadas como pagadas (orden ${ref}). A cada profesional le aparece como pagado.`);
      reload();
    } catch (e) {
      setMsg((e as { message?: string }).message || 'No se pudo marcar el lote.');
    } finally { setBusy(''); }
  };

  const [exporting, setExporting] = useState('');
  const period = `${range.from} al ${range.to}`;
  const HEAD = ['CORPORACIÓN COFFEEPORT CÍA. LTDA. — HULUL', `Periodo: ${period}`];

  /** Paquete para la contadora: diario, mayor, ventas, terceros, liquidaciones y plan de cuentas. */
  const exportPackage = async () => {
    if (!view) return;
    setExporting('paquete');
    try {
      const { downloadXlsx } = await import('../excel');
      const lines = journal(view, range);
      const mayor = ledgerByAccount(lines);
      const sales = hululSales(view, range);
      const proRuc = new Map(view.providers.map((p) => [p.uid, p.ruc]));
      const thirdParty = view.ledger.filter((e) => msInRange(e.createdAt, range) && (e.kind === 'visita' || e.kind === 'adicional'))
        .map((e) => ({ fecha: ecDate(e.createdAt!), reserva: bookingCode.get(e.bookingId ?? '') ?? '', profesional: proName.get(e.proId) ?? e.proId, ruc: proRuc.get(e.proId) ?? '', concepto: KIND_LABEL[e.kind] ?? e.kind, base: e.base ?? 0, iva: e.iva ?? 0, total: e.amount, cobro: e.paymentMethod === 'efectivo' ? 'Efectivo (lo cobró el profesional)' : 'Tarjeta (recaudado por HULUL)' }));
      const liq = view.payouts.filter((p) => inRange(p.week, range) || p.status === 'por_pagar').map((p) => ({ semana: p.week, profesional: proName.get(p.proId) ?? p.proId, ruc: proRuc.get(p.proId) ?? '', estado: p.status === 'pagado' ? 'Pagado' : 'Por pagar', bruto: p.gross, descuentos: p.deductions, ret_renta: p.retentions.renta, ret_iva: p.retentions.iva, neto: p.net, cuenta: p.bank, pagado: p.paidAt ? ecDate(p.paidAt) : '' }));
      await downloadXlsx(`hulul-contabilidad-${range.from}_${range.to}.xlsx`, [
        { name: 'Libro diario', title: [...HEAD, 'Libro diario (NIIF para PYMES) con códigos del plan de cuentas de la Superintendencia de Compañías. Propuesta: validar con la contadora.'],
          columns: [{ key: 'date', header: 'Fecha', width: 12 }, { key: 'entry', header: 'Asiento / reserva', width: 16 }, { key: 'code', header: 'Código', width: 10, text: true }, { key: 'accountName', header: 'Cuenta', width: 46 }, { key: 'party', header: 'Auxiliar (cliente o profesional)', width: 28 }, { key: 'detail', header: 'Detalle', width: 34 }, { key: 'debit', header: 'Debe', money: true, width: 12 }, { key: 'credit', header: 'Haber', money: true, width: 12 }],
          rows: lines as unknown as Record<string, string | number>[], totals: ['debit', 'credit'] },
        { name: 'Mayor por cuenta', title: [...HEAD, 'Saldo = Debe − Haber. La cuenta 2010301 con saldo deudor corresponde a profesionales que deben a HULUL (reclasificar a 1010208 al cierre).'],
          columns: [{ key: 'code', header: 'Código', text: true }, { key: 'name', header: 'Cuenta', width: 50 }, { key: 'aux', header: 'Uso en HULUL', width: 44 }, { key: 'debit', header: 'Debe', money: true }, { key: 'credit', header: 'Haber', money: true }, { key: 'balance', header: 'Saldo', money: true }],
          rows: mayor, totals: ['debit', 'credit'] },
        { name: 'Ventas HULUL (SRI)', title: [...HEAD, 'Comprobantes que emite HULUL: cargo de plataforma al cliente y comisión al profesional. Sin cédula del cliente se usa consumidor final.'],
          columns: [{ key: 'date', header: 'Fecha', width: 12 }, { key: 'to', header: 'A quién', width: 12 }, { key: 'idType', header: 'Tipo de identificación', width: 18 }, { key: 'id', header: 'Identificación', width: 16, text: true }, { key: 'name', header: 'Razón social / nombre', width: 30 }, { key: 'concept', header: 'Concepto', width: 34 }, { key: 'base', header: 'Base IVA 15 %', money: true }, { key: 'iva', header: 'IVA', money: true }, { key: 'total', header: 'Total', money: true }],
          rows: sales, totals: ['base', 'iva', 'total'] },
        { name: 'Terceros (no es ingreso)', title: [...HEAD, 'Facturas de los profesionales a los clientes. Valores por cuenta de terceros: no son ingreso de HULUL.'],
          columns: [{ key: 'fecha', header: 'Fecha' }, { key: 'reserva', header: 'Reserva' }, { key: 'profesional', header: 'Profesional', width: 28 }, { key: 'ruc', header: 'RUC', text: true, width: 16 }, { key: 'concepto', header: 'Concepto', width: 30 }, { key: 'base', header: 'Base', money: true }, { key: 'iva', header: 'IVA', money: true }, { key: 'total', header: 'Total', money: true }, { key: 'cobro', header: 'Cómo se cobró', width: 32 }],
          rows: thirdParty, totals: ['base', 'iva', 'total'] },
        { name: 'Liquidaciones', title: [...HEAD, 'Pagos semanales a profesionales.'],
          columns: [{ key: 'semana', header: 'Semana' }, { key: 'profesional', header: 'Profesional', width: 28 }, { key: 'ruc', header: 'RUC', text: true, width: 16 }, { key: 'estado', header: 'Estado' }, { key: 'bruto', header: 'Bruto', money: true }, { key: 'descuentos', header: 'Descuentos', money: true }, { key: 'ret_renta', header: 'Ret. renta', money: true }, { key: 'ret_iva', header: 'Ret. IVA', money: true }, { key: 'neto', header: 'Neto', money: true }, { key: 'cuenta', header: 'Cuenta', width: 26 }, { key: 'pagado', header: 'Fecha de pago' }],
          rows: liq, totals: ['bruto', 'descuentos', 'ret_renta', 'ret_iva', 'neto'] },
        { name: 'Plan de cuentas', title: [...HEAD, 'Cuentas de la Superintendencia de Compañías que usa HULUL (propuesta para validar).'],
          columns: [{ key: 'code', header: 'Código', text: true }, { key: 'name', header: 'Cuenta', width: 56 }, { key: 'aux', header: 'Uso en HULUL', width: 50 }],
          rows: Object.values(SUPERCIAS_ACCOUNTS).map((a) => ({ ...a })) },
      ]);
    } finally { setExporting(''); }
  };

  /** Solo las ventas de HULUL, para declarar IVA (formulario 104) y armar el ATS. */
  const exportSri = async () => {
    if (!view) return;
    setExporting('sri');
    try {
      const { downloadXlsx } = await import('../excel');
      const sales = hululSales(view, range);
      await downloadXlsx(`hulul-ventas-sri-${range.from}_${range.to}.xlsx`, [{
        name: 'Ventas', title: [...HEAD, 'Ventas propias de HULUL con IVA 15 %. Los valores de terceros (visitas de los profesionales) no se incluyen.'],
        columns: [{ key: 'date', header: 'Fecha', width: 12 }, { key: 'idType', header: 'Tipo de identificación', width: 18 }, { key: 'id', header: 'Identificación', width: 16, text: true }, { key: 'name', header: 'Razón social / nombre', width: 30 }, { key: 'concept', header: 'Concepto', width: 34 }, { key: 'base', header: 'Base IVA 15 %', money: true }, { key: 'iva', header: 'IVA', money: true }, { key: 'total', header: 'Total', money: true }],
        rows: sales, totals: ['base', 'iva', 'total'],
      }]);
    } finally { setExporting(''); }
  };

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
      <PageHead title="Contabilidad" lead="El dinero de cada reserva antes, durante y después: lo que viene, lo retenido y lo liquidado.">
        <button type="button" className="adm-btn solid" disabled={!view || !!exporting} onClick={exportPackage}>{exporting === 'paquete' ? 'Armando…' : 'Excel para la contadora (NIIF)'}</button>
        <button type="button" className="adm-btn" disabled={!view || !!exporting} onClick={exportSri}>{exporting === 'sri' ? 'Armando…' : 'Ventas para el SRI'}</button>
      </PageHead>
      <PeriodBar />
      {!acc ? <Loading /> : (
        <>
          <div className="adm-flow">
            <section className="adm-card adm-clickrow" role="button" tabIndex={0} title="Ver las reservas" onClick={() => setDrill({ title: 'Antes: reservas por cobrar', ids: beforeIds })} style={{ ['--c' as string]: '#1F4E79' }}>
              <span className="step">Antes · por cobrar</span>
              <dl className="adm-kv">
                <dt>Reservas programadas o en curso</dt><dd className="big">{acc.before.count}</dd>
                <dt>Venta esperada</dt><dd>{money(acc.before.gross)}</dd>
                <dt>Ingreso HULUL esperado</dt><dd>{money(acc.before.hulul)}</dd>
                <dt>Para profesionales</dt><dd>{money(acc.before.pro)}</dd>
              </dl>
              <small className="muted">Del periodo elegido. Se cobra al terminar la visita. Toca para ver la lista.</small>
            </section>
            <section className="adm-card adm-clickrow" role="button" tabIndex={0} title="Ver por profesional" onClick={() => setTab('pagar')} style={{ ['--c' as string]: '#C98A1B' }}>
              <span className="step">Durante · retenido hoy</span>
              <dl className="adm-kv">
                <dt>En las 48 h de reclamos</dt><dd className="big">{money(acc.during.held)}</dd>
                <dt>Detenido por reclamo</dt><dd>{money(acc.during.disputed)}</dd>
                <dt>Listo para la liquidación del lunes</dt><dd>{money(acc.during.available)}</dd>
                <dt>Deuda de profesionales (efectivo, multas)</dt><dd style={{ color: acc.during.owedByPros ? 'var(--bad)' : undefined }}>{money(acc.during.owedByPros)}</dd>
              </dl>
              <small className="muted">{acc.during.entries} movimientos sin liquidar. Toca para ver a quién corresponde.</small>
            </section>
            <section className="adm-card adm-clickrow" role="button" tabIndex={0} title="Ver lo que hay que pagar" onClick={() => setTab('pagar')} style={{ ['--c' as string]: '#206344' }}>
              <span className="step">Después · liquidado</span>
              <dl className="adm-kv">
                <dt>Por transferir ({acc.after.toPayCount})</dt><dd className="big" style={{ color: acc.after.toPay ? 'var(--warn)' : undefined }}>{money(acc.after.toPay)}</dd>
                <dt>Pagado en el periodo ({acc.after.paidCount})</dt><dd>{money(acc.after.paid)}</dd>
              </dl>
              <small className="muted">Toca para ver a quién pagar y descargar el archivo del banco.</small>
            </section>
          </div>

          <div className="adm-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t} type="button" role="tab" className="adm-tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                {{ resumen: 'Estado de resultados', pagar: `Por pagar (${money(acc.after.toPay)})`, cobrar: `Por cobrar (${money(acc.during.owedByPros)})`, liquidaciones: 'Historial de liquidaciones', movimientos: `Libro de movimientos (${moves.length})` }[t]}
              </button>
            ))}
          </div>
          {msg && <div className="adm-note" role="status">{msg}</div>}

          {tab === 'pagar' && (
            <>
              <div className="adm-help">
                <b>Cómo se paga, sin digitar nada</b>
                <span>Cada lunes a las 06:00 el sistema arma la liquidación de cada profesional. Aquí descargas el archivo del lote, lo subes en la banca web de Banco del Pacífico y, cuando el banco te da el número de orden, marcas el lote como pagado en un clic.</span>
              </div>
              {batches.length === 0 ? <div className="adm-card adm-empty">No hay liquidaciones por pagar. La próxima se arma el lunes a las 06:00.</div> : batches.map(([week, list]) => {
                const total = list.reduce((t, p) => t + p.net, 0);
                const noBank = list.filter((p) => !p.bank);
                return (
                  <section key={week} className="adm-card">
                    <div className="adm-bar" style={{ justifyContent: 'space-between' }}>
                      <div><h2 style={{ margin: 0 }}>Lote de la semana del {fmtWeek(week)}</h2><p className="sub" style={{ margin: 0 }}>{list.length} profesionales · {money(total)}{noBank.length ? ` · ${noBank.length} sin cuenta` : ''}</p></div>
                      {can('pagos') && (
                        <span className="adm-bar">
                          <button type="button" className="adm-btn" disabled={busy === week} onClick={() => downloadBatch(week)}>{busy === week ? 'Preparando…' : 'Descargar archivo para el banco'}</button>
                          <button type="button" className="adm-btn solid" disabled={busy === week} onClick={() => payBatch(week, list)}>Marcar lote pagado</button>
                        </span>
                      )}
                    </div>
                    <div className="adm-table-wrap" style={{ border: 'none', marginTop: 10 }}>
                      <table className="adm-table">
                        <thead><tr><th>Profesional</th><th>Cuenta</th><th className="num">Bruto</th><th className="num">Descuentos</th><th className="num">A pagar</th><th /></tr></thead>
                        <tbody>
                          {list.sort((a, b) => b.net - a.net).map((p) => (
                            <tr key={p.id}>
                              <td><Link href={`/admin/proveedores?id=${p.proId}`}><b>{proName.get(p.proId) ?? p.proId}</b></Link></td>
                              <td style={{ fontSize: 13 }}>{p.bank || <Badge tone="t-bad">Sin cuenta: no entra en el archivo</Badge>}</td>
                              <td className="num">{money(p.gross)}</td><td className="num">{money(p.deductions)}</td><td className="num"><b>{money(p.net)}</b></td>
                              <td>{can('pagos') && <button type="button" className="adm-btn" disabled={busy === p.id} onClick={() => markPaid(p)}>Pagada aparte</button>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
              <section className="adm-card">
                <h2>Lo que se acumula para los próximos lunes</h2>
                <p className="sub">Dinero de cada profesional aún sin liquidar. «Próximo lunes» ya pasó las 48 h de reclamos o las pasa antes del corte.</p>
                <div className="adm-table-wrap" style={{ border: 'none' }}>
                  <table className="adm-table">
                    <thead><tr><th>Profesional</th><th className="num">Próximo lunes</th><th className="num">Después</th><th className="num">En reclamo</th><th className="num">Total</th></tr></thead>
                    <tbody>
                      {owed.length ? owed.map((p) => (
                        <tr key={p.proId}>
                          <td><Link href={`/admin/proveedores?id=${p.proId}`}>{p.name}</Link></td>
                          <td className="num">{money(p.ready)}</td><td className="num">{money(p.later)}</td><td className="num">{money(p.held)}</td><td className="num"><b>{money(p.total)}</b></td>
                        </tr>
                      )) : <tr><td colSpan={5} className="adm-empty">Nada acumulado.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {tab === 'cobrar' && (
            <>
              <section className="adm-card">
                <h2>Profesionales que le deben a HULUL</h2>
                <p className="sub">Comisión y cargo de plataforma de trabajos cobrados en efectivo, y multas. Se descuenta solo de su próxima liquidación; si no alcanza, queda la deuda.</p>
                <div className="adm-table-wrap" style={{ border: 'none' }}>
                  <table className="adm-table">
                    <thead><tr><th>Profesional</th><th className="num">Movimientos</th><th className="num">Debe</th></tr></thead>
                    <tbody>
                      {debtors.length ? debtors.map((p) => (
                        <tr key={p.proId}><td><Link href={`/admin/proveedores?id=${p.proId}`}>{p.name}</Link></td><td className="num">{p.entries}</td><td className="num" style={{ color: 'var(--bad)' }}><b>{money(-p.total)}</b></td></tr>
                      )) : <tr><td colSpan={3} className="adm-empty">Nadie debe.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="adm-card adm-clickrow" role="button" tabIndex={0} onClick={() => setDrill({ title: 'Reservas por cobrar', ids: beforeIds })}>
                <h2>Reservas por cobrar a clientes</h2>
                <p className="sub" style={{ margin: 0 }}>{acc.before.count} reservas programadas o en curso en el periodo · {money(acc.before.gross)}. Se cobran al terminar la visita. Toca para ver la lista.</p>
              </section>
            </>
          )}

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
                        <td>{p.status === 'por_pagar' && can('pagos') && <button type="button" className="adm-btn solid" disabled={busy === p.id} onClick={() => markPaid(p)}>{busy === p.id ? 'Guardando…' : 'Marcar pagada'}</button>}</td>
                      </tr>
                    )) : <tr><td colSpan={9} className="adm-empty">No hay liquidaciones en esta vista.</td></tr>}
                  </tbody>
                  {payouts.length > 0 && <tfoot><tr><td colSpan={6}>{payouts.length} liquidaciones</td><td className="num">{money(payouts.reduce((t, p) => t + p.net, 0))}</td><td colSpan={2} /></tr></tfoot>}
                </table>
              </div>
              <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Cada lunes a las 06:00 se arma la liquidación de lo que ya pasó las 48 h y no tiene reclamo. {can('pagos') ? 'Transfiere desde la cuenta de la empresa y márcala aquí con la referencia.' : 'Solo lectura para tu rol.'}</p>
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
      {drill && <BookingListDrawer title={drill.title} ids={drill.ids} onClose={() => setDrill(null)} />}
    </>
  );
}
