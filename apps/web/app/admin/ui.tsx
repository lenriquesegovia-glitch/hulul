'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCategory } from '@hulul/shared';
import {
  bookingInvoices, bookingMoney, caseFlags, caseOutcome, money, OUTCOMES, PERIOD_LABEL, percent, stageOf, STATUS_LABEL,
  type DashBooking, type PeriodKey, type Stage,
} from '@hulul/shared/dashboard';
import { useAdmin } from './AdminShell';

/* --------------------------------- Formatos --------------------------------- */

export const catName = (slug: string) => { try { return getCategory(slug as never)?.name ?? slug; } catch { return slug || '—'; } };
const TZ = 'America/Guayaquil';
export const fmtDay = (iso: string) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-EC', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }) : '—');
export const fmtWhen = (ms: number | null) => (ms ? new Date(ms).toLocaleString('es-EC', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtTime = (ms: number | null) => (ms ? new Date(ms).toLocaleTimeString('es-EC', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtWeek = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-EC', { timeZone: 'UTC', day: 'numeric', month: 'short' });
export { money, percent };
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

export const STAGE_COLOR: Record<Stage, string> = { programada: '#1F4E79', ejecucion: '#C98A1B', ejecutada: '#206344', reclamo: '#6A3A8C', cancelada: '#8FA6A3' };
export const STAGE_TONE: Record<Stage, string> = { programada: 't-info', ejecucion: 't-warn', ejecutada: 't-ok', reclamo: 't-violet', cancelada: 't-mute' };

/** Descarga un archivo de texto tal cual (p. ej., el archivo del banco). */
export function downloadText(name: string, content: string, mime = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Lee el CSV que arma toCsv (';', comillas, coma decimal) para pasarlo a Excel. */
function parseCsv(csv: string): string[][] {
  const text = csv.replace(/^\ufeff/, '');
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === ';') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell); rows.push(row);
  return rows;
}

/** Exporta a Excel (.xlsx) las tablas del panel (antes CSV). */
export async function downloadCsv(name: string, csv: string) {
  const [head, ...body] = parseCsv(csv);
  const isNum = (v: string) => /^-?(0|[1-9]\d*)(,\d+)?$/.test(v);
  const moneyCols = head.map((_, k) => body.some((r) => /,\d{1,2}$/.test(r[k] ?? '')) && body.every((r) => !r[k] || isNum(r[k])));
  const { downloadXlsx } = await import('./excel');
  await downloadXlsx(name.replace(/\.csv$/, '.xlsx'), [{
    name: 'Datos',
    columns: head.map((h, k) => ({ key: String(k), header: h.charAt(0).toUpperCase() + h.slice(1), money: moneyCols[k] })),
    rows: body.map((r) => Object.fromEntries(r.map((v, k) => [String(k), isNum(v) ? Number(v.replace(',', '.')) : v]))),
    totals: head.map((_, k) => String(k)).filter((k) => moneyCols[Number(k)]),
  }]);
}

/* --------------------------------- Encabezado -------------------------------- */

export function PageHead({ title, lead, children }: { title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <div className="adm-top">
      <div><h1>{title}</h1>{lead && <p>{lead}</p>}</div>
      {children && <div className="adm-bar">{children}</div>}
    </div>
  );
}

const PERIODS: PeriodKey[] = ['hoy', 'semana', 'proxima_semana', 'mes', 'proximo_mes', 'ultimos_30', 'ultimos_90', 'todo', 'personalizado'];

/** Periodo (compartido por todas las pestañas), recarga y opción de incluir pruebas. */
export function PeriodBar({ only }: { only?: PeriodKey[] }) {
  const { period, setPeriod, custom, setCustom, range, reload, loading, data, includeTests, setIncludeTests, error } = useAdmin();
  const list = only ?? PERIODS;
  return (
    <div className="adm-grid" style={{ gap: 8 }}>
      <div className="adm-bar" role="group" aria-label="Periodo">
        {list.map((p) => (
          <button key={p} type="button" className="adm-chip" aria-pressed={period === p} onClick={() => setPeriod(p)}>{PERIOD_LABEL[p]}</button>
        ))}
        {period === 'personalizado' && (
          <>
            <input className="adm-input" type="date" aria-label="Desde" value={custom.from || range.from} onChange={(e) => setCustom({ from: e.target.value, to: custom.to || range.to })} />
            <input className="adm-input" type="date" aria-label="Hasta" value={custom.to || range.to} onChange={(e) => setCustom({ from: custom.from || range.from, to: e.target.value })} />
          </>
        )}
      </div>
      <div className="adm-bar" style={{ justifyContent: 'space-between' }}>
        <span className="adm-range">
          {period === 'todo' ? `Todo lo cargado (${data ? `${fmtDay(data.range.from)} – ${fmtDay(data.range.to)}` : '…'})` : `${fmtDay(range.from)} – ${fmtDay(range.to)}`}
          {data && ` · actualizado ${fmtTime(data.generatedAt)}`}
        </span>
        <span className="adm-bar">
          <label className="adm-toggle"><input type="checkbox" checked={includeTests} onChange={(e) => setIncludeTests(e.target.checked)} /> Incluir pruebas</label>
          <button type="button" className="adm-btn" onClick={reload} disabled={loading}>{loading ? 'Cargando…' : 'Actualizar'}</button>
        </span>
      </div>
      {error && <div className="adm-err" role="alert">{error}</div>}
    </div>
  );
}

/** Mientras no hay datos. */
export function Loading() {
  const { error } = useAdmin();
  if (error) return null;
  return <div className="adm-kpis">{[1, 2, 3, 4].map((i) => <div key={i} className="adm-skel" />)}</div>;
}

/* -------------------------------- Indicadores -------------------------------- */

export function Kpi({ label, value, hint, accent, onClick, href, detail, selected }: { label: string; value: React.ReactNode; hint?: React.ReactNode; accent?: boolean; onClick?: () => void; href?: string; detail?: () => void; selected?: boolean }) {
  if (detail) {
    // Tarjeta que filtra la curva al tocarla; «Ver reservas» abre la lista.
    return (
      <div role="button" tabIndex={0} aria-pressed={!!selected} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(); }} className={`adm-kpi click${accent ? ' accent' : ''}${selected ? ' selected' : ''}`}>
        <span>{label}</span><b>{value}</b>{hint && <small>{hint}</small>}
        <span className="row gap-8" style={{ justifyContent: 'space-between' }}>
          <i className="adm-kpi-go">{selected ? 'En la curva ✓' : 'Ver en la curva'}</i>
          <button type="button" className="adm-kpi-link" onClick={(e) => { e.stopPropagation(); detail(); }}>Ver reservas →</button>
        </span>
      </div>
    );
  }
  const body = <><span>{label}</span><b>{value}</b>{hint && <small>{hint}</small>}{(onClick || href) && <i className="adm-kpi-go" aria-hidden="true">Ver detalle →</i>}</>;
  if (href) return <Link href={href} className={`adm-kpi click${accent ? ' accent' : ''}`}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={`adm-kpi click${accent ? ' accent' : ''}`}>{body}</button>;
  return <div className={`adm-kpi${accent ? ' accent' : ''}`}>{body}</div>;
}

export function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`adm-badge ${tone}`}>{children}</span>;
}

/* ---------------------------------- Gráficos --------------------------------- */

/** Pastel (anillo) con leyenda: cantidad y porcentaje de cada parte. */
export function Donut({ items, center, sub }: { items: { label: string; color: string; count: number; onClick?: () => void }[]; center: React.ReactNode; sub: string }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  const R = 70, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="adm-donut">
      <svg viewBox="0 0 200 200" width="200" height="200" role="img" aria-label={items.map((i) => `${i.label}: ${i.count}`).join(', ')}>
        <circle cx="100" cy="100" r={R} fill="none" stroke="#EEF1F0" strokeWidth="26" />
        {total > 0 && items.filter((i) => i.count > 0).map((i) => {
          const len = (i.count / total) * C;
          const el = <circle key={i.label} cx="100" cy="100" r={R} fill="none" stroke={i.color} strokeWidth="26" strokeDasharray={`${Math.max(0, len - (items.filter((x) => x.count > 0).length > 1 ? 2 : 0))} ${C}`} strokeDashoffset={-acc} transform="rotate(-90 100 100)"><title>{`${i.label}: ${i.count} (${percent(i.count / total)})`}</title></circle>;
          acc += len;
          return el;
        })}
        <text x="100" y="98" textAnchor="middle" fontSize="30" fontWeight="800" fill="var(--text)">{center}</text>
        <text x="100" y="120" textAnchor="middle" fontSize="12" fill="var(--muted)">{sub}</text>
      </svg>
      <ul className="adm-legend">
        {items.map((i) => (
          <li key={i.label} className={`${i.count ? '' : 'zero'}${i.onClick && i.count ? ' adm-clickrow' : ''}`} {...(i.onClick && i.count ? { role: 'button', tabIndex: 0, onClick: i.onClick } : {})}>
            <i style={{ background: i.color }} /><span>{i.label}</span><span className="n">{i.count}</span><span className="p">{total ? percent(i.count / total) : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontales. */
export function HBars({ items, max }: { items: { label: string; value: number; display: React.ReactNode; color?: string; parts?: { value: number; color: string }[]; onClick?: () => void }[]; max?: number }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <div className="adm-empty">Sin datos en este periodo.</div>;
  return (
    <div className="adm-hbars">
      {items.map((i, k) => (
        <div key={`${i.label}-${k}`} className={`adm-hbar${i.onClick ? ' adm-clickrow' : ''}`} {...(i.onClick ? { role: 'button', tabIndex: 0, onClick: i.onClick, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') i.onClick!(); } } : {})}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.label}>{i.label}</span>
          <span className="track">
            {i.parts ? i.parts.map((p, k) => <span key={k} className="fill" style={{ width: `${(p.value / top) * 100}%`, background: p.color }} />)
              : <span className="fill" style={{ width: `${(i.value / top) * 100}%`, background: i.color ?? 'var(--primary)' }} />}
          </span>
          <b>{i.display}</b>
        </div>
      ))}
    </div>
  );
}

/** Columnas por semana, apiladas. */
export function WeekBars({ weeks, legend, format }: { weeks: { week: string; parts: { value: number; color: string; label: string }[] }[]; legend: { label: string; color: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...weeks.map((w) => w.parts.reduce((s, p) => s + p.value, 0)));
  if (!weeks.length) return <div className="adm-empty">Sin datos en este periodo.</div>;
  const shown = weeks.slice(-14);
  return (
    <div className="adm-grid" style={{ gap: 8 }}>
      <div className="adm-weeks">
        {shown.map((w) => {
          const tot = w.parts.reduce((s, p) => s + p.value, 0);
          return (
            <div key={w.week} className="adm-week" title={`Semana del ${fmtWeek(w.week)}: ${w.parts.map((p) => `${p.label} ${p.value}`).join(', ')}`}>
              <small style={{ fontWeight: 700, color: 'var(--text-2)' }}>{tot ? (format ? format(tot) : tot) : ''}</small>
              <div className="stack" style={{ height: `calc((100% - 36px) * ${tot / max})` }}>
                {w.parts.map((p, k) => <span key={k} style={{ flex: p.value, background: p.color }} />)}
              </div>
              <small>{fmtWeek(w.week)}</small>
            </div>
          );
        })}
      </div>
      <div className="adm-bar" style={{ fontSize: 12.5, color: 'var(--muted)' }}>
        {legend.map((l) => <span key={l.label} className="row gap-4"><i style={{ width: 10, height: 10, borderRadius: 3, background: l.color, display: 'inline-block' }} />{l.label}</span>)}
      </div>
    </div>
  );
}

/* ------------------------------ Tarjetas de reservas ----------------------------- */

/** Etiquetas de lo que pasó en la reserva (atraso, mal servicio, reclamo…). */
export function Flags({ b }: { b: DashBooking }) {
  const f = caseFlags(b);
  const out: React.ReactNode[] = [];
  if (f.success) out.push(<Badge key="ok" tone="t-ok">Éxito</Badge>);
  if (f.late) out.push(<Badge key="late" tone="t-warn">Atrasado{f.lateMin && f.lateMin > 0 ? ` ${f.lateMin} min` : ''}</Badge>);
  else if (f.delayAnnounced) out.push(<Badge key="del" tone="t-warm">Avisó retraso</Badge>);
  if (f.badService) out.push(<Badge key="bad" tone="t-bad">Mal servicio</Badge>);
  if (f.proNoShow) out.push(<Badge key="ns" tone="t-bad">No se presentó</Badge>);
  else if (f.proCancelled) out.push(<Badge key="pc" tone="t-bad">Canceló el profesional</Badge>);
  if (f.clientAbsent) out.push(<Badge key="abs" tone="t-warm">Cliente ausente</Badge>);
  if (f.clientCancelled) out.push(<Badge key="cc" tone="t-mute">Canceló el cliente</Badge>);
  if (f.clientReported) out.push(<Badge key="rep" tone="t-bad">Cliente reportado</Badge>);
  if (b.claim) out.push(<Badge key="cl" tone="t-violet">Reclamo {b.claim.status === 'resuelto' ? 'resuelto' : 'abierto'}</Badge>);
  if (b.surcharge > 0) out.push(<Badge key="sc" tone="t-info">{b.surchargeKind === 'feriado' ? 'Feriado' : 'Nocturno'}</Badge>);
  if (b.rating) out.push(<Badge key="r" tone={b.rating >= 4 ? 't-ok' : b.rating <= 2 ? 't-bad' : 't-warm'}>★ {b.rating}</Badge>);
  return out.length ? <div className="flags">{out}</div> : null;
}

export function BookingCard({ b, onOpen, showStage }: { b: DashBooking; onOpen: (b: DashBooking) => void; showStage?: boolean }) {
  const st = stageOf(b);
  return (
    <button type="button" className="adm-tcard" style={{ ['--c' as string]: STAGE_COLOR[st] }} onClick={() => onOpen(b)}>
      <span className="l1"><span>{b.code}</span>{showStage ? <Badge tone={STAGE_TONE[st]}>{STATUS_LABEL[b.status] ?? b.status}</Badge> : <span>{STATUS_LABEL[b.status] ?? b.status}</span>}</span>
      <span className="l3" style={{ fontWeight: 700, textTransform: 'capitalize' }}>{fmtDay(b.date)} · {b.slot}</span>
      <span className="l2">{catName(b.category)}</span>
      <span className="l3">{b.clientName || 'Cliente'} → {b.proName || 'Profesional'}</span>
      <span className="l1" style={{ color: 'var(--text)' }}><span className="money">{money(bookingMoney(b).gross)}</span><span style={{ fontWeight: 600 }}>{b.paymentMethod}</span></span>
      <Flags b={b} />
    </button>
  );
}

/* ------------------------------ Detalle de una reserva ----------------------------- */

export function Drawer({ title, sub, onClose, children }: { title: React.ReactNode; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <>
      <div className="adm-drawer-bg" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-modal="true">
        <header>
          <div><h2>{title}</h2>{sub && <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>{sub}</div>}</div>
          <button type="button" className="adm-x" aria-label="Cerrar" onClick={onClose}>×</button>
        </header>
        <div className="body">{children}</div>
      </aside>
    </>
  );
}

const CANCEL_BY: Record<string, string> = {
  cliente: 'el cliente', profesional: 'el profesional', sistema: 'el sistema', cliente_ausente: 'cliente ausente (cobro de visita)', profesional_tarde: 'el profesional llegó tarde',
};

export function BookingDetail({ b, onClose }: { b: DashBooking; onClose: () => void }) {
  const { can } = useAdmin();
  const f = caseFlags(b);
  const m = bookingMoney(b);
  const out = caseOutcome(b, f);
  const outInfo = OUTCOMES.find((o) => o.key === out);
  const st = stageOf(b);
  const events: { label: string; at: number | null; color?: string }[] = [
    { label: 'Reserva creada', at: b.createdAt },
    { label: `Cita: ${fmtDay(b.date)} ${b.slot}`, at: b.at, color: '#1F4E79' },
    { label: f.lateMin !== null ? `Llegó a la dirección (${f.lateMin > 0 ? `${f.lateMin} min tarde` : 'a tiempo'})` : '', at: b.arrivedAt, color: f.late ? '#C98A1B' : '#206344' },
    { label: 'Empezó el trabajo', at: b.startedAt },
    { label: 'Terminó', at: b.finishedAt, color: '#206344' },
    { label: `Cancelada por ${CANCEL_BY[b.cancelledBy] ?? b.cancelledBy}`, at: b.cancelledAt, color: '#B42318' },
    { label: b.claim ? `Reclamo del ${b.claim.openedBy}${b.claim.kindLabel ? `: ${b.claim.kindLabel}` : ''}` : '', at: b.claim?.openedAt ?? null, color: '#6A3A8C' },
  ].filter((e) => e.label && e.at);
  events.sort((a, z) => (a.at ?? 0) - (z.at ?? 0));
  return (
    <Drawer title={`${catName(b.category)} · ${b.code}`} sub={<Badge tone={STAGE_TONE[st]}>{STATUS_LABEL[b.status] ?? b.status}</Badge>} onClose={onClose}>
      {outInfo && <div className="adm-card" style={{ borderLeft: `5px solid ${outInfo.color}`, padding: 14 }}><b>Resultado: {outInfo.label}</b><Flags b={b} /></div>}
      {!outInfo && <Flags b={b} />}
      <div className="adm-card">
        <h3 style={{ marginBottom: 10 }}>Partes</h3>
        <dl className="adm-kv">
          <dt>Cliente</dt><dd>{can('clientes') ? <Link href={`/admin/clientes?id=${encodeURIComponent(b.clientId)}`}>{b.clientName || '—'}</Link> : (b.clientName || '—')} <span className="muted" style={{ fontWeight: 500 }}>{b.clientPhone}</span></dd>
          <dt>Profesional</dt><dd><Link href={`/admin/proveedores?id=${encodeURIComponent(b.proId)}`}>{b.proName || '—'}</Link></dd>
          <dt>Origen</dt><dd>{b.source === 'app' ? 'App' : 'Web'}</dd>
          {b.rating !== null && <><dt>Calificación al profesional</dt><dd>★ {b.rating}</dd></>}
          {b.clientStars !== null && <><dt>Calificación al cliente (privada)</dt><dd>★ {b.clientStars}</dd></>}
          {b.outcome && <><dt>Resultado que marcó el profesional</dt><dd>{{ resuelto: 'Resuelto', parcial: 'Necesita más trabajo', no_resuelto: 'No se pudo resolver' }[b.outcome] ?? b.outcome}</dd></>}
          {b.photos > 0 && <><dt>Fotos del diagnóstico</dt><dd>{b.photos}</dd></>}
          {b.rings > 0 && <><dt>Timbres al cliente</dt><dd>{b.rings}</dd></>}
        </dl>
      </div>
      <div className="adm-card">
        <h3 style={{ marginBottom: 10 }}>Línea de tiempo</h3>
        <ol className="adm-timeline">
          {events.map((e, i) => <li key={i} style={{ ['--c' as string]: e.color }}><span>{e.label}</span><time>{fmtWhen(e.at)}</time></li>)}
        </ol>
        {b.cancelReason && <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>Motivo: {b.cancelReason}</p>}
      </div>
      <div className="adm-card">
        <h3 style={{ marginBottom: 10 }}>Dinero</h3>
        <dl className="adm-kv">
          <dt>Visita</dt><dd>{money(b.visit)}</dd>
          {b.surcharge > 0 && <><dt>Recargo {b.surchargeKind}</dt><dd>{money(b.surcharge)}</dd></>}
          <dt>Cargo de plataforma</dt><dd>{money(b.fee)}</dd>
          <dt>IVA</dt><dd>{money(b.iva)}</dd>
          <dt>Total de la reserva</dt><dd>{money(b.total)}</dd>
          {m.extra > 0 && <><dt>Cobro adicional ({b.extra?.method})</dt><dd>{money(m.extra)}</dd></>}
          {b.cancelFee > 0 && <><dt>Cargo de cancelación</dt><dd>{money(b.cancelFee)}</dd></>}
          {b.proFine > 0 && <><dt>Multa al profesional</dt><dd>{money(b.proFine)}</dd></>}
          {b.clientCredit > 0 && <><dt>Crédito al cliente</dt><dd>{money(b.clientCredit)}</dd></>}
          <dt style={{ fontWeight: 800 }}>Ingreso HULUL {st === 'programada' || st === 'ejecucion' ? '(estimado)' : ''}</dt><dd className="big">{money(m.hulul)}</dd>
          <dt>Para el profesional</dt><dd>{money(m.pro)}</dd>
          <dt>Forma de pago</dt><dd>{b.paymentMethod || '—'}</dd>
        </dl>
      </div>
      <InvoicesCard b={b} />
      {b.claim && (
        <div className="adm-card" style={{ borderLeft: '5px solid #6A3A8C' }}>
          <h3 style={{ marginBottom: 10 }}>Reclamo</h3>
          <dl className="adm-kv">
            <dt>Lo abrió</dt><dd>{b.claim.openedBy === 'profesional' ? 'El profesional' : 'El cliente'}</dd>
            {b.claim.kindLabel && <><dt>Motivo</dt><dd>{b.claim.kindLabel}</dd></>}
            <dt>Estado</dt><dd>{b.claim.status === 'resuelto' ? 'Resuelto' : b.claim.status === 'esperando_respuesta' ? 'Esperando la respuesta de la otra parte' : 'En revisión de HULUL'}</dd>
            {b.claim.openedAt && <><dt>Abierto</dt><dd>{fmtWhen(b.claim.openedAt)}</dd></>}
            {b.claim.resolveDueAt && b.claim.status !== 'resuelto' && <><dt>HULUL decide hasta</dt><dd>{fmtWhen(b.claim.resolveDueAt)}</dd></>}
            {b.claim.outcome && <><dt>Decisión</dt><dd>A favor del {b.claim.outcome === 'cliente' ? 'cliente' : 'profesional'}</dd></>}
          </dl>
          {b.claim.text && <div className="adm-quote" style={{ borderColor: '#6A3A8C', marginTop: 10 }}><p>«{b.claim.text}»</p><small>Lo que escribió {b.claim.openedBy === 'profesional' ? 'el profesional' : 'el cliente'}</small></div>}
          {b.claim.response && <div className="adm-quote" style={{ borderColor: '#9AA8A5', marginTop: 8 }}><p>«{b.claim.response}»</p><small>Respuesta de la otra parte</small></div>}
          {b.claim.decisionNote && <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>Motivo de la decisión: {b.claim.decisionNote}</p>}
          {b.claim.formal === false && <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>Reclamo anterior al expediente: se resuelve en la consola o pidiendo que lo vuelvan a abrir.</p>}
          {can('reclamos') && b.claim.formal !== false && <Link className="adm-btn solid" style={{ marginTop: 12, justifySelf: 'start' }} href={`/admin/reclamos?caso=${encodeURIComponent(b.id)}`}>Abrir el expediente completo (chat, evidencia, decidir)</Link>}
        </div>
      )}
      {can('reclamos') && <BookingPhotos b={b} />}
    </Drawer>
  );
}

/* --------------------------- Lista que se abre al hacer clic --------------------------- */

/** Abre las reservas que forman un número del panel, para validarlo una por una. */
export function BookingListDrawer({ title, ids, onClose }: { title: string; ids: string[]; onClose: () => void }) {
  const { view } = useAdmin();
  const [open, setOpen] = useState<DashBooking | null>(null);
  const set = new Set(ids);
  const list = (view?.bookings ?? []).filter((b) => set.has(b.id)).sort((a, z) => (z.at ?? 0) - (a.at ?? 0));
  const total = list.reduce((t, b) => t + bookingMoney(b).gross, 0);
  if (open) return <BookingDetail b={open} onClose={() => setOpen(null)} />;
  return (
    <Drawer title={title} sub={`${list.length} ${list.length === 1 ? 'reserva' : 'reservas'} · ${money(total)}`} onClose={onClose}>
      {list.length ? <div className="adm-grid" style={{ gap: 10 }}>{list.map((b) => <BookingCard key={b.id} b={b} onOpen={setOpen} showStage />)}</div>
        : <div className="adm-empty">No hay reservas en este grupo.</div>}
    </Drawer>
  );
}

/* --------------------------- Mini CRM de reservas (tarjetas) --------------------------- */

type CrmView = 'fecha' | 'tablero' | 'linea';
const CRM_VIEWS: { key: CrmView; label: string }[] = [{ key: 'fecha', label: 'Por fecha' }, { key: 'tablero', label: 'Tablero' }, { key: 'linea', label: 'Línea de tiempo' }];

/**
 * Reservas de una persona (profesional o cliente) como mini CRM: filtro por etapa,
 * vista por fecha, tablero por etapa (tipo Bitrix) o línea de tiempo por día (tipo Gantt).
 */
export function BookingsCrm({ bookings }: { bookings: DashBooking[] }) {
  const [view, setView] = useState<CrmView>('fecha');
  const [stage, setStage] = useState<Stage | 'todas'>('todas');
  const [open, setOpen] = useState<DashBooking | null>(null);
  const counts = STAGES_ALL.map((s) => ({ ...s, n: bookings.filter((b) => stageOf(b) === s.key).length }));
  const list = bookings.filter((b) => stage === 'todas' || stageOf(b) === stage).sort((a, z) => (z.at ?? 0) - (a.at ?? 0));
  const byDay = new Map<string, DashBooking[]>();
  for (const b of list) byDay.set(b.date, [...(byDay.get(b.date) ?? []), b]);
  const days = [...byDay.entries()];

  return (
    <div className="adm-grid" style={{ gap: 12 }}>
      <div className="adm-bar" style={{ justifyContent: 'space-between' }}>
        <div className="adm-bar" role="group" aria-label="Etapa">
          <button type="button" className="adm-chip" aria-pressed={stage === 'todas'} onClick={() => setStage('todas')}>Todas ({bookings.length})</button>
          {counts.map((s) => <button key={s.key} type="button" className="adm-chip" aria-pressed={stage === s.key} onClick={() => setStage(s.key)} disabled={!s.n}>{s.label} ({s.n})</button>)}
        </div>
        <div className="adm-bar" role="group" aria-label="Vista">
          {CRM_VIEWS.map((v) => <button key={v.key} type="button" className="adm-chip" aria-pressed={view === v.key} onClick={() => setView(v.key)}>{v.label}</button>)}
        </div>
      </div>
      {!list.length ? <div className="adm-card adm-empty">Sin reservas con este filtro en el periodo.</div> : view === 'fecha' ? (
        days.map(([day, items]) => (
          <section key={day} className="adm-grid" style={{ gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14.5, textTransform: 'capitalize' }}>{fmtDay(day)} <span className="muted" style={{ fontWeight: 600 }}>· {items.length}</span></h3>
            <div className="adm-cards">{items.sort((a, z) => (a.at ?? 0) - (z.at ?? 0)).map((b) => <BookingCard key={b.id} b={b} onOpen={setOpen} showStage />)}</div>
          </section>
        ))
      ) : view === 'tablero' ? (
        <div className="adm-board">
          {STAGES_ALL.filter((s) => stage === 'todas' || s.key === stage).map((s) => {
            const col = list.filter((b) => stageOf(b) === s.key);
            return (
              <section key={s.key} className="adm-col" aria-label={s.label}>
                <div className="adm-col-head" style={{ ['--c' as string]: STAGE_COLOR[s.key] }}><span>{s.label} <small>· {col.length}</small></span></div>
                <div className="adm-col-body">{col.length ? col.map((b) => <BookingCard key={b.id} b={b} onOpen={setOpen} />) : <p className="muted" style={{ fontSize: 13, margin: 4 }}>Nada aquí.</p>}</div>
              </section>
            );
          })}
        </div>
      ) : (
        <Gantt days={days} onOpen={setOpen} />
      )}
      {open && <BookingDetail b={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

const STAGES_ALL: { key: Stage; label: string }[] = [
  { key: 'programada', label: 'Programadas' }, { key: 'ejecucion', label: 'En ejecución' }, { key: 'ejecutada', label: 'Completadas' },
  { key: 'reclamo', label: 'En reclamo' }, { key: 'cancelada', label: 'Canceladas' },
];

/** Línea de tiempo: una fila por día, cada reserva como barra según su hora y duración. */
function Gantt({ days, onOpen }: { days: [string, DashBooking[]][]; onOpen: (b: DashBooking) => void }) {
  const H0 = 6, H1 = 23, span = H1 - H0;
  const hourOf = (b: DashBooking) => { const [h, m] = b.slot.split(':').map(Number); return (h || 0) + (m || 0) / 60; };
  const durOf = (b: DashBooking) => {
    const start = b.startedAt ?? b.arrivedAt; const end = b.finishedAt;
    return start && end && end > start ? Math.min(8, Math.max(0.5, (end - start) / 3_600_000)) : 1.5;
  };
  return (
    <div className="adm-card adm-gantt">
      <div className="adm-gantt-row adm-gantt-axis">
        <span />
        <div className="adm-gantt-track">{Array.from({ length: span / 2 + 1 }, (_, i) => H0 + i * 2).map((h) => <i key={h} style={{ left: `${((h - H0) / span) * 100}%` }}>{String(h).padStart(2, '0')}:00</i>)}</div>
      </div>
      {days.map(([day, items]) => (
        <div key={day} className="adm-gantt-row">
          <span style={{ textTransform: 'capitalize' }}>{fmtDay(day)}</span>
          <div className="adm-gantt-track">
            {items.map((b) => {
              const left = Math.max(0, Math.min(100, ((hourOf(b) - H0) / span) * 100));
              const width = Math.max(4, Math.min(100 - left, (durOf(b) / span) * 100));
              const st = stageOf(b);
              return (
                <button key={b.id} type="button" className="adm-gantt-bar" title={`${b.code} · ${b.slot} · ${catName(b.category)} · ${STATUS_LABEL[b.status] ?? b.status}`}
                  style={{ left: `${left}%`, width: `${width}%`, background: STAGE_COLOR[st] }} onClick={() => onOpen(b)}>
                  {b.slot} {b.code}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="adm-bar" style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>
        {STAGES_ALL.map((s) => <span key={s.key} className="row gap-4"><i style={{ width: 10, height: 10, borderRadius: 3, background: STAGE_COLOR[s.key], display: 'inline-block' }} />{s.label}</span>)}
      </div>
    </div>
  );
}

/** Fotos del pedido y del trabajo, cargadas solo al pedirlas (dueño y socio). */
export function BookingPhotos({ b }: { b: DashBooking }) {
  const [show, setShow] = useState(false);
  const req = b.photoUrls?.request ?? []; const work = b.photoUrls?.work ?? [];
  if (!req.length && !work.length) return null;
  return (
    <div className="adm-card">
      <h3 style={{ marginBottom: 6 }}>Fotos</h3>
      <p className="muted" style={{ fontSize: 12.5, margin: '0 0 10px' }}>Son de la casa del cliente: ábrelas solo para revisar la calidad o un reclamo.</p>
      {!show ? <button type="button" className="adm-btn" onClick={() => setShow(true)}>Ver {req.length + work.length} fotos</button> : (
        <div className="adm-grid" style={{ gap: 10 }}>
          {[['Lo que pidió el cliente', req], ['Trabajo terminado (profesional)', work]].filter(([, u]) => (u as string[]).length).map(([label, urls]) => (
            <div key={label as string} className="adm-grid" style={{ gap: 6 }}>
              <small style={{ fontWeight: 700 }}>{label as string}</small>
              <div className="adm-photos">{(urls as string[]).map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt={label as string} loading="lazy" /></a>)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Curva de dinero (tipo trading) ------------------------------ */

export type FlowKey = 'inflow' | 'card' | 'outflow' | 'net' | 'projected';
const FLOW_SERIES = [
  { key: 'inflow', label: 'Ingreso (todos los medios)', color: '#206344' },
  { key: 'card', label: 'Ingreso por tarjeta', color: '#3E8E6A', dash: true },
  { key: 'outflow', label: 'Salida', color: '#B42318' },
  { key: 'net', label: 'Queda para HULUL', color: '#123F43' },
  { key: 'projected', label: 'Por cobrar (proyección)', color: '#1F4E79', dash: true },
] as const;

/** Entradas, salidas, neto y proyección en el tiempo. Toca un punto para ver sus reservas. */
export function FlowChart({ points, gran, onPick, labels, only, onOnly }: { labels?: Partial<Record<FlowKey, string>>; only?: FlowKey[] | null; onOnly?: (k: FlowKey[] | null) => void; points: { key: string; from: string; to: string; inflow: number; card: number; outflow: number; net: number; projected: number; ids: string[] }[]; gran: 'dia' | 'semana' | 'mes'; onPick: (title: string, ids: string[]) => void }) {
  const SERIES = FLOW_SERIES.map((x) => ({ ...x, label: labels?.[x.key] ?? x.label }));
  const [hover, setHover] = useState<number | null>(null);
  const [ownHidden, setOwnHidden] = useState<string[]>([]);
  const hidden = only ? SERIES.map((x) => x.key as string).filter((k) => !only.includes(k as FlowKey)) : ownHidden;
  const setHidden = (f: (h: string[]) => string[]) => { if (only && onOnly) onOnly(null); setOwnHidden(f(hidden)); };
  const series = SERIES.filter((x) => !labels || x.key !== 'card' || labels.card);
  if (!points.length) return <div className="adm-empty">Sin movimientos en este periodo.</div>;
  const W = 1000, H = 260, L = 74, R = 12, T = 12, B = 34;
  const vals = points.flatMap((p) => series.filter((s) => !hidden.includes(s.key)).map((s) => p[s.key]));
  const max = Math.max(1, ...vals); const min = Math.min(0, ...vals);
  const x = (i: number) => L + (points.length === 1 ? (W - L - R) / 2 : (i / (points.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const label = (p: { from: string; to: string }) => (gran === 'mes' ? new Date(`${p.from}T12:00:00Z`).toLocaleDateString('es-EC', { timeZone: 'UTC', month: 'short', year: '2-digit' }) : fmtWeek(p.from));
  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);
  const every = Math.max(1, Math.ceil(points.length / 10));
  const h = hover !== null ? points[hover] : null;
  return (
    <div className="adm-flowchart">
      <div className="adm-bar" style={{ fontSize: 12.5 }}>
        {series.map((s) => (
          <button key={s.key} type="button" className="adm-legend-btn" aria-pressed={!hidden.includes(s.key)} onClick={() => setHidden((h) => (h.includes(s.key) ? h.filter((k) => k !== s.key) : [...h, s.key]))}>
            <i style={{ background: s.color, opacity: hidden.includes(s.key) ? .3 : 1 }} />{s.label}
          </button>
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Curva de entradas y salidas" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#E4E9E7" /><text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{money(t).replace(',00', '')}</text></g>)}
          {min < 0 && <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#9AA8A5" />}
          {!hidden.includes('inflow') && <path d={`M${x(0)},${y(0)} ${points.map((p, i) => `L${x(i)},${y(p.inflow)}`).join(' ')} L${x(points.length - 1)},${y(0)} Z`} fill="#206344" opacity=".08" />}
          {series.filter((s) => !hidden.includes(s.key)).map((s) => (
            <path key={s.key} d={points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[s.key])}`).join(' ')} fill="none" stroke={s.color} strokeWidth={s.key === 'net' ? 2.6 : 2} strokeDasharray={'dash' in s ? '6 5' : undefined} strokeLinejoin="round" />
          ))}
          {points.map((p, i) => (
            <g key={p.key}>
              {i % every === 0 && <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--muted)">{label(p)}</text>}
              <rect x={x(i) - (W - L - R) / Math.max(1, points.length) / 2} y={T} width={(W - L - R) / Math.max(1, points.length)} height={H - T - B} fill="transparent"
                style={{ cursor: p.ids.length ? 'pointer' : 'default' }} onMouseEnter={() => setHover(i)} onClick={() => p.ids.length && onPick(`${gran === 'dia' ? fmtDay(p.from) : `${fmtWeek(p.from)} – ${fmtWeek(p.to)}`}`, p.ids)} />
            </g>
          ))}
          {h && <line x1={x(hover!)} x2={x(hover!)} y1={T} y2={H - B} stroke="#9AA8A5" strokeDasharray="3 3" />}
          {h && series.filter((s) => !hidden.includes(s.key)).map((s) => <circle key={s.key} cx={x(hover!)} cy={y(h[s.key])} r="4" fill={s.color} />)}
        </svg>
        {h && (
          <div className="adm-flowtip" style={{ left: `${(x(hover!) / W) * 100}%` }}>
            <b>{gran === 'dia' ? fmtDay(h.from) : `${fmtWeek(h.from)} – ${fmtWeek(h.to)}`}</b>
            {series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}: {money(h[s.key])}</span>)}
            {h.ids.length > 0 && <small>Toca para ver {h.ids.length} reservas</small>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Los comprobantes que recibe el cliente por esta reserva (profesional y HULUL). */
export function InvoicesCard({ b }: { b: DashBooking }) {
  const { view } = useAdmin();
  const ruc = view?.providers.find((p) => p.uid === b.proId)?.ruc ?? '';
  const inv = bookingInvoices(b, ruc);
  if (!inv.length) return null;
  return (
    <div className="adm-card">
      <h3 style={{ marginBottom: 10 }}>Comprobantes para el cliente ({inv.length})</h3>
      <div className="adm-grid" style={{ gap: 8 }}>
        {inv.map((i, k) => (
          <div key={k} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'grid', gap: 3, opacity: i.status === 'anulada' ? .55 : 1 }}>
            <div className="row gap-8" style={{ justifyContent: 'space-between' }}>
              <b style={{ fontSize: 13.5 }}>{i.issuer === 'hulul' ? 'Factura de HULUL' : 'Factura del profesional'}</b>
              <Badge tone={i.status === 'anulada' ? 't-mute' : 't-warn'}>{i.status === 'anulada' ? 'Anulada (reclamo)' : 'Por emitir'}</Badge>
            </div>
            <span className="muted" style={{ fontSize: 12.5 }}>{i.issuerName}{i.issuerRuc ? ` · RUC ${i.issuerRuc}` : ''}</span>
            <span style={{ fontSize: 13 }}>{i.concept}: base {money(i.base)} · IVA {money(i.iva)} · <b>total {money(i.total)}</b></span>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>«Por emitir»: la facturación electrónica aún no está conectada; estos son los comprobantes que corresponden.</p>
    </div>
  );
}

/** Descarga un PDF que llega en base64 desde el servidor. */
export function downloadPdf(fileName: string, base64: string) {
  const bin = atob(base64); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
