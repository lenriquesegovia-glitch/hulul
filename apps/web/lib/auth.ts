'use client';

/**
 * Cuentas en la web (Firebase Authentication): Google, Outlook, Facebook,
 * correo y contraseña o celular con código SMS. Una sola cuenta por correo.
 * Se carga solo en las páginas que lo usan.
 */
import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  FacebookAuthProvider,
  getAuth,
  getRedirectResult,
  linkWithCredential,
  type AuthCredential,
  type UserCredential,
  GoogleAuthProvider,
  OAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  type AuthProvider,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
  type ConfirmationResult,
  type User,
} from 'firebase/auth';
import { firebaseApp } from '@hulul/shared/firebase';

let auth: Auth | null = null;
export function webAuth(): Auth {
  if (!auth) {
    auth = getAuth(firebaseApp());
    auth.languageCode = 'es';
  }
  return auth;
}

/** Usuario actual; `undefined` mientras Firebase revisa si hay sesión. */
export function useUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(webAuth(), setUser), []);
  return user;
}

export const PROVIDER_LABEL: Record<SocialProvider, string> = {
  google: 'Google',
  microsoft: 'Outlook / Hotmail',
  facebook: 'Facebook',
};

/**
 * Navegador interno de Facebook, Instagram, Messenger, WhatsApp o TikTok.
 * Google no permite entrar desde ahí y las ventanas emergentes fallan, así que
 * se pide abrir hululec.com en Chrome o Safari.
 */
export function inAppBrowser(): string | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/FBAN|FBAV|FB_IAB|Messenger/i.test(ua)) return 'Facebook';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/WhatsApp/i.test(ua)) return 'WhatsApp';
  if (/musical_ly|Bytedance|TikTok/i.test(ua)) return 'TikTok';
  return null;
}

/** Celular o tableta: ahí la ventana emergente suele bloquearse; se usa redirección directa. */
function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

// ---- Unir cuentas con el mismo correo -------------------------------------
// Si alguien entró primero con Google y luego toca Facebook (mismo correo),
// Firebase lo rechaza. Se guarda la credencial de Facebook y, cuando entra con
// el método original, se le une: desde entonces sirven los dos.

const PENDING_KEY = 'hulul.pendingLink';
let pending: { cred: AuthCredential; provider: SocialProvider; email?: string } | null = null;

function credentialFromError(name: SocialProvider, e: unknown): AuthCredential | null {
  const err = e as Parameters<typeof OAuthProvider.credentialFromError>[0];
  if (name === 'facebook') return FacebookAuthProvider.credentialFromError(err);
  if (name === 'google') return GoogleAuthProvider.credentialFromError(err);
  return OAuthProvider.credentialFromError(err);
}

function savePending(name: SocialProvider, e: unknown) {
  const cred = credentialFromError(name, e);
  if (!cred) return;
  const email = (e as { customData?: { email?: string } }).customData?.email;
  pending = { cred, provider: name, email };
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify({ provider: name, email, cred: cred.toJSON() })); } catch { /* sin almacenamiento */ }
}

function loadPending() {
  if (pending) return pending;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { provider: SocialProvider; email?: string; cred: object };
    const cred = OAuthProvider.credentialFromJSON(j.cred);
    pending = { cred, provider: j.provider, email: j.email };
    return pending;
  } catch {
    return null;
  }
}

function clearPending() {
  pending = null;
  try { sessionStorage.removeItem(PENDING_KEY); } catch { /* sin almacenamiento */ }
}

/** Método que quedó esperando a unirse (para mostrar el aviso). */
export function pendingLink(): { provider: SocialProvider; email?: string } | null {
  const p = loadPending();
  return p ? { provider: p.provider, email: p.email } : null;
}

/** Tras entrar con el método original, une el que había quedado pendiente. */
async function finishLink(res: UserCredential | null): Promise<void> {
  const p = loadPending();
  if (!res || !p) return;
  if (p.email && res.user.email && p.email.toLowerCase() !== res.user.email.toLowerCase()) return;
  try {
    await linkWithCredential(res.user, p.cred);
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code !== 'auth/provider-already-linked' && code !== 'auth/credential-already-in-use') throw e;
  } finally {
    clearPending();
  }
}

/**
 * Llamar una vez al mostrar la pantalla de acceso: termina una entrada que
 * volvió por redirección (celulares) y devuelve su error, si lo hubo.
 */
export async function completeRedirectSignIn(): Promise<void> {
  const name = (() => { try { return sessionStorage.getItem('hulul.redirectProvider') as SocialProvider | null; } catch { return null; } })();
  try {
    const res = await getRedirectResult(webAuth());
    await finishLink(res);
  } catch (e) {
    if (name && (e as { code?: string }).code === 'auth/account-exists-with-different-credential') savePending(name, e);
    throw Object.assign(e as object, { provider: name ?? undefined });
  } finally {
    try { sessionStorage.removeItem('hulul.redirectProvider'); } catch { /* sin almacenamiento */ }
  }
}

export type SocialProvider = 'google' | 'microsoft' | 'facebook';

function providerFor(name: SocialProvider): AuthProvider {
  if (name === 'microsoft') {
    // Cuentas personales (Outlook, Hotmail, Live) y de empresa.
    const p = new OAuthProvider('microsoft.com');
    p.addScope('email');
    p.addScope('profile');
    p.setCustomParameters({ prompt: 'select_account' });
    return p;
  }
  if (name === 'facebook') {
    const p = new FacebookAuthProvider();
    p.addScope('email');
    // Si la persona negó el correo antes, Facebook se lo vuelve a pedir.
    p.setCustomParameters({ auth_type: 'rerequest' });
    return p;
  }
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
}

async function goRedirect(name: SocialProvider, provider: AuthProvider) {
  try { sessionStorage.setItem('hulul.redirectProvider', name); } catch { /* sin almacenamiento */ }
  await signInWithRedirect(webAuth(), provider);
}

/** Google, Microsoft (Outlook, Hotmail) o Facebook. */
export async function signInSocial(name: SocialProvider): Promise<void> {
  const app = inAppBrowser();
  if (app) throw Object.assign(new Error('in-app'), { code: 'auth/in-app-browser', app, provider: name });
  const provider = providerFor(name);
  // En el celular, la ventana emergente se bloquea o se pierde entre pestañas:
  // se va al proveedor y vuelve (solo si el dominio de acceso es hululec.com,
  // porque con firebaseapp.com Safari pierde la sesión al volver).
  const sameSite = typeof location !== 'undefined' && webAuth().config.authDomain === location.host;
  if (isMobile() && sameSite) return goRedirect(name, provider);
  try {
    const res = await signInWithPopup(webAuth(), provider);
    await finishLink(res);
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') return goRedirect(name, provider);
    if (code === 'auth/account-exists-with-different-credential') savePending(name, e);
    throw Object.assign(e as object, { provider: name });
  }
}

let verifier: RecaptchaVerifier | null = null;

/** Envía el código SMS. `containerId` es un div vacío para la verificación anti-robots. */
export async function sendSmsCode(phoneE164: string, containerId: string): Promise<ConfirmationResult> {
  if (!verifier) verifier = new RecaptchaVerifier(webAuth(), containerId, { size: 'invisible' });
  try {
    return await signInWithPhoneNumber(webAuth(), phoneE164, verifier);
  } catch (e) {
    verifier.clear();
    verifier = null;
    throw e;
  }
}

export const signInGoogle = () => signInSocial('google');

/** Correo y contraseña: entra si existe, o crea la cuenta. */
export async function signInEmail(email: string, password: string, create: boolean): Promise<void> {
  const res = create
    ? await createUserWithEmailAndPassword(webAuth(), email, password)
    : await signInWithEmailAndPassword(webAuth(), email, password);
  await finishLink(res);
}

export const resetPassword = (email: string) => sendPasswordResetEmail(webAuth(), email);

export const logout = () => signOut(webAuth());

/** Mensaje claro para los errores más comunes de Firebase Authentication. */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  const prov = (e as { provider?: SocialProvider }).provider;
  const name = prov ? PROVIDER_LABEL[prov] : 'la cuenta';
  if (code === 'auth/in-app-browser') {
    const app = (e as { app?: string }).app ?? 'esta app';
    return `Estás dentro de ${app} y desde ahí no se puede entrar con ${name}. Toca ⋮ o ··· arriba y elige "Abrir en el navegador" (Chrome o Safari), o entra con tu correo o celular.`;
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return `Cerraste la ventana de ${name} antes de terminar.`;
  if (code === 'auth/account-exists-with-different-credential') {
    const email = (e as { customData?: { email?: string } }).customData?.email;
    return `${email ? `El correo ${email}` : 'Ese correo'} ya tiene cuenta en HULUL con otro método. Entra con el que usaste la primera vez (Google, Facebook o correo y contraseña) y ${name} quedará unido a tu cuenta para la próxima.`;
  }
  if (code === 'auth/operation-not-allowed') return `Entrar con ${name} aún no está activado en HULUL. Usa otra opción.`;
  if (code === 'auth/user-disabled') return 'Esta cuenta está desactivada. Escríbenos a reservas@hululec.com.';
  if (code === 'auth/web-storage-unsupported') return 'Tu navegador bloquea el inicio de sesión (modo privado o cookies desactivadas). Prueba en una ventana normal.';
  const map: Record<string, string> = {
    'auth/invalid-phone-number': 'Ese número de celular no es válido.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos y vuelve a intentar.',
    'auth/invalid-verification-code': 'El código no es correcto. Revísalo e inténtalo de nuevo.',
    'auth/code-expired': 'El código venció. Pide uno nuevo.',
    'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar.',
    'auth/cancelled-popup-request': 'Cerraste la ventana de Google antes de terminar.',
    'auth/operation-not-allowed': 'Este método de acceso aún no está activado en HULUL.',
    'auth/unauthorized-domain': 'Este sitio aún no está autorizado para iniciar sesión.',
    'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
    'auth/quota-exceeded': 'No pudimos enviar el SMS en este momento. Prueba con otra opción.',
    'auth/account-exists-with-different-credential': 'Ya tienes una cuenta con ese correo usando otro método. Entra con el método que usaste la primera vez.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Elige "Ya tengo cuenta".',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'No hay una cuenta con ese correo. Elige "Crear cuenta".',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-email': 'Ese correo no es válido.',
  };
  return map[code] ?? 'No pudimos iniciar sesión. Inténtalo de nuevo.';
}
