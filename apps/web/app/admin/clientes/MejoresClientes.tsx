'use client';

import { useMemo, useState } from 'react';
import { bestClients, INCENTIVE_DEFAULTS, TIER_INFO, type BestClient, type ClientTier, type DashData } from '@hulul/shared/dashboard';
import { MUESTRA, useAdmin } from '../AdminShell';
import { Badge, catName, Drawer, fmtDay, Kpi, money, percent } from '../ui';

/**
 * Mejores clientes y plan de incentivos: quiénes dejan más a HULUL, vuelven y no dan problemas,
 * y qué beneficio darles para que sigan, calculado como un porcentaje de lo que dejaron.
 */

export function MejoresClientes({ view, now, onPick }: { view: DashData; now: number; onPick: (clientId: string) => void }) {
  const [budgetPct, setBudgetPct] = useState(INCENTIVE_DEFAULTS.budgetPct);
  const [months, setMonths] = useState(INCENTIVE_DEFAULTS.months);
  const [tier, setTier] = useState<ClientTier | ''>('');
  const [give, setGive] = useState<BestClient | null>(null);
  const [given, setGiven] = useState<Record<string, string>>({});
  const { can } = useAdmin();
  const canGive = can('pagos');
  const owned = useMemo(() => new Map(view.clients.map((c) => [c.uid, c])), [view.clients]);
  const holds = (id: string) => { const o = owned.get(id); return [(o?.cargosGratis ?? 0) > 0 && `${o!.cargosGratis} sin cargo`, (o?.credit ?? 0) > 0 && `${money(o!.credit!)} a favor`].filter(Boolean).join(' · '); };
  const list = useMemo(() => bestClients(view, now, { ...INCENTIVE_DEFAULTS, budgetPct, months }), [view, now, budgetPct, months]);
  const shown = list.filter((c) => !tier || c.tier === tier);
  const hulul = list.reduce((t, c) => t + c.hulul, 0);
  const budget = list.reduce((t, c) => t + c.incentive.budget, 0);
  const count = (t: ClientTier) => list.filter((c) => c.tier === t).length;

  const exportXlsx = async () => {
    const { downloadXlsx } = await import('../excel');
    await downloadXlsx(`hulul-mejores-clientes-${new Date(now).toISOString().slice(0, 10)}.xlsx`, [{
      name: 'Mejores clientes', title: ['HULUL · Mejores clientes y plan de incentivos', `Últimos ${months} meses · beneficio = hasta ${percent(budgetPct)} de lo que dejó a HULUL (máx. ${money(INCENTIVE_DEFAULTS.maxValue)})`],
      columns: [{ key: 'nivel', header: 'Nivel' }, { key: 'name', header: 'Cliente', width: 26 }, { key: 'phone', header: 'Celular', text: true }, { key: 'done', header: 'Servicios' }, { key: 'hulul', header: 'Dejó a HULUL', money: true }, { key: 'gross', header: 'Gastó en total', money: true }, { key: 'last', header: 'Última visita' }, { key: 'servicios', header: 'Servicios que usa', width: 30 }, { key: 'budget', header: 'Presupuesto del beneficio', money: true }, { key: 'text', header: 'Beneficio sugerido', width: 50 }],
      rows: list.map((c) => ({ nivel: TIER_INFO[c.tier].label, name: c.name, phone: c.phone, done: c.done, hulul: c.hulul, gross: c.gross, last: c.last ?? '', servicios: c.categories.map(catName).join(', '), budget: c.incentive.budget, text: c.incentive.text })),
      totals: ['hulul', 'gross', 'budget'],
    }]);
  };

  return (
    <section className="adm-card" id="mejores-clientes">
      <div className="adm-bar" style={{ justifyContent: 'space-between' }}>
        <div><h2 style={{ margin: 0 }}>Mejores clientes y plan de incentivos</h2>
          <p className="sub" style={{ margin: 0 }}>Los que más dejan a HULUL (cargo de plataforma y comisión), vuelven seguido y no dan problemas. El beneficio sugerido sale de un porcentaje de lo que cada uno dejó, así nunca regalas más de lo que ganaste con él.</p></div>
        <button type="button" className="adm-btn" onClick={exportXlsx} disabled={!list.length}>Descargar Excel</button>
      </div>
      <div className="adm-bar" style={{ marginTop: 10 }}>
        <span className="muted" style={{ fontSize: 13 }}>Devolver en beneficios:</span>
        {[0.1, 0.2, 0.3].map((p) => <button key={p} type="button" className="adm-chip" aria-pressed={budgetPct === p} onClick={() => setBudgetPct(p)}>{percent(p)}</button>)}
        <span className="muted" style={{ fontSize: 13, marginLeft: 8 }}>Mirar los últimos:</span>
        {[3, 6, 12].map((m) => <button key={m} type="button" className="adm-chip" aria-pressed={months === m} onClick={() => setMonths(m)}>{m} meses</button>)}
      </div>
      <div className="adm-kpis" style={{ marginTop: 12 }}>
        {(['oro', 'plata', 'bronce'] as ClientTier[]).map((t) => <Kpi key={t} label={`${TIER_INFO[t].label}`} value={count(t)} hint={TIER_INFO[t].help} selected={tier === t} onClick={() => setTier((x) => (x === t ? '' : t))} />)}
        <Kpi accent label="Presupuesto del plan" value={money(budget)} hint={`${hulul ? percent(budget / hulul) : '—'} de los ${money(hulul)} que dejaron a HULUL`} />
      </div>
      {!shown.length ? <div className="adm-empty">Aún no hay clientes con 2 o más servicios sin problemas en este periodo.</div> : (
        <div className="adm-table-wrap" style={{ marginTop: 12 }}>
          <table className="adm-table">
            <thead><tr><th>Cliente</th><th className="num">Servicios</th><th className="num">Dejó a HULUL</th><th>Última visita</th><th>Beneficio sugerido</th><th /></tr></thead>
            <tbody>{shown.slice(0, 200).map((c) => (
              <tr key={c.clientId} className="click" onClick={() => onPick(c.clientId)}>
                <td><span className="adm-badge" style={{ background: `${TIER_INFO[c.tier].color}22`, color: TIER_INFO[c.tier].color }}>{TIER_INFO[c.tier].label}</span> <b>{c.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{c.categories.map(catName).join(', ')}{c.avgGiven !== null ? ` · califica ★ ${c.avgGiven.toFixed(1).replace('.', ',')}` : ''}</div></td>
                <td className="num">{c.done}</td>
                <td className="num"><b>{money(c.hulul)}</b><div className="muted" style={{ fontSize: 12 }}>gastó {money(c.gross)}</div></td>
                <td style={{ fontSize: 13 }}>{c.last ? fmtDay(c.last) : '—'}{c.daysSince !== null && c.daysSince > 45 ? <div><Badge tone="t-warn">Hace {c.daysSince} días</Badge></div> : null}</td>
                <td style={{ fontSize: 13 }}><b>{money(c.incentive.budget)}</b><div className="muted" style={{ fontSize: 12.5 }}>{c.incentive.text}</div></td>
                <td onClick={(e) => e.stopPropagation()}>
                  {given[c.clientId] ? <Badge tone="t-ok">Dado: {given[c.clientId]}</Badge>
                    : canGive && c.incentive.budget >= 1 ? <button type="button" className="adm-btn" onClick={() => setGive(c)}>Dar beneficio</button> : null}
                  {holds(c.clientId) && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Tiene: {holds(c.clientId)}</div>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {give && <GiveBenefit c={give} onClose={() => setGive(null)} onDone={(label) => { setGiven((g) => ({ ...g, [give.clientId]: label })); setGive(null); }} />}
      <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0' }}>Oro: el 10 % con mejor puntaje · Plata: el 20 % siguiente · Bronce: el resto con 2 o más servicios. Puntaje = lo que dejó a HULUL × frecuencia × recencia, y baja si tuvo ausencias, reportes o reclamos sin razón. Quien no vuelve hace más de 45 días se marca para reconquistarlo.</p>
    </section>
  );
}

/** Da el beneficio dentro de la cuenta del cliente: se aplica solo en su próxima reserva y le llega el aviso. */
function GiveBenefit({ c, onClose, onDone }: { c: BestClient; onClose: () => void; onDone: (label: string) => void }) {
  const [tipo, setTipo] = useState<'cargo_gratis' | 'credito'>(c.incentive.fees >= 1 ? 'cargo_gratis' : 'credito');
  const [cantidad, setCantidad] = useState(Math.max(1, Math.min(10, c.incentive.fees || 1)));
  const [monto, setMonto] = useState(Math.max(1, Math.min(50, Math.floor(c.incentive.budget))));
  const [motivo, setMotivo] = useState(`Plan de incentivos · nivel ${TIER_INFO[c.tier].label}`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const cost = tipo === 'cargo_gratis' ? cantidad * 1.99 * 1.15 : monto;
  const send = async () => {
    setBusy(true); setErr('');
    try {
      if (MUESTRA) throw new Error('En la muestra no se guardan cambios.');
      await (await import('@hulul/shared/firebase')).adminGrantBenefit({ clientId: c.clientId, tipo, cantidad, monto, motivo });
      onDone(tipo === 'cargo_gratis' ? `${cantidad} sin cargo` : `${money(monto)} a favor`);
    } catch (e) { setErr(((e as { message?: string }).message || 'No se pudo dar el beneficio.').replace(/\s*\[\d{3}\]\s*$/, '')); } finally { setBusy(false); }
  };
  return (
    <Drawer title={`Beneficio para ${c.name}`} sub={`Dejó ${money(c.hulul)} a HULUL · presupuesto sugerido ${money(c.incentive.budget)}`} onClose={onClose}>
      <div className="adm-grid" style={{ gap: 12 }}>
        <label className="adm-toggle"><input type="radio" checked={tipo === 'cargo_gratis'} onChange={() => setTipo('cargo_gratis')} /> Reservas sin cargo de plataforma (HULUL no cobra su cargo; el profesional cobra igual su servicio)</label>
        {tipo === 'cargo_gratis' && <label className="adm-field">Cuántas reservas<input className="adm-input" type="number" min={1} max={10} value={cantidad} onChange={(e) => setCantidad(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} /></label>}
        <label className="adm-toggle"><input type="radio" checked={tipo === 'credito'} onChange={() => setTipo('credito')} /> Saldo a favor en dólares (nota de crédito: se descuenta del total de su próxima reserva)</label>
        {tipo === 'credito' && <label className="adm-field">Monto (máx. $50)<input className="adm-input" type="number" min={1} max={50} step={0.5} value={monto} onChange={(e) => setMonto(Math.max(0.5, Math.min(50, Number(e.target.value) || 0)))} /></label>}
        <label className="adm-field">Motivo<input className="adm-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
        <dl className="adm-kv"><dt>Le cuesta a HULUL (aprox.)</dt><dd>{money(cost)}</dd><dt>Sobre lo que dejó</dt><dd>{c.hulul ? percent(cost / c.hulul) : '—'}</dd></dl>
        {cost > c.incentive.budget * 1.5 && <div className="adm-note">Es bastante más que el presupuesto sugerido para este cliente.</div>}
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>Queda guardado en su cuenta y se aplica solo en su próxima reserva (web o app). Le llega un aviso al celular y al correo. Si cancela esa reserva, el beneficio vuelve a su cuenta.</p>
        {err && <div className="adm-err" role="alert">{err}</div>}
        <div className="adm-bar"><button type="button" className="adm-btn solid" disabled={busy} onClick={send}>{busy ? 'Dando…' : 'Dar beneficio'}</button><button type="button" className="adm-btn" onClick={onClose}>Cancelar</button></div>
      </div>
    </Drawer>
  );
}
