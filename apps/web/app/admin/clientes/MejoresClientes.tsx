'use client';

import { useMemo, useState } from 'react';
import { bestClients, INCENTIVE_DEFAULTS, TIER_INFO, type ClientTier, type DashData } from '@hulul/shared/dashboard';
import { Badge, catName, fmtDay, Kpi, money, percent } from '../ui';

/**
 * Mejores clientes y plan de incentivos: quiénes dejan más a HULUL, vuelven y no dan problemas,
 * y qué beneficio darles para que sigan, calculado como un porcentaje de lo que dejaron.
 */
const wa = (phone: string, text: string) => `https://wa.me/593${phone.replace(/\D/g, '').replace(/^0/, '')}?text=${encodeURIComponent(text)}`;

export function MejoresClientes({ view, now, onPick }: { view: DashData; now: number; onPick: (clientId: string) => void }) {
  const [budgetPct, setBudgetPct] = useState(INCENTIVE_DEFAULTS.budgetPct);
  const [months, setMonths] = useState(INCENTIVE_DEFAULTS.months);
  const [tier, setTier] = useState<ClientTier | ''>('');
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
                <td onClick={(e) => e.stopPropagation()}>{c.phone && <a className="adm-btn" target="_blank" rel="noreferrer" href={wa(c.phone, `Hola ${c.name.split(' ')[0]}, te escribimos de HULUL para agradecerte por confiar en nosotros. Como uno de nuestros mejores clientes, ${c.incentive.fees >= 1 ? `tus próximas ${c.incentive.fees > 1 ? `${c.incentive.fees} reservas` : 'reserva'} no tendrán cargo de plataforma` : `tienes ${c.incentive.discountPct} % de descuento en tu próxima visita`}. ¡Gracias!`)}>WhatsApp</a>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0' }}>Oro: el 10 % con mejor puntaje · Plata: el 20 % siguiente · Bronce: el resto con 2 o más servicios. Puntaje = lo que dejó a HULUL × frecuencia × recencia, y baja si tuvo ausencias, reportes o reclamos sin razón. Quien no vuelve hace más de 45 días se marca para reconquistarlo.</p>
    </section>
  );
}
