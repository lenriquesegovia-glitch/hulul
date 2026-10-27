'use client';

import { useMemo, useState } from 'react';
import { ecDate, hululSales, msInRange } from '@hulul/shared/dashboard';
import { useAdmin } from '../AdminShell';
import { fmtDay, Kpi, Loading, money, PageHead, PeriodBar } from '../ui';

/** RUC de la empresa (Corporación Coffeeport Cía. Ltda.); su noveno dígito fija el día de vencimiento. */
const RUC = '0993265160001';
/** Calendario del SRI por noveno dígito del RUC (declaraciones mensuales, p. ej. IVA). */
const DUE_DAY: Record<string, number> = { '1': 10, '2': 12, '3': 14, '4': 16, '5': 18, '6': 20, '7': 22, '8': 24, '9': 26, '0': 28 };

type View = 'ventas' | 'terceros' | 'retenciones';

/**
 * Cumplimiento SRI: lo que HULUL debe declarar (sus ventas propias e IVA), lo que
 * facturan los profesionales (terceros, no se declara como ingreso de HULUL) y las retenciones.
 */
export function SriPanel() {
  const { view, range, now } = useAdmin();
  const [tab, setTab] = useState<View>('ventas');
  const [busy, setBusy] = useState(false);

  const sales = useMemo(() => (view ? hululSales(view, range) : []), [view, range]);
  const third = useMemo(() => (view?.ledger ?? []).filter((e) => msInRange(e.createdAt, range) && (e.kind === 'visita' || e.kind === 'adicional')), [view, range]);
  const rets = useMemo(() => (view?.ledger ?? []).filter((e) => msInRange(e.createdAt, range) && e.kind.startsWith('retencion_')), [view, range]);
  const proName = useMemo(() => new Map((view?.providers ?? []).map((p) => [p.uid, p])), [view]);
  const code = useMemo(() => new Map((view?.bookings ?? []).map((b) => [b.id, b.code])), [view]);

  const base = sales.reduce((t, x) => t + x.base, 0);
  const iva = sales.reduce((t, x) => t + x.iva, 0);
  const thirdTotal = third.reduce((t, e) => t + e.amount, 0);
  const retTotal = rets.reduce((t, e) => t + e.amount, 0);

  // Próximo vencimiento de la declaración mensual (mes anterior).
  const day = DUE_DAY[RUC[8]] ?? 28;
  const today = ecDate(now);
  const [y, m] = today.split('-').map(Number);
  const thisDue = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const nextDue = today <= thisDue ? thisDue : (m === 12 ? `${y + 1}-01-${String(day).padStart(2, '0')}` : `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  const daysLeft = Math.round((Date.parse(nextDue) - Date.parse(today)) / 86_400_000);

  const exportSales = async () => {
    setBusy(true);
    try {
      const { downloadXlsx } = await import('../excel');
      await downloadXlsx(`hulul-sri-${range.from}_${range.to}.xlsx`, [
        { name: 'Ventas HULUL', title: ['CORPORACIÓN COFFEEPORT CÍA. LTDA. — HULUL', `RUC ${RUC} · Periodo ${range.from} al ${range.to}`, 'Ventas propias con IVA 15 % (cargo de plataforma y comisión).'],
          columns: [{ key: 'date', header: 'Fecha', width: 12 }, { key: 'to', header: 'A quién', width: 12 }, { key: 'idType', header: 'Tipo de identificación', width: 18 }, { key: 'id', header: 'Identificación', width: 16, text: true }, { key: 'name', header: 'Razón social / nombre', width: 30 }, { key: 'concept', header: 'Concepto', width: 34 }, { key: 'base', header: 'Base IVA 15 %', money: true }, { key: 'iva', header: 'IVA', money: true }, { key: 'total', header: 'Total', money: true }],
          rows: sales, totals: ['base', 'iva', 'total'] },
        { name: 'Terceros', title: ['Facturas de los profesionales a los clientes: valores por cuenta de terceros (no son ingreso de HULUL).'],
          columns: [{ key: 'fecha', header: 'Fecha' }, { key: 'reserva', header: 'Reserva' }, { key: 'profesional', header: 'Profesional', width: 28 }, { key: 'ruc', header: 'RUC', text: true, width: 16 }, { key: 'base', header: 'Base', money: true }, { key: 'iva', header: 'IVA', money: true }, { key: 'total', header: 'Total', money: true }],
          rows: third.map((e) => ({ fecha: ecDate(e.createdAt!), reserva: code.get(e.bookingId ?? '') ?? '', profesional: proName.get(e.proId)?.name ?? '', ruc: proName.get(e.proId)?.ruc ?? '', base: e.base ?? 0, iva: e.iva ?? 0, total: e.amount })), totals: ['base', 'iva', 'total'] },
        { name: 'Retenciones', title: ['Retenciones hechas a los profesionales (por pagar al SRI).'],
          columns: [{ key: 'fecha', header: 'Fecha' }, { key: 'profesional', header: 'Profesional', width: 28 }, { key: 'tipo', header: 'Tipo' }, { key: 'monto', header: 'Monto', money: true }],
          rows: rets.map((e) => ({ fecha: ecDate(e.createdAt!), profesional: proName.get(e.proId)?.name ?? '', tipo: e.kind === 'retencion_renta' ? 'Renta' : 'IVA', monto: e.amount })), totals: ['monto'] },
      ]);
    } finally { setBusy(false); }
  };

  const tabs: [View, string][] = [['ventas', `Ventas de HULUL (${sales.length})`], ['terceros', `Facturas de profesionales (${third.length})`], ['retenciones', `Retenciones (${rets.length})`]];

  return (
    <>
      <PageHead title="Cumplimiento SRI" lead={`Corporación Coffeeport Cía. Ltda. · RUC ${RUC}. Lo que HULUL declara y lo que no, en el periodo elegido.`}>
        <button type="button" className="adm-btn solid" disabled={!view || busy} onClick={exportSales}>{busy ? 'Armando…' : 'Descargar Excel para el SRI'}</button>
      </PageHead>
      <PeriodBar only={['mes', 'ultimos_30', 'ultimos_90', 'personalizado']} />
      {!view ? <Loading /> : (
        <>
          <div className="adm-kpis">
            <Kpi accent label="Próximo vencimiento" value={fmtDay(nextDue)} hint={`En ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} · noveno dígito del RUC: ${RUC[8]} (día ${day})`} onClick={() => setTab('ventas')} />
            <Kpi label="Ventas gravadas de HULUL" value={money(base)} hint={`${sales.length} comprobantes por emitir`} onClick={() => setTab('ventas')} />
            <Kpi label="IVA cobrado (por pagar)" value={money(iva)} hint="De las ventas de HULUL" onClick={() => setTab('ventas')} />
            <Kpi label="Facturado por profesionales" value={money(thirdTotal)} hint="Terceros: no es ingreso de HULUL" onClick={() => setTab('terceros')} />
            <Kpi label="Retenciones por pagar" value={money(retTotal)} hint={retTotal ? 'Hechas a los profesionales' : 'En 0 hasta definir porcentajes'} onClick={() => setTab('retenciones')} />
          </div>
          <div className="adm-tabs" role="tablist">
            {tabs.map(([k, l]) => <button key={k} type="button" role="tab" className="adm-tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              {tab === 'ventas' && (<>
                <thead><tr><th>Fecha</th><th>A quién</th><th>Identificación</th><th>Nombre</th><th>Concepto</th><th className="num">Base</th><th className="num">IVA</th><th className="num">Total</th></tr></thead>
                <tbody>{sales.length ? sales.map((x, i) => <tr key={i}><td>{fmtDay(x.date)}</td><td>{x.to}</td><td style={{ fontSize: 12.5 }}>{x.idType} {x.id}</td><td>{x.name}</td><td style={{ fontSize: 13 }}>{x.concept}</td><td className="num">{money(x.base)}</td><td className="num">{money(x.iva)}</td><td className="num">{money(x.total)}</td></tr>) : <tr><td colSpan={8} className="adm-empty">Sin ventas registradas en el periodo.</td></tr>}</tbody>
              </>)}
              {tab === 'terceros' && (<>
                <thead><tr><th>Fecha</th><th>Reserva</th><th>Profesional</th><th>RUC</th><th className="num">Base</th><th className="num">IVA</th><th className="num">Total</th></tr></thead>
                <tbody>{third.length ? third.map((e) => <tr key={e.id}><td>{e.createdAt ? fmtDay(ecDate(e.createdAt)) : '—'}</td><td>{code.get(e.bookingId ?? '') ?? '—'}</td><td>{proName.get(e.proId)?.name ?? '—'}</td><td style={{ fontSize: 12.5 }}>{proName.get(e.proId)?.ruc ?? '—'}</td><td className="num">{money(e.base ?? 0)}</td><td className="num">{money(e.iva ?? 0)}</td><td className="num">{money(e.amount)}</td></tr>) : <tr><td colSpan={7} className="adm-empty">Sin facturas de profesionales en el periodo.</td></tr>}</tbody>
              </>)}
              {tab === 'retenciones' && (<>
                <thead><tr><th>Fecha</th><th>Profesional</th><th>Tipo</th><th className="num">Monto</th></tr></thead>
                <tbody>{rets.length ? rets.map((e) => <tr key={e.id}><td>{e.createdAt ? fmtDay(ecDate(e.createdAt)) : '—'}</td><td>{proName.get(e.proId)?.name ?? '—'}</td><td>{e.kind === 'retencion_renta' ? 'Renta' : 'IVA'}</td><td className="num">{money(e.amount)}</td></tr>) : <tr><td colSpan={4} className="adm-empty">Sin retenciones: los porcentajes siguen en 0 hasta que la contadora los defina.</td></tr>}</tbody>
              </>)}
            </table>
          </div>
          <div className="adm-note">
            La declaración mensual (por ejemplo, IVA en el formulario 104) vence según el noveno dígito del RUC; confírmalo con la contadora junto con el ATS. Los comprobantes de HULUL aún no se emiten electrónicamente desde la plataforma: estos son los que corresponde emitir. Lo que facturan los profesionales es dinero de terceros y no entra en las ventas de HULUL.
          </div>
        </>
      )}
    </>
  );
}
