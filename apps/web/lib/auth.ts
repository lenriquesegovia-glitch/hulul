'use client';

/**
 * Cuentas en la web (Firebase Authentication): Google o celular con código SMS.
 * Se carga solo en las páginas que lo usan.
 */
import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  FacebookAuthProvider,
  getAuth,
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

export type SocialProvider = 'google' | 'microsoft' | 'facebook';

function providerFor(name: SocialProvider): AuthProvider {
  if (name === 'microsoft') {
    const p = new OAuthProvider('microsoft.com');
    p.setCustomParameters({ prompt: 'select_account' });
    return p;
  }
  if (name === 'facebook') {
    const p = new FacebookAuthProvider();
    p.addScope('email');
    return p;
  }
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
}

/** Google, Microsoft (Outlook, Hotmail) o Facebook. */
export async function signInSocial(name: SocialProvider): Promise<void> {
  const provider = providerFor(name);
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

export const signInGoogle = () => signInSocial('google');

/** Correo y contraseña: entra si existe, o crea la cuenta. */
export async function signInEmail(email: string, password: string, create: boolean): Promise<void> {
  if (create) await createUserWithEmailAndPassword(webAuth(), email, password);
  else await signInWithEmailAndPassword(webAuth(), email, password);
}

export const resetPassword = (email: string) => sendPasswordResetEmail(webAuth(), email);

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
