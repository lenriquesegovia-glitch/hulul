'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { TAX_REGIME_LABEL, type TaxRegime } from '@hulul/shared';
import { caseFlags, caseOutcome, inRange, OUTCOMES, percent, providerSeries, providerStats, toCsv, type DashBooking, type Granularity, type ProviderStats } from '@hulul/shared/dashboard';
import type { StatementBatch } from '@hulul/shared/firebase';
import { useAdmin } from '../AdminShell';
import { Badge, BookingListDrawer, BookingsCrm, catName, Donut, downloadCsv, Drawer, FlowChart, fmtDay, fmtWeek, fmtWhen, HBars, initials, Kpi, Loading, money, PageHead, PeriodBar } from '../ui';

type Sort = 'facturado' | 'trabajos' | 'calificacion' | 'problemas' | 'saldo' | 'nombre';
const STATUS: Record<string, [string, string]> = {
  aprobado: ['Aprobado', 't-ok'], en_revision: ['Por revisar', 't-info'], observado: ['Observado', 't-warn'], rechazado: ['Rechazado', 't-bad'], '': ['Sin registro', 't-mute'],
};
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const regime = (r: string) => TAX_REGIME_LABEL[r as TaxRegime] ?? r;

const PRO_LABELS = { inflow: 'Cobrado por sus servicios', outflow: 'Comisión y cargos HULUL', net: 'Para el profesional', projected: 'Programado' };

/** Curva de los proveedores (todos o uno): cobrado, parte de HULUL, parte del profesional y lo programado. */
function ProviderTrend({ bookings, title }: { bookings: DashBooking[]; title: string }) {
  const { range } = useAdmin();
  const span = (Date.parse(range.to) - Date.parse(range.from)) / 86_400_000;
  const [gran, setGran] = useState<Granularity | null>(null);
  const g: Granularity = gran ?? (span > 120 ? 'mes' : span > 35 ? 'semana' : 'dia');
  const [drill, setDrill] = useState<{ title: string; ids: string[] } | null>(null);
  const points = useMemo(() => providerSeries(bookings, range, g), [bookings, range, g]);
  return (
    <section className="adm-card">
      <div className="adm-bar" style={{ justifyContent: 'space-between' }}>
        <div><h2 style={{ margin: 0 }}>{title}</h2><p className="sub" style={{ margin: 0 }}>Toca un punto para ver las reservas de ese día, semana o mes.</p></div>
        <div className="adm-bar" role="group" aria-label="Agrupar por">
          {(['dia', 'semana', 'mes'] as Granularity[]).map((k) => <button key={k} type="button" className="adm-chip" aria-pressed={g === k} onClick={() => setGran(k)}>{{ dia: 'Por día', semana: 'Por semana', mes: 'Por mes' }[k]}</button>)}
        </div>
      </div>
      <div style={{ marginTop: 12 }}><FlowChart points={points} gran={g} labels={PRO_LABELS} onPick={(t, ids) => setDrill({ title: t, ids })} /></div>
      {drill && <BookingListDrawer title={drill.title} ids={drill.ids} onClose={() => setDrill(null)} />}
    </section>
  );
}

/** Estados de cuenta de la semana: se revisan, se marcan y se aprueban; antes no sale nada. */
function WeeklyStatements() {
  const { data, can } = useAdmin();
  const [batch, setBatch] = useState<StatementBatch | null>(null);
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const muestra = data?.viewer?.email === 'muestra@hululec.com';

  const load = async (rebuild = false) => {
    setBusy(rebuild ? 'rebuild' : 'load'); setMsg('');
    try {
      let b: StatementBatch;
      if (muestra) {
        b = { week: '2026-10-26', status: 'borrador', preparedAt: Date.now(), approvedBy: '', approvedAt: null, sent: 0,
          items: (data?.providers ?? []).slice(0, 6).map((p, i) => ({ proId: p.uid, name: p.name, email: p.email, hasEmail: i !== 4, earned: 120 + i * 31, fees: 18 + i * 4, fines: i === 2 ? 5 : 0, paid: 80 + i * 20, toPay: i % 2 ? 40 : 0, pending: 12 - i * 3, include: i !== 4 })) };
      } else {
        const { adminStatementBatch } = await import('@hulul/shared/firebase');
        b = await adminStatementBatch(undefined, rebuild);
      }
      setBatch(b); setChecked(new Set(b.items.filter((i) => i.include).map((i) => i.proId)));
    } catch (e) { setMsg((e as { message?: string }).message || 'No se pudo cargar.'); } finally { setBusy(''); }
  };
  useEffect(() => {
    if (data) load();
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('estados')) setOpen(true);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async () => {
    if (!batch) return;
    if (!window.confirm(`Se enviará el estado de cuenta en PDF a ${checked.size} profesionales. ¿Continuar?`)) return;
    setBusy('send'); setMsg('');
    try {
      if (muestra) { setMsg(`(Muestra) Se enviarían ${checked.size} estados de cuenta.`); return; }
      const { adminApproveStatements } = await import('@hulul/shared/firebase');
      const r = await adminApproveStatements(batch.week, [...checked]);
      setMsg(`Enviados ${r.sent}.${r.failed.length ? ` No se pudo enviar a: ${r.failed.join(', ')}.` : ''}`);
      load();
    } catch (e) { setMsg((e as { message?: string }).message || 'No se pudo enviar.'); } finally { setBusy(''); }
  };
  const pdf = async (proId: string) => {
    if (muestra) return;
    setBusy(proId);
    try {
      const { adminStatementPdf } = await import('@hulul/shared/firebase');
      const f = await adminStatementPdf(proId);
      const bin = atob(f.content); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      window.open(URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), '_blank');
    } catch (e) { setMsg((e as { message?: string }).message || 'No se pudo abrir el PDF.'); } finally { setBusy(''); }
  };

  const sentState = batch?.status === 'enviado';
  return (
    <>
      <Kpi label="Estados de cuenta de la semana" value={!batch ? (busy ? '…' : '—') : sentState ? `Enviados ${batch.sent}` : `${batch.items.length} por aprobar`}
        hint={!batch ? 'Se preparan el lunes a las 06:00' : sentState ? `Aprobó ${batch.approvedBy}` : 'No sale nada hasta que los apruebes'} onClick={() => setOpen(true)} />
      {open && (
        <Drawer title="Estados de cuenta de la semana" sub={batch ? `Semana del ${fmtWeek(batch.week)} · últimos 30 días de cada profesional` : ''} onClose={() => setOpen(false)}>
          {msg && <div className="adm-note" role="status">{msg}</div>}
          {!batch ? <div className="adm-empty">{busy ? 'Preparando…' : 'Sin datos.'}</div> : (
            <>
              <div className="adm-help">
                <b>{sentState ? 'Ya se enviaron' : 'Revisa y aprueba'}</b>
                <span>{sentState ? `Se enviaron ${batch.sent} estados de cuenta en PDF.` : 'Quita el check a quien no quieras enviar (por ejemplo, si tiene un reclamo abierto). Toca «PDF» para ver exactamente lo que recibirá. Al aprobar, cada uno recibe su PDF por correo.'}</span>
              </div>
              <div className="adm-table-wrap" style={{ border: 'none' }}>
                <table className="adm-table">
                  <thead><tr><th /><th>Profesional</th><th className="num">Ganado</th><th className="num">Comisión</th><th className="num">Depositado</th><th className="num">Saldo</th><th /></tr></thead>
                  <tbody>
                    {batch.items.map((i) => (
                      <tr key={i.proId}>
                        <td><input type="checkbox" aria-label={`Enviar a ${i.name}`} disabled={sentState || !i.hasEmail} checked={sentState ? !!i.sentOk : checked.has(i.proId)}
                          onChange={(e) => setChecked((c) => { const n = new Set(c); if (e.target.checked) n.add(i.proId); else n.delete(i.proId); return n; })} /></td>
                        <td><b>{i.name || '—'}</b><div className="muted" style={{ fontSize: 12 }}>{i.hasEmail ? i.email : 'Sin correo'}{i.fines ? ` · multas ${money(i.fines)}` : ''}</div></td>
                        <td className="num">{money(i.earned)}</td><td className="num">{money(i.fees)}</td><td className="num">{money(i.paid)}</td>
                        <td className="num" style={{ color: i.pending < 0 ? 'var(--bad)' : undefined }}>{money(i.pending)}</td>
                        <td><button type="button" className="adm-btn" disabled={busy === i.proId} onClick={() => pdf(i.proId)}>PDF</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!sentState && can('pagos') && (
                <div className="adm-bar">
                  <button type="button" className="adm-btn solid" disabled={!!busy || !checked.size} onClick={approve}>{busy === 'send' ? 'Enviando…' : `Aprobar y enviar (${checked.size})`}</button>
                  <button type="button" className="adm-btn" disabled={!!busy} onClick={() => load(true)}>{busy === 'rebuild' ? 'Recalculando…' : 'Recalcular'}</button>
                </div>
              )}
            </>
          )}
        </Drawer>
      )}
    </>
  );
}

export function ProvidersPanel() {
  const { view, range, now } = useAdmin();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('aprobado');
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState<Sort>('facturado');
  const [sel, setSel] = useState('');
  const [drill, setDrill] = useState<{ title: string; ids: string[] } | null>(null);

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
            <Kpi accent label="Proveedores en la vista" value={rows.length} hint={`${rows.filter((p) => p.done > 0).length} con trabajos en el periodo`} onClick={() => document.getElementById('lista-proveedores')?.scrollIntoView({ behavior: 'smooth' })} />
            <Kpi label="Facturado por ellos" value={money(totals.billed)} hint={`${totals.done} visitas completadas`} onClick={() => setDrill({ title: 'Visitas completadas de los proveedores', ids: (view.bookings ?? []).filter((b) => b.status === 'completada' && inRange(b.date, range) && rows.some((p) => p.provider.uid === b.proId)).map((b) => b.id) })} />
            <Kpi label="Comisión de HULUL" value={money(totals.commission)} hint="15 % de lo facturado" href="/admin/contabilidad" />
            <Kpi label="Por transferirles" value={money(totals.toPay)} hint="Liquidaciones por pagar" href="/admin/contabilidad?vista=pagar" />
            <WeeklyStatements />
          </div>
          <ProviderTrend title="Cómo van los proveedores" bookings={(view.bookings ?? []).filter((b) => rows.some((p) => p.provider.uid === b.proId))} />
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
            <div className="adm-table-wrap" id="lista-proveedores">
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
      {drill && <BookingListDrawer title={drill.title} ids={drill.ids} onClose={() => setDrill(null)} />}
    </>
  );
}

function ProviderDetail({ p, onBack }: { p: ProviderStats; onBack: () => void }) {
  const { view, range } = useAdmin();
  const [tab, setTab] = useState<'facturas' | 'pagos' | 'actividad'>('actividad');
  const [drill, setDrill] = useState<{ title: string; ids: string[] } | null>(null);
  const v = p.provider;
  const st = STATUS[v.status] ?? STATUS[''];
  const recent = useMemo(() => (view?.bookings ?? []).filter((b) => b.proId === v.uid && inRange(b.date, range)), [view, v.uid, range]);
  const rated = recent.filter((b) => b.rating !== null);
  const avg = rated.length ? rated.reduce((t, b) => t + (b.rating ?? 0), 0) / rated.length : null;
  const outcomes = useMemo(() => OUTCOMES.map((o) => {
    const ids = recent.filter((b) => caseOutcome(b) === o.key).map((b) => b.id);
    return { label: o.label, color: o.color, count: ids.length, onClick: () => setDrill({ title: `${v.name}: ${o.label}`, ids }) };
  }), [recent, v.name]);
  const closed = outcomes.reduce((t, o) => t + o.count, 0);
  const success = recent.filter((b) => caseFlags(b).success).length;
  const ids = (pred: (f: ReturnType<typeof caseFlags>, b: (typeof recent)[number]) => boolean) => recent.filter((b) => pred(caseFlags(b), b)).map((b) => b.id);
  const estimated = p.invoices.some((i) => i.estimated);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const downloadPdf = async () => {
    setBusy('pdf'); setMsg('');
    try {
      const { adminStatementPdf } = await import('@hulul/shared/firebase');
      const f = await adminStatementPdf(v.uid, { desde: range.from, hasta: range.to });
      const bin = atob(f.content); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = f.fileName; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { setMsg((e as { message?: string }).message || 'No se pudo generar el PDF.'); } finally { setBusy(''); }
  };
  const sendMail = async () => {
    if (!window.confirm(`¿Enviar ahora a ${v.name} su estado de cuenta de los últimos 30 días en PDF?`)) return;
    setBusy('mail'); setMsg('');
    try {
      const { adminSendStatement } = await import('@hulul/shared/firebase');
      setMsg(`Estado de cuenta enviado a ${await adminSendStatement(v.uid)}. Además le llega solo cada lunes.`);
    } catch (e) { setMsg((e as { message?: string }).message || 'No se pudo enviar.'); } finally { setBusy(''); }
  };

  const exportInvoices = () => downloadCsv(`hulul-facturas-${v.name.replace(/\s+/g, '-')}-${range.from}_${range.to}.csv`, toCsv(p.invoices.map((i) => ({
    fecha: i.date, reserva: i.code, servicio: catName(i.category), cliente: i.clientName, base: i.base, iva: i.iva, total: i.total, comision_hulul: i.commission, iva_comision: i.commissionIva, estado: i.reversed ? 'anulada' : i.estimated ? 'estimada (sin movimiento)' : 'por emitir',
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
        <div className="adm-grid" style={{ gap: 8, justifyItems: 'stretch' }}>
          <button type="button" className="adm-btn solid" disabled={!!busy} onClick={downloadPdf}>{busy === 'pdf' ? 'Generando…' : 'Estado de cuenta (PDF)'}</button>
          <button type="button" className="adm-btn" disabled={!!busy} onClick={sendMail}>{busy === 'mail' ? 'Enviando…' : 'Enviar por correo'}</button>
          <Link className="adm-btn" href={`/admin/profesionales`}>Ver registro y documentos</Link>
        </div>
      </div>
      {msg && <div className="adm-note" role="status">{msg}</div>}
      {v.suspendedReason && v.suspendedUntil && <div className="adm-err">Suspensión: {v.suspendedReason}</div>}

      <div className="adm-kpis">
        <Kpi accent label="Facturado al cliente" value={money(p.billed.total)} hint={`Base ${money(p.billed.base)} · IVA ${money(p.billed.iva)}${estimated ? ' · estimado' : ''}`} onClick={() => setTab('facturas')} />
        <Kpi label="Comisión de HULUL" value={money(p.commission)} hint={p.fines ? `Multas ${money(p.fines)}` : 'Sin multas'} onClick={() => setTab('facturas')} />
        <Kpi label="Pagado en el periodo" value={money(p.paid)} hint={p.toPay ? `Por transferir ${money(p.toPay)}` : 'Nada por transferir'} onClick={() => setTab('pagos')} />
        <Kpi label="Saldo sin liquidar" value={money(p.pending)} hint={v.cashDebt ? `Deuda de efectivo ${money(v.cashDebt)}` : 'Se liquida el lunes'} href="/admin/contabilidad?vista=pagar" />
        <Kpi label="Trabajos completados" value={p.done} hint={`${p.success} con éxito · ${p.scheduled} programados`} onClick={() => setDrill({ title: `${v.name}: completados`, ids: recent.filter((b) => b.status === 'completada').map((b) => b.id) })} />
        <Kpi label="Calificación de clientes" value={avg !== null ? `★ ${avg.toFixed(2).replace('.', ',')}` : 'Sin calificar'}
          hint={`${rated.length} de ${p.done} trabajos calificados · ${v.strikes30}/3 faltas en 30 días`} onClick={() => setDrill({ title: `${v.name}: calificaciones`, ids: rated.map((b) => b.id) })} />
      </div>
      {p.done > 0 && rated.length === 0 && <div className="adm-note">Ningún cliente ha calificado aún a {v.name.split(' ')[0]}. Desde ahora, la app y la web piden calificar el servicio anterior antes de reservar otro.</div>}

      <div className="adm-tabs" role="tablist">
        <button type="button" role="tab" className="adm-tab" aria-selected={tab === 'actividad'} onClick={() => setTab('actividad')}>Actividad ({recent.length})</button>
        <button type="button" role="tab" className="adm-tab" aria-selected={tab === 'facturas'} onClick={() => setTab('facturas')}>Facturas ({p.invoices.length})</button>
        <button type="button" role="tab" className="adm-tab" aria-selected={tab === 'pagos'} onClick={() => setTab('pagos')}>Liquidaciones ({p.payouts.length})</button>
      </div>

      {tab === 'actividad' && (
        <>
          <ProviderTrend title={`Cómo va ${v.name.split(' ')[0]}`} bookings={recent} />
          <div className="adm-grid g-2">
            <section className="adm-card">
              <h2>Desempeño</h2>
              <p className="sub">Resultado de cada reserva terminada o cancelada en el periodo. Toca una fila para ver los casos.</p>
              {closed ? <Donut items={outcomes} center={percent(success / closed)} sub="de éxito" /> : <div className="adm-empty">Sin reservas terminadas en el periodo.</div>}
            </section>
            <section className="adm-card">
              <h2>Lo que hace</h2>
              <p className="sub">Trabajos completados por categoría en el periodo.</p>
              <HBars items={Object.entries(p.categoriesDone).sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ label: catName(c), value: n, display: n, onClick: () => setDrill({ title: `${v.name}: ${catName(c)}`, ids: recent.filter((b) => b.category === c && b.status === 'completada').map((b) => b.id) }) }))} />
              <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 14px' }}>Registrado en: {v.categories.map((c) => `${catName(c)}${v.catStatus[c] && v.catStatus[c] !== 'aprobado' ? ` (${v.catStatus[c]})` : ''}`).join(', ') || '—'}</p>
              <dl className="adm-kv">
                {([
                  ['Llegó atrasado', p.late, 'var(--warn)', ids((f) => f.late)],
                  ['Mal servicio', p.bad, 'var(--bad)', ids((f) => f.badService)],
                  ['No llegó o canceló', p.cancelledByPro, 'var(--bad)', ids((f) => f.proCancelled || f.proNoShow)],
                  ['Reclamos', p.claims, 'var(--violet)', ids((_, b) => !!b.claim)],
                ] as const).map(([label, n, color, list]) => (
                  <div key={label} style={{ display: 'contents' }}>
                    <dt>{label}</dt>
                    <dd>{n ? <button type="button" className="adm-link-btn" style={{ color }} onClick={() => setDrill({ title: `${v.name}: ${label.toLowerCase()}`, ids: [...list] })}>{n} · ver</button> : 0}</dd>
                  </div>
                ))}
                <dt>Último trabajo</dt><dd>{p.lastJob ? fmtDay(p.lastJob) : '—'}</dd>
                <dt>Próximo trabajo</dt><dd>{p.nextJob ? fmtDay(p.nextJob) : '—'}</dd>
              </dl>
            </section>
          </div>
          <BookingsCrm bookings={recent} />
        </>
      )}

      {tab === 'facturas' && (
        <>
          <div className="adm-bar" style={{ justifyContent: 'space-between' }}>
            <span className="muted" style={{ fontSize: 13 }}>El profesional factura la visita al cliente; HULUL le factura la comisión cada semana.</span>
            <button type="button" className="adm-btn" onClick={exportInvoices} disabled={!p.invoices.length}>Exportar Excel</button>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Fecha</th><th>Reserva</th><th>Servicio</th><th>Cliente</th><th className="num">Base</th><th className="num">IVA</th><th className="num">Total</th><th className="num">Comisión HULUL</th><th>Estado</th></tr></thead>
              <tbody>
                {p.invoices.length ? p.invoices.map((i) => (
                  <tr key={i.bookingId} className="click" style={i.reversed ? { opacity: .55 } : undefined} onClick={() => setDrill({ title: `Reserva ${i.code}`, ids: [i.bookingId] })}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDay(i.date)}</td><td>{i.code}</td><td>{catName(i.category)}</td><td>{i.clientName}</td>
                    <td className="num">{money(i.base)}</td><td className="num">{money(i.iva)}</td><td className="num"><b>{money(i.total)}</b></td><td className="num">{money(i.commission + i.commissionIva)}</td>
                    <td>{i.reversed ? <Badge tone="t-mute">Anulada</Badge> : i.estimated ? <Badge tone="t-info">Estimada</Badge> : <Badge tone="t-warn">Por emitir</Badge>}</td>
                  </tr>
                )) : <tr><td colSpan={9} className="adm-empty">Sin facturas en el periodo.</td></tr>}
              </tbody>
              {p.invoices.length > 0 && <tfoot><tr><td colSpan={4}>Total</td><td className="num">{money(p.billed.base)}</td><td className="num">{money(p.billed.iva)}</td><td className="num">{money(p.billed.total)}</td><td className="num">{money(p.invoices.reduce((t, i) => t + i.commission + i.commissionIva, 0))}</td><td /></tr></tfoot>}
            </table>
          </div>
          {estimated && <div className="adm-note">«Estimada»: la reserva no generó movimientos de dinero (reserva de prueba o anterior al libro de movimientos). El monto se calcula con la tarifa de la reserva; no se cobra ni se liquida.</div>}
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
              )) : <tr><td colSpan={6} className="adm-empty">Aún no tiene liquidaciones. Se arman los lunes con el dinero cobrado con tarjeta.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {drill && <BookingListDrawer title={drill.title} ids={drill.ids} onClose={() => setDrill(null)} />}
    </>
  );
}
