'use client';

import { useEffect, useRef, useState } from 'react';
import { authErrorMessage, completeRedirectSignIn, logout, PROVIDER_LABEL, signInSocial, useUser, type SocialProvider } from '@/lib/auth';

/**
 * Puente para entrar en la app con Google u Outlook: la app abre esta página
 * en el navegador del celular, la persona entra y volvemos a la app
 * (hulul://login) con una sesión de un solo uso. Es la misma cuenta de la web.
 */
const APP_RETURN = 'hulul://login';

export function AppLogin() {
  const user = useUser();
  const [provider, setProvider] = useState<SocialProvider>('google');
  const [state, setState] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const fresh = useRef(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = q.get('p');
    if (p === 'microsoft' || p === 'google') setProvider(p);
    setState((q.get('state') ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64));
    completeRedirectSignIn().then(() => { fresh.current = true; }).catch((e) => setMsg(authErrorMessage(e)));
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
      await signInSocial(provider);
      fresh.current = true;
    } catch (e) { setMsg(authErrorMessage(e)); setBusy(false); }
  };

  // Recién entró (ventana o redirección): vuelve solo a la app.
  useEffect(() => {
    if (user && fresh.current) { fresh.current = false; backToApp(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const name = PROVIDER_LABEL[provider];
  if (user === undefined) return <p className="muted">Cargando…</p>;

  return (
    <div className="stack gap-16">
      <h1 style={{ fontSize: 24, margin: 0 }}>Entrar en la app de HULUL</h1>
      {user ? (
        <>
          <p className="muted" style={{ margin: 0 }}>Ya entraste como <strong>{user.email}</strong>. Toca para volver a la app con esta cuenta.</p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={backToApp}>{busy ? 'Un momento…' : 'Volver a la app'}</button>
          <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={async () => { await logout(); }}>Usar otra cuenta</button>
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
