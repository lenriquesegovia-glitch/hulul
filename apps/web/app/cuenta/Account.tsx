'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cancelTerms, formatUSD, getCategory, usd } from '@hulul/shared';
import { ClientGate } from '@/components/ClientGate';
import { logout } from '@/lib/auth';

interface Row { id: string; category: string; professionalName: string; date: string; slot: string; total: number; status: string; notes?: string; cancelFee?: number; demo?: boolean; proposal?: { date: string; slot: string; by: string } }

const STATUS: Record<string, string> = {
  pendiente: 'Por confirmar', confirmada: 'Confirmada', en_camino: 'En camino', en_curso: 'En curso',
  por_aprobar: 'Por aprobar', completada: 'Completada', cancelada: 'Cancelada', en_disputa: 'En revisión',
};

export function Account() {
  return (
    <ClientGate title="Entra a tu cuenta" lead="Con Google, Outlook, Facebook, tu correo o tu celular. Si es tu primera vez, se crea tu cuenta.">
      {({ user, profile }) => (
        <div className="stack gap-24">
          <div className="card stack gap-8">
            <strong style={{ fontSize: 18 }}>{profile.name}</strong>
            <span className="muted">{profile.phone} · {profile.email}</span>
            <button type="button" className="link-btn" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={logout}>Cerrar sesión</button>
          </div>
          <ProSwitch uid={user.uid} />
          <Bookings uid={user.uid} />
        </div>
      )}
    </ClientGate>
  );
}

function Bookings({ uid }: { uid: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    (async () => {
      const [{ firestore }, fs] = await Promise.all([import('@hulul/shared/firebase'), import('firebase/firestore')]);
      const snap = await fs.getDocs(fs.query(fs.collection(firestore(), 'bookings'), fs.where('clientId', '==', uid)));
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Row, 'id'>) }));
      list.sort((a, b) => (a.date + a.slot < b.date + b.slot ? 1 : -1));
      setRows(list);
    })().catch(() => setError(true));
  }, [uid, reload]);

  return (
    <div className="stack gap-12">
      <h2 style={{ fontSize: 22 }}>Mis reservas</h2>
      {error && <p className="form-error">No pudimos cargar tus reservas.</p>}
      {!rows && !error && <p className="muted">Cargando…</p>}
      {rows && rows.length === 0 && (
        <div className="card stack gap-12">
          <p className="muted">Aún no tienes reservas.</p>
          <Link href="/#servicios" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Reservar un servicio</Link>
        </div>
      )}
      {rows?.map((r) => (
        <div key={r.id} className="card stack gap-4" style={{ padding: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
            <Link href={`/cuenta/reserva/${r.id}`} style={{ color: 'inherit' }}><strong>{getCategory(r.category)?.name ?? r.category} · {r.professionalName}</strong></Link>
            <span className="pill pill-warm">{STATUS[r.status] ?? r.status}</span>
          </div>
          <span className="muted" style={{ fontSize: 14 }}>{r.date} a las {r.slot} · {formatUSD(r.total)} · Código {r.id.slice(0, 8).toUpperCase()}</span>
          {r.notes && <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{r.notes}</span>}
          {r.status === 'cancelada' && (
            <span style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
              {r.cancelFee ? `Cargo por cancelación tardía: ${usd(r.cancelFee)}${r.demo ? ' (versión de prueba, no se cobra)' : ''}` : 'Cancelada sin costo.'}
            </span>
          )}
          {r.proposal && <span style={{ fontSize: 13.5, color: 'var(--primary)', fontWeight: 700 }}>Cambio de hora pendiente: {r.proposal.date} a las {r.proposal.slot}</span>}
          <Link href={`/cuenta/reserva/${r.id}`} style={{ fontSize: 14, fontWeight: 700 }}>Ver detalle y seguimiento →</Link>
          <CancelBox row={r} onDone={() => setReload((n) => n + 1)} />
        </div>
      ))}
    </div>
  );
}

/** Fecha y hora cortas en Ecuador: "sáb 18 oct, 11:00". */
function shortWhen(iso: string): string {
  return new Date(iso).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Cancelar: muestra antes de confirmar si es gratis o cuánto cuesta. */
export function CancelBox({ row, onDone }: { row: Row; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const t = cancelTerms(row);
  if (!t.allowed) return null;

  const hint = row.status === 'pendiente'
    ? `Cancelas gratis mientras ningún profesional la confirme. Ya confirmada, gratis hasta ${t.freeUntil ? shortWhen(t.freeUntil) : '2 horas antes'}.`
    : t.fee === 0 && t.freeUntil ? `Cancelas gratis hasta ${shortWhen(t.freeUntil)}.` : '';

  if (!open) {
    return (
      <div className="row gap-12" style={{ justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 6 }}>
        <span className="muted" style={{ fontSize: 13 }}>{hint}</span>
        <button type="button" className="link-btn" style={{ padding: 0 }} onClick={() => setOpen(true)}>Cancelar reserva</button>
      </div>
    );
  }

  const confirm = async () => {
    setBusy(true); setMsg('');
    try {
      const { cancelBooking } = await import('@hulul/shared/firebase');
      await cancelBooking(row.id, reason.trim());
      onDone();
    } catch (e) {
      const { cancelErrorMessage } = await import('@hulul/shared/firebase');
      setMsg(cancelErrorMessage(e));
      setBusy(false);
    }
  };

  return (
    <div className="stack gap-12" style={{ marginTop: 8, padding: 14, borderRadius: 12, background: t.fee > 0 ? 'var(--primary-soft, #F6E7E9)' : 'var(--surface-warm, #F4EEE8)' }}>
      <strong style={{ fontSize: 15 }}>{t.fee > 0 ? `Cancelar ahora cuesta ${usd(t.fee)}` : 'Cancelar es gratis'}</strong>
      <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{t.reason}</span>
      {t.fee > 0 && row.demo && <span className="muted" style={{ fontSize: 13 }}>Versión de prueba: el cargo se registra, pero no se cobra.</span>}
      <div className="field">
        <label htmlFor={`why-${row.id}`}>Motivo (opcional)</label>
        <input id={`why-${row.id}`} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: ya lo resolví, cambié de fecha" />
      </div>
      {msg && <p role="alert" className="form-error">{msg}</p>}
      <div className="row gap-12" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={confirm}>
          {busy ? 'Cancelando…' : t.fee > 0 ? `Cancelar y pagar ${usd(t.fee)}` : 'Sí, cancelar'}
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setOpen(false)}>Mantener reserva</button>
      </div>
    </div>
  );
}

/** Si esta cuenta también es de profesional, el acceso a su agenda. */
function ProSwitch({ uid }: { uid: string }) {
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const [{ firestore }, fs] = await Promise.all([import('@hulul/shared/firebase'), import('firebase/firestore')]);
      const snap = await fs.getDoc(fs.doc(firestore(), 'providers', uid));
      setStatus(snap.exists() ? String(snap.data().status ?? '') : null);
    })().catch(() => setStatus(null));
  }, [uid]);
  if (!status) return null;
  return (
    <div className="card row gap-12" style={{ justifyContent: 'space-between', flexWrap: 'wrap', background: 'var(--surface-warm)' }}>
      <div className="stack gap-4">
        <strong>También eres profesional en HULUL</strong>
        <span className="muted" style={{ fontSize: 14 }}>Aquí ves tus reservas como cliente. Tus trabajos están en tu agenda.</span>
      </div>
      <Link href={status === 'aprobado' ? '/profesionales/agenda' : '/profesionales/registro'} className="btn btn-primary">
        {status === 'aprobado' ? 'Ir a mi agenda' : 'Ver mi registro'}
      </Link>
    </div>
  );
}
