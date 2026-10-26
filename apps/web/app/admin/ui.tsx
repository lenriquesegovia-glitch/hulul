'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { getCategory } from '@hulul/shared';
import {
  bookingMoney, caseFlags, caseOutcome, money, OUTCOMES, PERIOD_LABEL, percent, stageOf, STATUS_LABEL,
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

/** Descarga un CSV generado en el navegador. */
export function downloadCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
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

export function Kpi({ label, value, hint, accent }: { label: string; value: React.ReactNode; hint?: React.ReactNode; accent?: boolean }) {
  return <div className={`adm-kpi${accent ? ' accent' : ''}`}><span>{label}</span><b>{value}</b>{hint && <small>{hint}</small>}</div>;
}

export function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={`adm-badge ${tone}`}>{children}</span>;
}

/* ---------------------------------- Gráficos --------------------------------- */

/** Pastel (anillo) con leyenda: cantidad y porcentaje de cada parte. */
export function Donut({ items, center, sub }: { items: { label: string; color: string; count: number }[]; center: React.ReactNode; sub: string }) {
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
          <li key={i.label} className={i.count ? '' : 'zero'}>
            <i style={{ background: i.color }} /><span>{i.label}</span><span className="n">{i.count}</span><span className="p">{total ? percent(i.count / total) : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontales. */
export function HBars({ items, max }: { items: { label: string; value: number; display: React.ReactNode; color?: string; parts?: { value: number; color: string }[] }[]; max?: number }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <div className="adm-empty">Sin datos en este periodo.</div>;
  return (
    <div className="adm-hbars">
      {items.map((i) => (
        <div key={i.label} className="adm-hbar">
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
      {b.claim && can('reclamos') && <Link className="adm-btn solid" href={`/admin/reclamos?caso=${encodeURIComponent(b.id)}`}>Abrir el expediente del reclamo</Link>}
    </Drawer>
  );
}
