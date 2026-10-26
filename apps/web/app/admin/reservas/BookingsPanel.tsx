'use client';

import { useEffect, useMemo, useState } from 'react';
import { bookingMoney, caseFlags, inRange, stageOf, STAGES, STATUS_LABEL, toCsv, type DashBooking, type Stage } from '@hulul/shared/dashboard';
import { useAdmin } from '../AdminShell';
import { Badge, BookingCard, BookingDetail, catName, downloadCsv, Flags, fmtDay, Loading, money, PageHead, PeriodBar, STAGE_COLOR, STAGE_TONE } from '../ui';

type ViewMode = 'tablero' | 'lista' | 'agenda';
type Issue = 'todos' | 'exito' | 'problema' | 'atrasado' | 'mal_servicio' | 'reportado' | 'reclamo' | 'ausente' | 'falla_pro';

const ISSUE_LABEL: Record<Issue, string> = {
  todos: 'Todos los casos', exito: 'Solo éxitos', problema: 'Con algún problema', atrasado: 'Llegaron atrasados', mal_servicio: 'Mal servicio',
  reportado: 'Clientes reportados', reclamo: 'Con reclamo', ausente: 'Cliente ausente', falla_pro: 'Profesional no llegó o canceló',
};

function matchIssue(b: DashBooking, issue: Issue) {
  if (issue === 'todos') return true;
  const f = caseFlags(b);
  switch (issue) {
    case 'exito': return f.success;
    case 'problema': return f.closed && !f.success;
    case 'atrasado': return f.late;
    case 'mal_servicio': return f.badService;
    case 'reportado': return f.clientReported;
    case 'reclamo': return !!b.claim;
    case 'ausente': return f.clientAbsent;
    case 'falla_pro': return f.proCancelled || f.proNoShow;
    default: return true;
  }
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function BookingsPanel() {
  const { view, range } = useAdmin();
  const [mode, setMode] = useState<ViewMode>('tablero');
  const [stage, setStage] = useState<Stage | 'todas'>('todas');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [pay, setPay] = useState('');
  const [issue, setIssue] = useState<Issue>('todos');
  const [open, setOpen] = useState<DashBooking | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const e = sp.get('etapa') as Stage | null;
    if (e && STAGES.some((s) => s.key === e)) { setStage(e); setMode('lista'); }
    try { const m = localStorage.getItem('hulul-admin-reservas-vista') as ViewMode | null; if (m && !e) setMode(m); } catch { /* sin almacenamiento */ }
  }, []);
  const pickMode = (m: ViewMode) => { setMode(m); try { localStorage.setItem('hulul-admin-reservas-vista', m); } catch { /* sin almacenamiento */ } };

  const inPeriod = useMemo(() => (view?.bookings ?? []).filter((b) => inRange(b.date, range)), [view, range]);
  const cats = useMemo(() => [...new Set(inPeriod.map((b) => b.category))].sort((a, b) => catName(a).localeCompare(catName(b))), [inPeriod]);
  const pays = useMemo(() => [...new Set(inPeriod.map((b) => b.paymentMethod).filter(Boolean))], [inPeriod]);

  const rows = useMemo(() => {
    const nq = norm(q.trim());
    return inPeriod.filter((b) =>
      (!cat || b.category === cat) && (!pay || b.paymentMethod === pay) && matchIssue(b, issue)
      && (!nq || norm(`${b.code} ${b.clientName} ${b.proName} ${catName(b.category)} ${b.id}`).includes(nq)));
  }, [inPeriod, q, cat, pay, issue]);

  const byStage = useMemo(() => {
    const m: Record<Stage, DashBooking[]> = { programada: [], ejecucion: [], ejecutada: [], reclamo: [], cancelada: [] };
    for (const b of rows) m[stageOf(b)].push(b);
    for (const k of Object.keys(m) as Stage[]) m[k].sort((a, z) => (k === 'programada' || k === 'ejecucion' ? (a.at ?? 0) - (z.at ?? 0) : (z.at ?? 0) - (a.at ?? 0)));
    return m;
  }, [rows]);

  const listRows = useMemo(() => (stage === 'todas' ? rows : rows.filter((b) => stageOf(b) === stage)).slice().sort((a, z) => (z.at ?? 0) - (a.at ?? 0)), [rows, stage]);

  const exportCsv = () => {
    const data = listRows.map((b) => {
      const m = bookingMoney(b); const f = caseFlags(b);
      return {
        codigo: b.code, fecha: b.date, hora: b.slot, categoria: catName(b.category), cliente: b.clientName, profesional: b.proName,
        estado: STATUS_LABEL[b.status] ?? b.status, etapa: STAGES.find((s) => s.key === stageOf(b))?.label ?? '', pago: b.paymentMethod,
        visita: b.visit, recargo: b.surcharge, cargo_plataforma: b.fee, iva: b.iva, total: b.total, adicional: m.extra, ingreso_hulul: m.hulul, para_profesional: m.pro,
        atraso_min: f.lateMin ?? '', exito: f.success ? 'sí' : '', atrasado: f.late ? 'sí' : '', mal_servicio: f.badService ? 'sí' : '', cliente_reportado: f.clientReported ? 'sí' : '',
        reclamo: b.claim ? `${b.claim.openedBy}: ${b.claim.kindLabel}` : '', calificacion: b.rating ?? '',
      };
    });
    const cols = Object.keys(data[0] ?? { codigo: '' }).map((k) => ({ key: k, label: k.replace(/_/g, ' ') }));
    downloadCsv(`hulul-reservas-${range.from}_${range.to}.csv`, toCsv(data, cols));
  };

  const agenda = useMemo(() => {
    const m = new Map<string, DashBooking[]>();
    for (const b of listRows.slice().sort((a, z) => (a.at ?? 0) - (z.at ?? 0))) m.set(b.date, [...(m.get(b.date) ?? []), b]);
    return [...m.entries()];
  }, [listRows]);

  return (
    <>
      <PageHead title="Reservas" lead="Cada transacción antes, durante y después: programadas, en ejecución y ejecutadas.">
        <div className="adm-bar" role="group" aria-label="Vista">
          {(['tablero', 'lista', 'agenda'] as ViewMode[]).map((m) => <button key={m} type="button" className="adm-chip" aria-pressed={mode === m} onClick={() => pickMode(m)}>{{ tablero: 'Tablero', lista: 'Lista', agenda: 'Por día' }[m]}</button>)}
        </div>
      </PageHead>
      <PeriodBar />
      {!view ? <Loading /> : (
        <>
          <div className="adm-bar">
            <input className="adm-input adm-search" type="search" placeholder="Buscar cliente, profesional o código" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="adm-select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría">
              <option value="">Todas las categorías</option>
              {cats.map((c) => <option key={c} value={c}>{catName(c)}</option>)}
            </select>
            <select className="adm-select" value={issue} onChange={(e) => setIssue(e.target.value as Issue)} aria-label="Resultado">
              {(Object.keys(ISSUE_LABEL) as Issue[]).map((k) => <option key={k} value={k}>{ISSUE_LABEL[k]}</option>)}
            </select>
            <select className="adm-select" value={pay} onChange={(e) => setPay(e.target.value)} aria-label="Forma de pago">
              <option value="">Toda forma de pago</option>
              {pays.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button type="button" className="adm-btn" onClick={exportCsv} disabled={!listRows.length}>Exportar CSV</button>
          </div>

          {mode !== 'tablero' && (
            <div className="adm-bar" role="group" aria-label="Etapa">
              <button type="button" className="adm-chip" aria-pressed={stage === 'todas'} onClick={() => setStage('todas')}>Todas ({rows.length})</button>
              {STAGES.map((s) => <button key={s.key} type="button" className="adm-chip" aria-pressed={stage === s.key} onClick={() => setStage(s.key)}>{s.label} ({byStage[s.key].length})</button>)}
            </div>
          )}

          {rows.length === 0 ? <div className="adm-card adm-empty">No hay reservas con estos filtros en el periodo.</div> : mode === 'tablero' ? (
            <div className="adm-board">
              {STAGES.map((s) => (
                <section key={s.key} className="adm-col" aria-label={s.label}>
                  <div className="adm-col-head" style={{ ['--c' as string]: STAGE_COLOR[s.key] }}>
                    <span>{s.label} <small>· {byStage[s.key].length}</small></span>
                    <small>{money(byStage[s.key].reduce((t, b) => t + bookingMoney(b).gross, 0))}</small>
                  </div>
                  <div className="adm-col-body">
                    {byStage[s.key].length === 0 ? <p className="muted" style={{ fontSize: 13, margin: '6px 4px' }}>{s.help}.</p>
                      : byStage[s.key].slice(0, 150).map((b) => <BookingCard key={b.id} b={b} onOpen={setOpen} />)}
                    {byStage[s.key].length > 150 && <p className="muted" style={{ fontSize: 12.5 }}>Se muestran 150. Usa la lista o los filtros.</p>}
                  </div>
                </section>
              ))}
            </div>
          ) : mode === 'lista' ? (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Código</th><th>Fecha</th><th>Servicio</th><th>Cliente</th><th>Profesional</th><th>Estado</th><th className="num">Total</th><th className="num">HULUL</th><th>Marcas</th></tr></thead>
                <tbody>
                  {listRows.slice(0, 500).map((b) => {
                    const m = bookingMoney(b); const st = stageOf(b);
                    return (
                      <tr key={b.id} className="click" onClick={() => setOpen(b)}>
                        <td><b>{b.code}</b></td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDay(b.date)} {b.slot}</td>
                        <td>{catName(b.category)}</td>
                        <td>{b.clientName}</td>
                        <td>{b.proName}</td>
                        <td><Badge tone={STAGE_TONE[st]}>{STATUS_LABEL[b.status] ?? b.status}</Badge></td>
                        <td className="num">{money(m.gross)}</td>
                        <td className="num">{money(m.hulul)}</td>
                        <td><Flags b={b} /></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot><tr><td colSpan={6}>{listRows.length} reservas</td><td className="num">{money(listRows.reduce((t, b) => t + bookingMoney(b).gross, 0))}</td><td className="num">{money(listRows.reduce((t, b) => t + bookingMoney(b).hulul, 0))}</td><td /></tr></tfoot>
              </table>
            </div>
          ) : (
            <div className="adm-grid">
              {agenda.map(([day, list]) => (
                <section key={day} className="adm-grid" style={{ gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 15, textTransform: 'capitalize' }}>{fmtDay(day)} <span className="muted" style={{ fontWeight: 600 }}>· {list.length} {list.length === 1 ? 'reserva' : 'reservas'}</span></h2>
                  <div className="adm-cards">{list.map((b) => <BookingCard key={b.id} b={b} onOpen={setOpen} showStage />)}</div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
      {open && <BookingDetail b={open} onClose={() => setOpen(null)} />}
    </>
  );
}
