'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { bookingMoney, COMPLIANCE_LIMITS, complianceAlerts, inRange, toCsv, type ComplianceAlert } from '@hulul/shared/dashboard';
import { useAdmin } from '../AdminShell';
import { Badge, catName, downloadCsv, fmtDay, Kpi, Loading, money, PageHead, percent, PeriodBar } from '../ui';

const KIND_LABEL: Record<string, string> = {
  operacion: 'Operación alta', acumulado: 'Acumulado del mes', efectivo: 'Efectivo', repetido: 'Repetición', liquidaciones: 'Liquidaciones',
};

/**
 * Cumplimiento (UAFE): alertas de operaciones inusuales o que llegan a umbrales,
 * y el registro de operaciones del periodo para exportar. Solo lectura.
 */
export function CompliancePanel() {
  const { view, range, can } = useAdmin();
  const [level, setLevel] = useState<'todas' | 'alta' | 'media'>('todas');

  const ops = useMemo(() => (view?.bookings ?? []).filter((b) => inRange(b.date, range) && (b.status === 'completada' || b.status === 'en_disputa' || (b.status === 'cancelada' && b.cancelFee > 0))), [view, range]);
  const alerts = useMemo(() => (view ? complianceAlerts(view, range) : []), [view, range]);
  const shown = alerts.filter((a) => level === 'todas' || a.level === level);
  const rucOf = useMemo(() => new Map((view?.providers ?? []).map((p) => [p.uid, p.ruc])), [view]);

  const totals = useMemo(() => {
    let total = 0, cash = 0;
    for (const b of ops) { const g = bookingMoney(b).gross; total += g; if (b.paymentMethod === 'efectivo') cash += g; }
    return { total, cash };
  }, [ops]);

  const exportOps = () => downloadCsv(`hulul-operaciones-${range.from}_${range.to}.csv`, toCsv(ops.map((b) => ({
    fecha: b.date, hora: b.slot, codigo: b.code, servicio: catName(b.category), cliente: b.clientName, id_cliente: b.clientId,
    profesional: b.proName, ruc_profesional: rucOf.get(b.proId) ?? '', forma_pago: b.paymentMethod, monto: bookingMoney(b).gross, estado: b.status,
  })), ['fecha', 'hora', 'codigo', 'servicio', 'cliente', 'id_cliente', 'profesional', 'ruc_profesional', 'forma_pago', 'monto', 'estado'].map((k) => ({ key: k, label: k.replace(/_/g, ' ') }))));

  const exportAlerts = () => downloadCsv(`hulul-alertas-${range.from}_${range.to}.csv`, toCsv(shown.map((a) => ({
    nivel: a.level, tipo: KIND_LABEL[a.kind] ?? a.kind, alerta: a.title, detalle: a.detail, persona: a.who.name, tipo_persona: a.who.type, id: a.who.id, monto: a.amount, reservas: a.bookings.join(' '),
  })), ['nivel', 'tipo', 'alerta', 'detalle', 'persona', 'tipo_persona', 'id', 'monto', 'reservas'].map((k) => ({ key: k, label: k.replace(/_/g, ' ') }))));

  const whoLink = (a: ComplianceAlert) => {
    const href = a.who.type === 'cliente' ? `/admin/clientes?id=${encodeURIComponent(a.who.id)}` : `/admin/proveedores?id=${encodeURIComponent(a.who.id)}`;
    const ok = a.who.type === 'cliente' ? can('clientes') : can('proveedores');
    return ok ? <Link href={href}><b>{a.who.name || '—'}</b></Link> : <b>{a.who.name || '—'}</b>;
  };

  return (
    <>
      <PageHead title="Cumplimiento (UAFE)" lead="Operaciones que llegan a umbrales o se ven inusuales, y el registro de operaciones para reportar. Solo lectura." />
      <PeriodBar />
      {!view ? <Loading /> : (
        <>
          <div className="adm-kpis">
            <Kpi accent label="Alertas altas" value={alerts.filter((a) => a.level === 'alta').length} hint="Revisar primero" />
            <Kpi label="Alertas medias" value={alerts.filter((a) => a.level === 'media').length} />
            <Kpi label="Operaciones cobradas" value={ops.length} hint={money(totals.total)} />
            <Kpi label="Pagado en efectivo" value={money(totals.cash)} hint={totals.total ? `${percent(totals.cash / totals.total)} del total` : '—'} />
          </div>

          <div className="adm-bar" style={{ justifyContent: 'space-between' }}>
            <div className="adm-bar" role="group" aria-label="Nivel">
              {(['todas', 'alta', 'media'] as const).map((l) => <button key={l} type="button" className="adm-chip" aria-pressed={level === l} onClick={() => setLevel(l)}>{{ todas: 'Todas', alta: 'Altas', media: 'Medias' }[l]}</button>)}
            </div>
            <span className="adm-bar">
              <button type="button" className="adm-btn" onClick={exportAlerts} disabled={!shown.length}>Exportar alertas</button>
              <button type="button" className="adm-btn" onClick={exportOps} disabled={!ops.length}>Exportar operaciones</button>
            </span>
          </div>

          {shown.length === 0 ? <div className="adm-card adm-empty">Sin alertas en este periodo.</div> : (
            <div className="adm-cards">
              {shown.map((a) => (
                <article key={a.key} className="adm-card" style={{ borderLeft: `5px solid ${a.level === 'alta' ? 'var(--bad)' : 'var(--warn)'}`, padding: 14, display: 'grid', gap: 6 }}>
                  <div className="flags"><Badge tone={a.level === 'alta' ? 't-bad' : 't-warn'}>{a.level === 'alta' ? 'Alta' : 'Media'}</Badge><Badge tone="t-mute">{KIND_LABEL[a.kind] ?? a.kind}</Badge></div>
                  <b style={{ fontSize: 15 }}>{a.title}</b>
                  <span style={{ fontSize: 13.5 }}>{a.who.type === 'cliente' ? 'Cliente' : 'Profesional'}: {whoLink(a)}</span>
                  <span className="muted" style={{ fontSize: 13 }}>{a.detail}</span>
                  {a.bookings.length > 0 && <span className="muted" style={{ fontSize: 12 }}>Reservas: {a.bookings.slice(0, 12).join(', ')}{a.bookings.length > 12 ? ` y ${a.bookings.length - 12} más` : ''}</span>}
                </article>
              ))}
            </div>
          )}

          <section className="adm-card">
            <h2>Operaciones del periodo</h2>
            <p className="sub">Reservas cobradas (completadas, en reclamo o con cargo de cancelación), de mayor a menor monto.</p>
            <div className="adm-table-wrap" style={{ border: 'none' }}>
              <table className="adm-table">
                <thead><tr><th>Fecha</th><th>Código</th><th>Cliente</th><th>Profesional</th><th>RUC</th><th>Pago</th><th className="num">Monto</th></tr></thead>
                <tbody>
                  {ops.length ? ops.slice().sort((a, b) => bookingMoney(b).gross - bookingMoney(a).gross).slice(0, 300).map((b) => (
                    <tr key={b.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDay(b.date)}</td><td>{b.code}</td><td>{b.clientName}</td><td>{b.proName}</td>
                      <td style={{ fontSize: 12.5 }}>{rucOf.get(b.proId) || '—'}</td><td>{b.paymentMethod}</td><td className="num">{money(bookingMoney(b).gross)}</td>
                    </tr>
                  )) : <tr><td colSpan={7} className="adm-empty">Sin operaciones en el periodo.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <div className="adm-note">
            Umbrales de referencia (por confirmar con la oficial de cumplimiento): operación desde {money(COMPLIANCE_LIMITS.singleOperation)}; cliente desde {money(COMPLIANCE_LIMITS.clientMonthlyWarn)} al mes (alta desde {money(COMPLIANCE_LIMITS.clientMonthly)}, umbral del RESU); efectivo de un cliente desde {money(COMPLIANCE_LIMITS.cashMonthly)} al mes; {COMPLIANCE_LIMITS.samePairWeek} o más servicios en 7 días con el mismo profesional; profesional con más de {money(COMPLIANCE_LIMITS.proMonthlyPayouts)} liquidados al mes. HULUL hoy no pide cédula al cliente: la exportación lleva su identificador interno.
          </div>
        </>
      )}
    </>
  );
}
