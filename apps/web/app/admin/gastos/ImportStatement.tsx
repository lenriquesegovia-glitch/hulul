'use client';

import { useMemo, useState } from 'react';
import { EXPENSE_CATEGORIES, EXPENSE_GROUPS, MANUAL_EXPENSE_CATEGORIES, PLATFORMS, r2, statementDrafts, type Expense, type StatementDraft } from '@hulul/shared/dashboard';
import { MUESTRA } from '../AdminShell';
import { Badge, Drawer, fmtDay, money } from '../ui';

/**
 * Carga del estado de cuenta de la tarjeta: Claude lee el PDF (o el Excel/CSV del banco), se
 * revisan los cargos (plataforma, categoría, IVA, ISD, mes al que corresponden) y se crean de una vez.
 */
const CARD_KEY = 'hulul-tarjeta-habitual';
export interface CardDefaults { pagador: 'empresa' | 'socio'; socio: string; tarjeta: string }
export function cardDefaults(): CardDefaults {
  try { const v = JSON.parse(localStorage.getItem(CARD_KEY) || 'null'); if (v) return v as CardDefaults; } catch { /* sin almacenamiento */ }
  return { pagador: 'socio', socio: 'Socio 1', tarjeta: '' };
}
const saveDefaults = (d: CardDefaults) => { try { localStorage.setItem(CARD_KEY, JSON.stringify(d)); } catch { /* sin almacenamiento */ } };
const errMsg = (e: unknown) => ((e as { message?: string }).message || 'No se pudo completar.').replace(/\s*\[\d{3}\]\s*$/, '');

async function fileToInput(file: File): Promise<{ pdf?: string; text?: string }> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { pdf: btoa(bin) };
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const lines: string[] = [];
    wb.eachSheet((ws) => ws.eachRow((row) => {
      const vals = (row.values as unknown[]).slice(1).map((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v && typeof v === 'object' && 'result' in (v as object) ? String((v as { result: unknown }).result) : String(v ?? '')));
      lines.push(vals.join(';'));
    }));
    return { text: lines.join('\n') };
  }
  return { text: await file.text() };
}

const SAMPLE = {
  periodo: { desde: '2026-09-16', hasta: '2026-10-15' }, banco: 'Banco del Pacífico (muestra)',
  movimientos: [
    { n: 1, fecha: '2026-10-02', descripcion: 'GOOGLE *CLOUD FTRVZ', monto: 44.1, tipo: 'consumo', relacionado: null, exterior: true },
    { n: 2, fecha: '2026-10-02', descripcion: 'IVA SERVICIOS DIGITALES', monto: 6.62, tipo: 'iva', relacionado: 1, exterior: false },
    { n: 3, fecha: '2026-10-05', descripcion: 'VERCEL INC', monto: 20, tipo: 'consumo', relacionado: null, exterior: true },
    { n: 4, fecha: '2026-10-05', descripcion: 'IVA SERVICIOS DIGITALES', monto: 3, tipo: 'iva', relacionado: 3, exterior: false },
    { n: 5, fecha: '2026-10-08', descripcion: 'CLAUDE.AI SUBSCRIPTION', monto: 100, tipo: 'consumo', relacionado: null, exterior: true },
    { n: 6, fecha: '2026-10-08', descripcion: 'IVA SERVICIOS DIGITALES', monto: 15, tipo: 'iva', relacionado: 5, exterior: false },
    { n: 7, fecha: '2026-10-11', descripcion: 'NAMECHEAP.COM', monto: 32, tipo: 'consumo', relacionado: null, exterior: true },
    { n: 8, fecha: '2026-10-12', descripcion: 'PAPELERIA JUAN MARCET', monto: 18.4, tipo: 'consumo', relacionado: null, exterior: false },
    { n: 9, fecha: '2026-10-14', descripcion: 'PAGO GRACIAS', monto: -250, tipo: 'pago', relacionado: null, exterior: false },
    { n: 10, fecha: '2026-10-15', descripcion: 'INTERES FINANCIAMIENTO', monto: 2.15, tipo: 'interes', relacionado: null, exterior: false },
  ],
};

export function ImportStatement({ existing, onClose, onSaved }: { existing: Expense[]; onClose: () => void; onSaved: (n: number) => Promise<void> }) {
  const [card, setCard] = useState<CardDefaults>(() => cardDefaults());
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [head, setHead] = useState<{ banco: string; desde: string; hasta: string } | null>(null);
  const [rows, setRows] = useState<StatementDraft[]>([]);

  const read = async () => {
    setBusy('read'); setErr('');
    try {
      const r = MUESTRA ? SAMPLE : await (await import('@hulul/shared/firebase')).adminReadCardStatement(await fileToInput(file!));
      setHead({ banco: r.banco, desde: r.periodo.desde, hasta: r.periodo.hasta });
      setRows(statementDrafts(r.movimientos, existing));
      if (!r.movimientos.length) setErr('No se encontraron movimientos en el archivo.');
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(''); }
  };
  const upd = (key: string, patch: Partial<StatementDraft>) => setRows((l) => l.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setPlatform = (key: string, plat: string) => {
    const p = PLATFORMS.find((x) => x.key === plat);
    setRows((l) => l.map((r) => {
      if (r.key !== key) return r;
      const mes = r.fecha.slice(0, 7);
      const [y, m] = mes.split('-').map(Number);
      const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
      return p ? { ...r, plataforma: plat, proveedor: p.name, categoria: p.categoria, exterior: p.exterior, cubreMeses: p.billing === 'anual' ? 12 : 1, cubreDesde: p.billing === 'consumo' ? prev : mes, nota: r.dup ? r.nota : '' }
        : { ...r, plataforma: '', proveedor: r.descripcion };
    }));
  };
  const chosen = rows.filter((r) => r.include);
  const total = useMemo(() => r2(chosen.reduce((t, r) => t + r.base + r.iva + r.isd, 0)), [chosen]);

  const save = async () => {
    setBusy('save'); setErr('');
    try {
      if (MUESTRA) throw new Error('En la muestra no se guardan cambios.');
      if (card.pagador === 'socio' && card.socio.trim().length < 2) throw new Error('Escribe qué socio es el dueño de la tarjeta.');
      saveDefaults(card);
      const n = await (await import('@hulul/shared/firebase')).adminSaveExpenses(chosen.map((r) => ({
        fecha: r.fecha, categoria: r.categoria, proveedor: r.proveedor, identificacion: '', factura: '', descripcion: r.descripcion,
        base: r.base, iva: r.iva, isd: r.isd, retRenta: 0, retIva: 0, formaPago: 'tarjeta', estado: 'pagado', vence: null, recurrente: !!PLATFORMS.find((p) => p.key === r.plataforma && (p.billing === 'mensual' || p.billing === 'consumo')),
        tarjeta: card.tarjeta, pagador: card.pagador, socio: card.pagador === 'socio' ? card.socio : '', exterior: r.exterior, liquidacion: false, plataforma: r.plataforma,
        cubreDesde: r.cubreDesde, cubreMeses: r.cubreMeses,
      })));
      await onSaved(n);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(''); }
  };

  return (
    <Drawer title="Subir estado de cuenta de la tarjeta" sub="Claude lee el archivo del banco y propone cada cargo como gasto devengado. Revisas y guardas. El archivo no se guarda." onClose={onClose} wide>
      <div className="adm-grid" style={{ gap: 12 }}>
        <div className="adm-grid g-2" style={{ gap: 10 }}>
          <label className="adm-field">¿De quién es la tarjeta?
            <select className="adm-select" value={card.pagador} onChange={(e) => setCard({ ...card, pagador: e.target.value as CardDefaults['pagador'] })}>
              <option value="socio">Personal de un socio (la empresa se la reembolsa)</option><option value="empresa">De la empresa</option>
            </select>
          </label>
          {card.pagador === 'socio' && <label className="adm-field">Socio<input className="adm-input" value={card.socio} onChange={(e) => setCard({ ...card, socio: e.target.value })} /></label>}
          <label className="adm-field">Tarjeta<input className="adm-input" value={card.tarjeta} onChange={(e) => setCard({ ...card, tarjeta: e.target.value })} placeholder="Visa Pacífico ••1234" /></label>
          <label className="adm-field">Archivo del banco (PDF, Excel o CSV)<input className="adm-input" type="file" accept=".pdf,.xlsx,.xls,.csv,.txt" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRows([]); setHead(null); }} /></label>
        </div>
        <div className="adm-bar"><button type="button" className="adm-btn solid" disabled={(!file && !MUESTRA) || !!busy} onClick={read}>{busy === 'read' ? 'Leyendo con IA… (hasta 1 minuto)' : 'Leer estado de cuenta'}</button>
          <span className="muted" style={{ fontSize: 12.5 }}>Sube un mes a la vez. Usa la clave de Claude conectada en Administración.</span></div>
        {err && <div className="adm-err" role="alert">{err}</div>}
        {head && (
          <>
            <div className="adm-note">{head.banco || 'Banco'} · {head.desde ? `${fmtDay(head.desde)} – ${fmtDay(head.hasta)}` : 'periodo no indicado'} · {rows.length} cargos. Los pagos a la tarjeta no se registran como gasto; el IVA de servicios digitales y el ISD quedan unidos a su consumo.</div>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th /><th>Fecha</th><th>Comercio</th><th>Plataforma / categoría</th><th className="num">Base</th><th className="num">IVA</th><th className="num">ISD</th><th>Se devenga</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} style={{ opacity: r.include ? 1 : 0.55 }}>
                      <td><input type="checkbox" aria-label={`Incluir ${r.descripcion}`} checked={r.include} onChange={(e) => upd(r.key, { include: e.target.checked })} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDay(r.fecha)}</td>
                      <td style={{ minWidth: 160 }}>{r.descripcion}{r.exterior && <> <Badge tone="t-warm">exterior</Badge></>}{r.nota && <div><Badge tone={r.dup ? 't-mute' : 't-warn'}>{r.nota}</Badge></div>}</td>
                      <td style={{ minWidth: 200 }}>
                        <select className="adm-select" style={{ width: '100%' }} value={r.plataforma} onChange={(e) => setPlatform(r.key, e.target.value)}>
                          <option value="">No es una plataforma</option>
                          {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                        </select>
                        {!r.plataforma && (
                          <select className="adm-select" style={{ width: '100%', marginTop: 4 }} value={r.categoria} onChange={(e) => upd(r.key, { categoria: e.target.value, nota: r.dup ? r.nota : '' })}>
                            {EXPENSE_GROUPS.filter((g) => g.key !== 'nomina').map((g) => <optgroup key={g.key} label={g.label}>{MANUAL_EXPENSE_CATEGORIES.filter((k) => EXPENSE_CATEGORIES[k].group === g.key).map((k) => <option key={k} value={k}>{EXPENSE_CATEGORIES[k].label}</option>)}</optgroup>)}
                          </select>
                        )}
                      </td>
                      <td className="num">{money(r.base)}</td>
                      <td className="num">{money(r.iva)}</td>
                      <td className="num">{money(r.isd)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <input className="adm-input" type="month" style={{ width: 140 }} value={r.cubreDesde} onChange={(e) => upd(r.key, { cubreDesde: e.target.value })} />
                        <select className="adm-select" style={{ marginLeft: 4 }} value={r.cubreMeses} onChange={(e) => upd(r.key, { cubreMeses: Number(e.target.value) })}>{[1, 2, 3, 6, 12, 24].map((n) => <option key={n} value={n}>{n === 1 ? '1 mes' : `${n} meses`}</option>)}</select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="adm-bar">
              <button type="button" className="adm-btn solid" disabled={!chosen.length || !!busy} onClick={save}>{busy === 'save' ? 'Guardando…' : `Crear ${chosen.length} gastos (${money(total)})`}</button>
              <span className="muted" style={{ fontSize: 12.5 }}>Quedan como pagados con la tarjeta{card.pagador === 'socio' ? ` de ${card.socio}; la empresa le debe el reembolso` : ''}. Después marca en cada uno la liquidación de compra.</span>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
