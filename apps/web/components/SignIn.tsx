'use client';

import { useEffect, useState } from 'react';
import type { ConfirmationResult } from 'firebase/auth';
import { e164Ecuador } from '@hulul/shared';
import { authErrorMessage, completeRedirectSignIn, inAppBrowser, pendingLink, PROVIDER_LABEL, resetPassword, sendSmsCode, signInEmail, signInSocial, type SocialProvider } from '@/lib/auth';

/** Inicio de sesión o registro con Google, Outlook, Facebook, correo o celular (SMS). Sirve para clientes y profesionales. */

/**
 * Botones que solo se muestran si el proveedor está activado en Firebase
 * (Authentication → Método de acceso). Microsoft: app "HULUL" en Microsoft
 * Entra, activada el 25-oct-2026. Facebook: falta crear la app en Meta for
 * Developers y activarla en Firebase; luego poner true y publicar.
 */
const SHOW_MICROSOFT = true;
const SHOW_FACEBOOK = false;

export function SignIn({ title, lead }: { title: string; lead: string }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirm, setConfirm] = useState<ConfirmationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [create, setCreate] = useState(true);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [going, setGoing] = useState<SocialProvider | null>(null);
  const [inApp, setInApp] = useState<string | null>(null);
  const [linkWait, setLinkWait] = useState<ReturnType<typeof pendingLink>>(null);

  // Al volver de Google, Outlook o Facebook (celular), muestra el error si lo hubo.
  useEffect(() => {
    setInApp(inAppBrowser());
    setLinkWait(pendingLink());
    completeRedirectSignIn()
      .catch((e) => setError(authErrorMessage(e)))
      .finally(() => setLinkWait(pendingLink()));
  }, []);

  const social = (name: SocialProvider) => {
    setGoing(name);
    run(() => signInSocial(name)).finally(() => { setGoing(null); setLinkWait(pendingLink()); });
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try { await fn(); } catch (e) { setError(authErrorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div className="stack gap-24">
      <div className="stack gap-8">
        <h2 style={{ fontSize: 24 }}>{title}</h2>
        <p className="muted">{lead}</p>
      </div>

      {inApp && (
        <p role="note" className="muted" style={{ fontSize: 14 }}>
          Estás dentro de {inApp}. Para entrar con Google u Outlook, toca ⋮ o ··· arriba y elige «Abrir en el navegador». Aquí mismo puedes entrar con tu correo o celular.
        </p>
      )}

      {linkWait && (
        <p role="note" className="muted" style={{ fontSize: 14 }}>
          {linkWait.email ? `${linkWait.email} ya` : 'Ese correo ya'} tiene cuenta. Entra con el método que usaste la primera vez y {PROVIDER_LABEL[linkWait.provider]} quedará unido a tu cuenta.
        </p>
      )}

      <div className="stack gap-8">
        <button type="button" className="btn btn-ghost social-btn" disabled={busy} aria-busy={going === 'google'} onClick={() => social('google')}>
          <GoogleMark /> {going === 'google' ? 'Abriendo Google…' : 'Continuar con Google'}
        </button>
        {SHOW_MICROSOFT && (
          <button type="button" className="btn btn-ghost social-btn" disabled={busy} aria-busy={going === 'microsoft'} onClick={() => social('microsoft')}>
            <MicrosoftMark /> {going === 'microsoft' ? 'Abriendo Outlook…' : 'Continuar con Outlook / Hotmail'}
          </button>
        )}
        {SHOW_FACEBOOK && (
          <button type="button" className="btn btn-ghost social-btn" disabled={busy} aria-busy={going === 'facebook'} onClick={() => social('facebook')}>
            <FacebookMark /> {going === 'facebook' ? 'Abriendo Facebook…' : 'Continuar con Facebook'}
          </button>
        )}
        <button type="button" className="btn btn-ghost social-btn" disabled={busy} onClick={() => { setError(''); setMode(mode === 'email' ? 'phone' : 'email'); }}>
          {mode === 'email' ? <><PhoneMark /> Mejor con mi celular</> : <><MailMark /> Con correo y contraseña</>}
        </button>
      </div>

      {mode === 'email' && (
        <form className="stack gap-12" onSubmit={(e) => {
          e.preventDefault();
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError('Escribe un correo válido.'); return; }
          if (pass.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
          run(() => signInEmail(email.trim(), pass, create));
        }}>
          <div className="seg" role="radiogroup" aria-label="Tipo de acceso">
            <button type="button" role="radio" aria-checked={create} className={create ? 'on' : ''} onClick={() => setCreate(true)}>Crear cuenta</button>
            <button type="button" role="radio" aria-checked={!create} className={!create ? 'on' : ''} onClick={() => setCreate(false)}>Ya tengo cuenta</button>
          </div>
          <div className="field"><label htmlFor="em-in">Correo</label><input id="em-in" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field"><label htmlFor="pw-in">Contraseña</label><input id="pw-in" type="password" autoComplete={create ? 'new-password' : 'current-password'} minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} /></div>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Un momento…' : create ? 'Crear mi cuenta' : 'Entrar'}</button>
          {!create && (
            <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => {
              if (!email) { setError('Escribe tu correo y vuelve a tocar "Olvidé mi contraseña".'); return; }
              run(async () => { await resetPassword(email.trim()); setError('Te enviamos un correo para crear una nueva contraseña.'); });
            }}>Olvidé mi contraseña</button>
          )}
        </form>
      )}

      {mode === 'phone' && <div className="or-line"><span>o con tu celular</span></div>}

      {mode !== 'phone' ? null : !confirm ? (
        <form className="stack gap-12" onSubmit={(e) => {
          e.preventDefault();
          const n = e164Ecuador(phone);
          if (!n) { setError('Escribe tu celular de 10 dígitos, por ejemplo 0991234567.'); return; }
          run(async () => setConfirm(await sendSmsCode(n, 'recaptcha-box')));
        }}>
          <div className="field">
            <label htmlFor="cel">Celular</label>
            <input id="cel" type="tel" inputMode="tel" autoComplete="tel" placeholder="09XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Enviando…' : 'Enviarme un código por SMS'}</button>
        </form>
      ) : (
        <form className="stack gap-12" onSubmit={(e) => {
          e.preventDefault();
          run(() => confirm.confirm(code.trim()));
        }}>
          <div className="field">
            <label htmlFor="code">Código de 6 dígitos que llegó a {phone}</label>
            <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy || code.trim().length < 6}>{busy ? 'Verificando…' : 'Entrar'}</button>
          <button type="button" className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => { setConfirm(null); setCode(''); }}>Cambiar número</button>
        </form>
      )}
      <div id="recaptcha-box" />
      {error && <p role="alert" className="form-error">{error}</p>}
    </div>
  );
}


function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#F25022" /><rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" /><rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path fill="#fff" d="M13.4 19.5v-6.1h2.1l.3-2.4h-2.4V9.5c0-.7.2-1.2 1.2-1.2h1.3V6.2c-.2 0-1-.1-1.9-.1-1.9 0-3.1 1.1-3.1 3.2v1.8H8.8v2.4h2.1v6.1h2.5z" />
    </svg>
  );
}

function PhoneMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10.5 18.5h3" />
    </svg>
  );
}

function MailMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" />
    </svg>
  );
}
