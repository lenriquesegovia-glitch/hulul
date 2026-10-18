'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatUSD, getCategory } from '@hulul/shared';
import { ClientGate } from '@/components/ClientGate';
import { logout } from '@/lib/auth';

interface Row { id: string; category: string; professionalName: string; date: string; slot: string; total: number; status: string; notes?: string }

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
          <Bookings uid={user.uid} />
        </div>
      )}
    </ClientGate>
  );
}

function Bookings({ uid }: { uid: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    (async () => {
      const [{ firestore }, fs] = await Promise.all([import('@hulul/shared/firebase'), import('firebase/firestore')]);
      const snap = await fs.getDocs(fs.query(fs.collection(firestore(), 'bookings'), fs.where('clientId', '==', uid)));
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Row, 'id'>) }));
      list.sort((a, b) => (a.date + a.slot < b.date + b.slot ? 1 : -1));
      setRows(list);
    })().catch(() => setError(true));
  }, [uid]);

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
            <strong>{getCategory(r.category)?.name ?? r.category} · {r.professionalName}</strong>
            <span className="pill pill-warm">{STATUS[r.status] ?? r.status}</span>
          </div>
          <span className="muted" style={{ fontSize: 14 }}>{r.date} a las {r.slot} · {formatUSD(r.total)} · Código {r.id.slice(0, 8).toUpperCase()}</span>
          {r.notes && <span style={{ fontSize: 14, color: 'var(--text-2)' }}>{r.notes}</span>}
        </div>
      ))}
    </div>
  );
}
