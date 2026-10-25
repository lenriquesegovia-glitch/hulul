'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCategory } from '@hulul/shared';
import { CLAIM_STATUS_LABEL, type ClaimFile, type ClaimListItem } from '@hulul/shared/firebase';
import { SignIn } from '@/components/SignIn';
import { logout, useUser } from '@/lib/auth';
import { whenEc } from '@/components/Claim';

const H = 3_600_000;
type Filter = 'abiertos' | 'urgentes' | 'resueltos' | 'todos';

const errMsg = (e: unknown) => (e as { message?: string }).message || 'No se pudo cargar.';
const catName = (slug: string) => { try { return getCategory(slug as never)?.name ?? slug; } catch { return slug; } };

/** "en 41 h", "hace 3 h" respecto de ahora. */
function left(ms: number, now: number) {
  const d = ms - now;
  const h = Math.abs(d) / H;
  const txt = h < 1 ? `${Math.max(1, Math.round(Math.abs(d) / 60_000))} min` : `${Math.round(h)} h`;
  return d >= 0 ? `en ${txt}` : `hace ${txt}`;
}

function urgency(c: { status: string; resolveDueAt: number }, now: number): 'vencido' | 'urgente' | 'ok' | 'cerrado' {
  if (c.status === 'resuelto') return 'cerrado';
  if (now > c.resolveDueAt) return 'vencido';
  if (c.resolveDueAt - now < 12 * H) return 'urgente';
  return 'ok';
}

const TONE: Record<string, { bg: string; fg: string }> = {
  vencido: { bg: '#FDECEA', fg: '#B42318' }, urgente: { bg: '#FFF4E5', fg: '#9A5B00' }, ok: { bg: '#EEF4FF', fg: '#1F3A8A' }, cerrado: { bg: '#EDF7EE', fg: '#1E6B32' },
};

function Badge({ tone, children }: { tone: keyof typeof TONE; children: React.ReactNode }) {
  return <span style={{ background: TONE[tone].bg, color: TONE[tone].fg, borderRadius: 999, padding: '3px 10px', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</span>;
}

/**
 * Panel privado de reclamos. Solo entra una cuenta cuyo correo está en
 * ADMIN_EMAILS (lo valida el servidor). Cada expediente abierto queda registrado.
 */
export function ClaimsPanel() {
  const user = useUser();
  const [items, setItems] = useState<ClaimListItem[] | null>(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<Filter>('abiertos');
  const [open, setOpen] = useState<string>('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);
  useEffect(() => { const q = new URLSearchParams(window.location.search).get('caso'); if (q) setOpen(q); }, []);

  const load = useCallback(async () => {
    setErr('');
    try {
      const { adminListClaims } = await import('@hulul/shared/firebase');
      setItems(await adminListClaims());
    } catch (e) {
      setErr(errMsg(e)); setItems([]);
    }
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  const shown = useMemo(() => (items ?? []).filter((c) => {
    if (filter === 'abiertos') return c.status !== 'resuelto';
    if (filter === 'urgentes') return ['vencido', 'urgente'].includes(urgency(c, now));
    if (filter === 'resueltos') return c.status === 'resuelto';
    return true;
  }), [items, filter, now]);

  if (user === undefined) return null;
  if (!user) return <SignIn title="Panel de reclamos" lead="Entra con la cuenta de HULUL autorizada (Google)." />;

  const counts = {
    abiertos: (items ?? []).filter((c) => c.status !== 'resuelto').length,
    urgentes: (items ?? []).filter((c) => ['vencido', 'urgente'].includes(urgency(c, now))).length,
    resueltos: (items ?? []).filter((c) => c.status === 'resuelto').length,
    todos: (items ?? []).length,
  };

  if (open) return <ClaimDetail id={open} now={now} onBack={() => { setOpen(''); window.history.replaceState(null, '', '/admin/reclamos'); load(); }} />;

  return (
    <div className="stack gap-16">
      <div className="row gap-12" style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'baseline' }}>
        <h1 style={{ margin: 0 }}>Reclamos</h1>
        <span className="muted" style={{ fontSize: 13.5 }}>{user.email} · <button type="button" className="link-btn" onClick={() => logout()} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}>Salir</button></span>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>Protocolo: la otra parte responde en 24 h; HULUL decide en máximo 72 h desde la apertura. Te avisamos por correo 12 h antes de vencer.</p>
      <div className="chip-row">
        {(['abiertos', 'urgentes', 'resueltos', 'todos'] as Filter[]).map((f) => (
          <button key={f} type="button" className={`btn ${filter === f ? 'btn-primary' : 'btn-ghost'}`} style={{ minHeight: 40, padding: '0 14px', fontSize: 14 }} onClick={() => setFilter(f)}>
            {{ abiertos: 'Abiertos', urgentes: 'Por vencer / vencidos', resueltos: 'Resueltos', todos: 'Todos' }[f]} ({counts[f]})
          </button>
        ))}
      </div>
      {err && <p role="alert" className="form-error">{err}</p>}
      {items === null ? <p className="muted">Cargando…</p> : shown.length === 0 ? <p className="muted">No hay reclamos en esta vista.</p> : (
        <div className="stack gap-8">
          {shown.map((c) => {
            const u = urgency(c, now);
            return (
              <button key={c.id} type="button" className="card" onClick={() => { setOpen(c.id); window.history.replaceState(null, '', `/admin/reclamos?caso=${c.id}`); }}
                style={{ textAlign: 'left', cursor: 'pointer', padding: 16, display: 'grid', gap: 6 }}>
                <div className="row gap-8" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <strong>{c.code} · {c.kindLabel}</strong>
                  <Badge tone={u}>{u === 'cerrado' ? `Resuelto: ${c.decision === 'cliente' ? 'cliente' : 'profesional'}` : u === 'vencido' ? `Vencido ${left(c.resolveDueAt, now)}` : `Decidir ${left(c.resolveDueAt, now)}`}</Badge>
                </div>
                <span className="muted" style={{ fontSize: 13.5 }}>
                  Abrió {c.openedBy === 'cliente' ? 'el cliente' : 'el profesional'} · {whenEc(c.openedAt)} · {catName(c.category)} {c.date} {c.slot}
                </span>
                <span style={{ fontSize: 13.5 }}>
                  Cliente: {c.clientName || '—'} · Profesional: {c.proName || '—'} · {CLAIM_STATUS_LABEL[c.status]}{c.status !== 'resuelto' ? (c.hasResponse ? ' · ya respondió' : ` · respuesta ${left(c.responseDueAt, now)}`) : ''}{c.moneyHeld && c.status !== 'resuelto' ? ' · pago retenido' : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card stack gap-8" style={{ padding: 18 }}><strong style={{ fontSize: 16 }}>{title}</strong>{children}</div>;
}

function Photos({ urls, label }: { urls?: string[]; label?: string }) {
  if (!urls?.length) return label ? <span className="muted" style={{ fontSize: 13.5 }}>{label}: sin fotos</span> : null;
  return (
    <div className="stack gap-4">
      {label && <span className="muted" style={{ fontSize: 13 }}>{label}</span>}
      <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
        {urls.map((u, i) => (
          <a key={u + i} href={u} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`Foto ${i + 1}`} style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
          </a>
        ))}
      </div>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 34%) 1fr', gap: 10, fontSize: 14 }}><span className="muted">{k}</span><span style={{ overflowWrap: 'anywhere' }}>{v}</span></div>
);

const WHO: Record<string, string> = { cliente: 'Cliente', profesional: 'Profesional', hulul: 'HULUL' };
const usd = (n: unknown) => (n === null || n === undefined || n === '' ? '—' : `$${Number(n).toFixed(2)}`);
const mins = (m: number | null) => (m === null ? '—' : m < 60 ? `${m} min` : `${(m / 60).toFixed(1)} h`);

function ClaimDetail({ id, now, onBack }: { id: string; now: number; onBack: () => void }) {
  const [f, setF] = useState<ClaimFile | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(async (reveal = false) => {
    setErr('');
    try {
      const { adminGetClaim } = await import('@hulul/shared/firebase');
      setF(await adminGetClaim(id, reveal));
    } catch (e) { setErr(errMsg(e)); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (err) return <div className="stack gap-12"><button type="button" className="btn btn-ghost" onClick={onBack}>← Volver</button><p role="alert" className="form-error">{err}</p></div>;
  if (!f) return <p className="muted">Abriendo expediente…</p>;
  const { claim: c, booking: b } = f;
  const u = urgency(c, now);
  const opener = c.openedBy === 'cliente' ? 'Cliente' : 'Profesional';
  const responder = c.openedBy === 'cliente' ? 'Profesional' : 'Cliente';
  const rings = (b.rings ?? []) as number[];
  const t = (k: string) => (b[k] ? whenEc(Number(b[k])) : '—');

  return (
    <div className="stack gap-16">
      <div className="row gap-12" style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn-ghost" style={{ minHeight: 40 }} onClick={onBack}>← Todos los reclamos</button>
        <Badge tone={u}>{u === 'cerrado' ? 'Resuelto' : u === 'vencido' ? `Vencido ${left(c.resolveDueAt, now)}` : `Decidir ${left(c.resolveDueAt, now)}`}</Badge>
      </div>
      <div className="stack gap-4">
        <h1 style={{ margin: 0, fontSize: 26 }}>Reclamo {c.code}</h1>
        <span className="muted" style={{ fontSize: 14 }}>{c.kindLabel} · abrió {opener.toLowerCase()} el {whenEc(c.openedAt)} · {CLAIM_STATUS_LABEL[c.status]}</span>
        <span style={{ fontSize: 13.5 }}>Respuesta de la otra parte: hasta {whenEc(c.responseDueAt)} · Decisión: hasta {whenEc(c.resolveDueAt)}{c.moneyHeld && c.status !== 'resuelto' ? ' · pago al profesional retenido' : ''}</span>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <Section title={`Versión de quien reclama (${opener})`}>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.text}</p>
          {c.privado?.apertura && c.privado.apertura !== c.text && <p style={{ margin: 0, fontSize: 13, color: '#B42318' }}>Texto original (tenía groserías): {c.privado.apertura}</p>}
          <Photos urls={c.photos} label="Fotos" />
        </Section>
        <Section title={`Versión de la otra parte (${responder})`}>
          {c.response ? (
            <>
              <span className="muted" style={{ fontSize: 13 }}>{whenEc(c.response.at)}{c.response.late ? ' · respondió fuera de plazo' : ' · a tiempo'}</span>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.response.text}</p>
              {c.privado?.respuesta && c.privado.respuesta !== c.response.text && <p style={{ margin: 0, fontSize: 13, color: '#B42318' }}>Texto original (tenía groserías): {c.privado.respuesta}</p>}
              <Photos urls={c.response.photos} label="Fotos" />
            </>
          ) : <span className="muted">{c.responseMissed || now > c.responseDueAt ? 'No respondió en 24 horas.' : `Aún no responde (plazo ${left(c.responseDueAt, now)}).`}</span>}
        </Section>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <Section title="Reserva">
          <Row k="Servicio" v={`${catName(String(b.category))} · ${b.date} ${b.slot}${b.hours ? ` · ${b.hours} h` : ''}`} />
          <Row k="Dirección" v={b.address || '—'} />
          <Row k="Pedido del cliente" v={b.notes || '—'} />
          <Row k="Pago" v={`${b.paymentMethod || '—'} · visita ${usd(b.visit ?? b.subtotal)}${b.cancelFee ? ` · cargo ${usd(b.cancelFee)}` : ''}`} />
          <Row k="Estado" v={`${b.status}${b.previousStatus ? ` (antes: ${b.previousStatus})` : ''}${b.cancelledBy ? ` · canceló: ${b.cancelledBy}` : ''}`} />
          <Row k="Cliente" v={`${b.contactName} · ${b.contactPhone || '—'} · ${b.contactEmail || '—'}`} />
          <Row k="Profesional" v={`${b.professionalName} · ${f.parties.pro.phone || '—'}`} />
          {!f.revealed && <button type="button" className="btn btn-ghost" style={{ minHeight: 38, fontSize: 13.5 }} onClick={() => load(true)}>Mostrar contacto completo (queda registrado)</button>}
        </Section>
        <Section title="Evidencia de la visita">
          <Row k="Aceptó / salió" v={`${t('acceptedAt')} / ${t('enRouteAt')}`} />
          <Row k="Llegada" v={b.arrivedAt ? `${t('arrivedAt')} · ${b.arrivedPos ? `a ${b.arrivedPos.distance ?? '?'} m de la dirección (precisión ${Math.round(Number(b.arrivedPos.accuracy ?? 0))} m)` : 'sin GPS'}` : 'No marcó llegada'} />
          <Row k="Timbres" v={rings.length ? `${rings.length}: ${rings.map((r) => whenEc(r).split(', ').pop()).join(' · ')}` : 'Ninguno'} />
          <Row k="Código de llegada" v={b.startedWithCode ? `Sí, empezó ${t('startedAt')}` : 'No se usó'} />
          <Row k="Terminó" v={t('finishedAt')} />
          <Row k="Resultado / informe" v={`${b.outcome ?? '—'}${b.diagnosis ? ` · ${b.diagnosis}` : ''}`} />
          {!!b.extra && <Row k="Cobro adicional" v={JSON.stringify(b.extra)} />}
          <Photos urls={b.photos} label="Fotos del cliente al reservar" />
          <Photos urls={b.diagnosisPhotos} label="Fotos del profesional al terminar" />
        </Section>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <Section title="Tiempos de respuesta en el chat">
          {(['cliente', 'profesional'] as const).map((k) => (
            <Row key={k} k={WHO[k]} v={`${f.stats[k].count} mensajes · promedio ${mins(f.stats[k].avgMin)} · máximo ${mins(f.stats[k].maxMin)}`} />
          ))}
        </Section>
        <Section title="Antecedentes">
          <Row k="Cliente" v={`${f.parties.client.reclamos} reclamo(s) en total · ${f.parties.client.strikes} falta(s)`} />
          <Row k="Profesional" v={`${f.parties.pro.reclamos} reclamo(s) en total · ${f.parties.pro.strikes} falta(s) · calificación ${f.parties.pro.rating ?? '—'}`} />
        </Section>
      </div>

      <Section title="Línea de tiempo">
        <div className="stack gap-4">
          {f.timeline.map((e, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '128px 92px 1fr', gap: 8, fontSize: 13.5, borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
              <span className="muted">{whenEc(e.at)}</span><strong>{WHO[e.who] ?? e.who}</strong><span>{e.what}{e.detail ? ` — ${e.detail}` : ''}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Chat completo (${f.messages.length} mensajes)`}>
        {f.messages.length === 0 ? <span className="muted">No hubo chat.</span> : (
          <div className="stack gap-8" style={{ maxHeight: 460, overflowY: 'auto' }}>
            {f.messages.map((m) => (
              <div key={m.id} style={{ alignSelf: m.from === 'cliente' ? 'flex-start' : 'flex-end', maxWidth: '85%', background: m.from === 'cliente' ? 'var(--surface)' : '#F1EADF', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 12px' }}>
                <div className="muted" style={{ fontSize: 12 }}>{WHO[m.from] ?? m.from} · {whenEc(m.at)}</div>
                {m.kind === 'foto' && m.photo ? <Photos urls={[m.photo]} /> : <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{m.kind === 'pedir_fotos' ? '📷 Pidió fotos: ' : ''}{m.text}</div>}
                {m.original && <div style={{ fontSize: 12.5, color: '#B42318' }}>Original moderado: {m.original}</div>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {c.decision ? (
        <Section title="Decisión">
          <Row k="A favor de" v={c.decision.outcome === 'cliente' ? 'Cliente' : 'Profesional'} />
          <Row k="Motivo" v={c.decision.note} />
          <Row k="Medidas" v={[c.decision.multaPro ? `multa ${usd(c.decision.multaPro)}` : '', c.decision.creditoCliente ? `crédito ${usd(c.decision.creditoCliente)}` : '', c.decision.faltaPro ? 'falta al profesional' : '', c.decision.faltaCliente ? 'falta al cliente' : ''].filter(Boolean).join(' · ') || 'Ninguna'} />
          <Row k="Fecha" v={whenEc(c.decision.at)} />
        </Section>
      ) : <DecisionForm id={id} clientOpened={c.openedBy === 'cliente'} onDone={() => load()} />}

      <Section title="Registro de accesos a este expediente">
        {f.accesses.map((a, i) => <span key={i} className="muted" style={{ fontSize: 13 }}>{whenEc(a.at)} · {a.email} · {a.action}</span>)}
      </Section>
    </div>
  );
}

function DecisionForm({ id, clientOpened, onDone }: { id: string; clientOpened: boolean; onDone: () => void }) {
  const [outcome, setOutcome] = useState<'' | 'cliente' | 'profesional'>('');
  const [note, setNote] = useState('');
  const [multaPro, setMultaPro] = useState('');
  const [creditoCliente, setCredito] = useState('');
  const [faltaPro, setFaltaPro] = useState(false);
  const [faltaCliente, setFaltaCliente] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const effect = !outcome ? '' : clientOpened
    ? (outcome === 'cliente' ? 'No se cobra la visita al cliente (se anula el cargo y no se paga al profesional).' : 'Se mantiene el cobro y se libera el pago al profesional.')
    : 'Queda registrada la decisión; el dinero de la reserva no cambia.';

  const send = async () => {
    setMsg('');
    if (!outcome) { setMsg('Elige a favor de quién.'); return; }
    if (note.trim().length < 20) { setMsg('Escribe el motivo (al menos 20 caracteres). Lo verán las dos partes.'); return; }
    if (!confirm) { setConfirm(true); return; }
    setBusy(true);
    try {
      const { adminResolveClaim } = await import('@hulul/shared/firebase');
      await adminResolveClaim({ id, outcome, note: note.trim(), multaPro: Number(multaPro || 0), creditoCliente: Number(creditoCliente || 0), faltaPro, faltaCliente });
      onDone();
    } catch (e) { setMsg(errMsg(e)); setConfirm(false); } finally { setBusy(false); }
  };

  return (
    <Section title="Decisión">
      <div className="row gap-16" style={{ flexWrap: 'wrap' }}>
        <label className="check"><input type="radio" name="outcome" checked={outcome === 'cliente'} onChange={() => { setOutcome('cliente'); setConfirm(false); }} /><span>A favor del cliente</span></label>
        <label className="check"><input type="radio" name="outcome" checked={outcome === 'profesional'} onChange={() => { setOutcome('profesional'); setConfirm(false); }} /><span>A favor del profesional</span></label>
      </div>
      {effect && <span style={{ fontSize: 13.5 }}>{effect}</span>}
      <div className="row gap-12" style={{ flexWrap: 'wrap' }}>
        {clientOpened && outcome === 'cliente' && (
          <label className="field" style={{ margin: 0 }}><span style={{ fontSize: 13.5 }}>Multa al profesional (USD)</span><input inputMode="decimal" value={multaPro} onChange={(e) => setMultaPro(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" style={{ width: 120 }} /></label>
        )}
        <label className="field" style={{ margin: 0 }}><span style={{ fontSize: 13.5 }}>Crédito al cliente (USD)</span><input inputMode="decimal" value={creditoCliente} onChange={(e) => setCredito(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" style={{ width: 120 }} disabled={!clientOpened || outcome !== 'cliente'} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={faltaPro} onChange={(e) => setFaltaPro(e.target.checked)} /><span>Registrar falta al profesional (3 en 30 días = 7 días de suspensión)</span></label>
      <label className="check"><input type="checkbox" checked={faltaCliente} onChange={(e) => setFaltaCliente(e.target.checked)} /><span>Registrar falta al cliente (reclamo abusivo o mal trato)</span></label>
      <textarea rows={4} maxLength={1500} value={note} onChange={(e) => { setNote(e.target.value); setConfirm(false); }} placeholder="Motivo de la decisión: qué evidencia pesó (llegada, timbres, chat, fotos). Lo leen las dos partes." aria-label="Motivo" />
      {msg && <p role="alert" className="form-error">{msg}</p>}
      <div className="actions">
        <button type="button" className={`btn ${confirm ? 'btn-danger' : 'btn-primary'}`} disabled={busy} onClick={send}>{busy ? 'Guardando…' : confirm ? 'Confirmar: no se puede deshacer' : 'Resolver el reclamo'}</button>
      </div>
    </Section>
  );
}
