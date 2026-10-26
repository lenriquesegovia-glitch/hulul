'use client';

import { useEffect, useRef, useState } from 'react';
import { authErrorMessage, completeRedirectSignIn, logout, PROVIDER_ID, PROVIDER_LABEL, signInSocial, useUser, type SocialProvider } from '@/lib/auth';

/**
 * Puente para entrar en la app con Google u Outlook: la app abre esta página
 * en el navegador del celular, la persona entra y volvemos a la app
 * (hulul://login) con una sesión de un solo uso. Es la misma cuenta de la web.
 *
 * Se usa solo la cuenta del botón que tocó: si el navegador tenía abierta una
 * sesión con otro método (p. ej. Outlook y tocó Google), se cierra y se elige
 * de nuevo. Nunca vuelve a la app con una sesión vieja sin que la persona lo confirme.
 */
const APP_RETURN = 'hulul://login';

export function AppLogin() {
  const user = useUser();
  const [provider, setProvider] = useState<SocialProvider>('google');
  const [state, setState] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const fresh = useRef(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = q.get('p');
    if (p === 'microsoft' || p === 'google') setProvider(p);
    setState((q.get('state') ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64));
    completeRedirectSignIn()
      .then((justIn) => { fresh.current = justIn; })
      .catch((e) => setMsg(authErrorMessage(e)))
      .finally(() => setReady(true));
  }, []);

  const backToApp = async () => {
    setBusy(true); setMsg('');
    try {
      const { appLoginToken } = await import('@hulul/shared/firebase');
      const token = await appLoginToken();
      window.location.href = `${APP_RETURN}?token=${encodeURIComponent(token)}&state=${encodeURIComponent(state)}`;
      setMsg('Volviendo a la app…');
    } catch (e) {
      const m = (e as Error).message || '';
      if (/Vuelve a iniciar sesión/.test(m)) { await logout(); setMsg('Por seguridad, vuelve a entrar.'); }
      else setMsg(m || 'No pudimos volver a la app. Inténtalo otra vez.');
    } finally { setBusy(false); }
  };

  const enter = async () => {
    setBusy(true); setMsg('');
    try {
      if (user) await logout();
      fresh.current = true;
      await signInSocial(provider);
    } catch (e) { fresh.current = false; setMsg(authErrorMessage(e)); setBusy(false); }
  };

  const matches = !!user && user.providerData.some((p) => p.providerId === PROVIDER_ID[provider]);

  useEffect(() => {
    if (!ready || user === undefined) return;
    // Acaba de entrar en esta página: vuelve solo a la app.
    if (user && fresh.current) { fresh.current = false; backToApp(); return; }
    // Sesión vieja de otro método (p. ej. Outlook y tocó Google): se cierra para elegir de nuevo.
    if (user && !matches) logout().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, matches]);

  const name = PROVIDER_LABEL[provider];
  if (user === undefined || !ready) return <p className="muted">Cargando…</p>;

  return (
    <div className="stack gap-16">
      <h1 style={{ fontSize: 24, margin: 0 }}>Entrar en la app de HULUL</h1>
      {user && matches ? (
        <>
          <p className="muted" style={{ margin: 0 }}>En este navegador ya entraste con {name} como <strong>{user.email}</strong>.</p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={backToApp}>{busy ? 'Un momento…' : `Continuar como ${user.email}`}</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={enter}>Usar otra cuenta de {name}</button>
        </>
      ) : (
        <>
          <p className="muted" style={{ margin: 0 }}>Entra con tu cuenta de {name}. Luego volvemos solos a la app.</p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={enter}>{busy ? `Abriendo ${name}…` : `Continuar con ${name}`}</button>
        </>
      )}
      {msg && <p role="status" className="form-error">{msg}</p>}
    </div>
  );
}
