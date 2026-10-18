'use client';

/**
 * Cuentas en la web (Firebase Authentication): Google o celular con código SMS.
 * Se carga solo en las páginas que lo usan.
 */
import { useEffect, useState } from 'react';
import {
  getAuth,
  GoogleAuthProvider,
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

export async function signInGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(webAuth(), provider);
  } catch (e) {
    // Si el navegador bloquea la ventana emergente, se va a Google y vuelve.
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(webAuth(), provider);
      return;
    }
    throw e;
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

export const logout = () => signOut(webAuth());

/** Mensaje claro para los errores más comunes de Firebase Authentication. */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
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
    'auth/quota-exceeded': 'No pudimos enviar el SMS en este momento. Prueba con Google.',
  };
  return map[code] ?? 'No pudimos iniciar sesión. Inténtalo de nuevo.';
}
