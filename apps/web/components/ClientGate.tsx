'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { User } from 'firebase/auth';
import { e164Ecuador, PRIVACY_VERSION } from '@hulul/shared';
import { logout, useUser } from '@/lib/auth';
import { SignIn } from '@/components/SignIn';

/**
 * Cuenta de cliente obligatoria para reservar (como Uber).
 * 1) Inicia sesión con Google, Outlook o correo. 2) La primera vez completa nombre,
 * celular y correo (se guardan en `clients/{uid}`). 3) Muestra el contenido.
 */

export interface ClientProfile {
  name: string;
  phone: string;
  email: string;
  consentMarketing: boolean;
  /** Versiones de términos y privacidad aceptadas (las escribe el servidor). */
  legal?: { terminos?: string; privacidad?: string };
}

async function fb() {
  const [{ firestore }, fs] = await Promise.all([import('@hulul/shared/firebase'), import('firebase/firestore')]);
  return { db: firestore(), fs };
}

export async function loadClient(uid: string): Promise<ClientProfile | null> {
  const { db, fs } = await fb();
  const snap = await fs.getDoc(fs.doc(db, 'clients', uid));
  return snap.exists() ? (snap.data() as ClientProfile) : null;
}

export function ClientGate({ title, lead, children }: {
  title: string;
  lead: string;
  children: (ctx: { user: User; profile: ClientProfile }) => ReactNode;
}) {
  const user = useUser();
  const [profile, setProfile] = useState<ClientProfile | null | undefined>(undefined);
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    if (!user) { setProfile(undefined); return; }
    let off = false;
    loadClient(user.uid).then(async (p) => {
      if (off) return;
      setProfile(p);
      if (p) { const { needsLegalUpdate } = await import('@hulul/shared/firebase'); if (!off) setOutdated(await needsLegalUpdate(p.legal)); }
    }).catch(() => { if (!off) setProfile(null); });
    return () => { off = true; };
  }, [user]);

  if (user === undefined || (user && profile === undefined)) return <p className="muted">Cargando…</p>;
  if (!user) return <div className="card"><SignIn title={title} lead={lead} /></div>;
  if (!profile) return <div className="card"><ProfileForm user={user} onSaved={setProfile} /></div>;
  if (outdated) return <div className="card"><LegalUpdate onDone={() => setOutdated(false)} /></div>;
  return <>{children({ user, profile })}</>;
}

function ProfileForm({ user, onSaved }: { user: User; onSaved: (p: ClientProfile) => void }) {
  const [name, setName] = useState(user.displayName ?? '');
  const [phone, setPhone] = useState(user.phoneNumber?.startsWith('+593') ? `0${user.phoneNumber.slice(4)}` : '');
  const [email, setEmail] = useState(user.email ?? '');
  const [privacy, setPrivacy] = useState(false);
  const [promos, setPromos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    if (name.trim().split(/\s+/).length < 2) { setError('Escribe tu nombre y apellido.'); return; }
    if (!e164Ecuador(phone)) { setError('Escribe tu celular de 10 dígitos (09XXXXXXXX).'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError('Escribe un correo válido.'); return; }
    if (!privacy) { setError('Para crear tu cuenta debes aceptar los Términos y la Política de privacidad.'); return; }
    setBusy(true);
    try {
      const { db, fs } = await fb();
      const p: ClientProfile = { name: name.trim(), phone: phone.replace(/\D/g, ''), email: email.trim(), consentMarketing: promos };
      await fs.setDoc(fs.doc(db, 'clients', user.uid), {
        ...p,
        uid: user.uid,
        consentPrivacy: true,
        privacyVersion: PRIVACY_VERSION,
        createdAt: fs.serverTimestamp(),
        updatedAt: fs.serverTimestamp(),
      });
      // Prueba de la aceptación (versión, fecha, IP y dispositivo) y copia por correo.
      try { const { recordAcceptance } = await import('@hulul/shared/firebase'); await recordAcceptance('cliente', 'web', 'registro'); } catch { /* el perfil ya quedó; se pedirá de nuevo luego */ }
      onSaved(p);
    } catch {
      setError('No pudimos guardar tus datos. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack gap-16">
      <div className="stack gap-8">
        <h2 style={{ fontSize: 24 }}>Completa tu cuenta</h2>
        <p className="muted">Solo esta vez. Con estos datos confirmamos tus reservas y el profesional te contacta.</p>
      </div>
      <div className="field"><label htmlFor="cn">Nombre y apellido</label><input id="cn" autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="form-2">
        <div className="field"><label htmlFor="cp">Celular (WhatsApp)</label><input id="cp" type="tel" inputMode="tel" autoComplete="tel" placeholder="09XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div className="field"><label htmlFor="ce">Correo</label><input id="ce" type="email" autoComplete="email" maxLength={160} value={email} onChange={(e) => setEmail(e.target.value.trim())} /></div>
      </div>
      <label className="check"><input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
        <span>Acepto los <Link href="/legal/terminos" target="_blank">Términos y condiciones</Link> y la <Link href="/legal/privacidad" target="_blank">Política de privacidad</Link>.</span>
      </label>
      <label className="check"><input type="checkbox" checked={promos} onChange={(e) => setPromos(e.target.checked)} />
        <span>Quiero recibir novedades y promociones de HULUL (opcional).</span>
      </label>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button type="button" className="btn btn-primary" style={{ minHeight: 52 }} disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Crear mi cuenta'}</button>
      <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={logout}>Usar otra cuenta</button>
    </div>
  );
}

/** Cuando cambian los Términos o la Política de privacidad, se aceptan de nuevo antes de seguir. */
function LegalUpdate({ onDone }: { onDone: () => void }) {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const accept = async () => {
    if (!ok) { setError('Marca la casilla para continuar.'); return; }
    setBusy(true); setError('');
    try { const { recordAcceptance } = await import('@hulul/shared/firebase'); await recordAcceptance('cliente', 'web', 'cambio_version'); onDone(); }
    catch { setError('No pudimos registrar tu aceptación. Revisa tu conexión e inténtalo de nuevo.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="stack gap-16">
      <div className="stack gap-8">
        <h2 style={{ fontSize: 24 }}>Actualizamos nuestros términos</h2>
        <p className="muted">Para seguir usando HULUL, revisa y acepta la versión vigente. Te enviaremos una copia a tu correo.</p>
      </div>
      <label className="check"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>Acepto los <Link href="/legal/terminos" target="_blank">Términos y condiciones</Link> y la <Link href="/legal/privacidad" target="_blank">Política de privacidad</Link> vigentes.</span>
      </label>
      {error && <p role="alert" className="form-error">{error}</p>}
      <button type="button" className="btn btn-primary" style={{ minHeight: 52 }} disabled={busy} onClick={accept}>{busy ? 'Guardando…' : 'Aceptar y continuar'}</button>
      <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={logout}>Salir</button>
    </div>
  );
}
