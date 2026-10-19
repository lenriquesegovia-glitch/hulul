/**
 * Cuentas en la app (Firebase Authentication con sesión guardada en el
 * celular). En Expo Go se entra con correo y contraseña; Google, Facebook y
 * celular por SMS llegan con la app compilada para las tiendas.
 * Es la misma cuenta que en la web.
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FirebaseAuth from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type Persistence,
  type User,
} from 'firebase/auth';
import { firebaseApp } from '@hulul/shared/firebase';

// getReactNativePersistence existe en la versión de Firebase para React Native,
// pero no aparece en los tipos de la versión web.
const rnPersistence = (FirebaseAuth as unknown as { getReactNativePersistence: (s: typeof AsyncStorage) => Persistence }).getReactNativePersistence;

let auth: Auth | null = null;
export function appAuth(): Auth {
  if (auth) return auth;
  try {
    auth = initializeAuth(firebaseApp(), { persistence: rnPersistence(AsyncStorage) });
  } catch {
    auth = getAuth(firebaseApp());
  }
  auth.languageCode = 'es';
  return auth;
}

/** Usuario actual; `undefined` mientras se revisa si hay sesión guardada. */
export function useUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(appAuth(), setUser), []);
  return user;
}

export async function signInEmail(email: string, password: string, create: boolean): Promise<void> {
  if (create) await createUserWithEmailAndPassword(appAuth(), email, password);
  else await signInWithEmailAndPassword(appAuth(), email, password);
}

export const resetPassword = (email: string) => sendPasswordResetEmail(appAuth(), email);
export const logout = () => signOut(appAuth());

export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  const map: Record<string, string> = {
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Elige "Ya tengo cuenta".',
    'auth/invalid-credential': 'Correo o contraseña incorrectos. Si creaste tu cuenta con Google o Facebook en hululec.com, aún no tiene contraseña: toca "Olvidé mi contraseña" para crearle una y entra con ella.',
    'auth/wrong-password': 'Correo o contraseña incorrectos. Si creaste tu cuenta con Google o Facebook en hululec.com, toca "Olvidé mi contraseña" para crearle una.',
    'auth/user-not-found': 'No hay una cuenta con ese correo. Elige "Crear cuenta".',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-email': 'Ese correo no es válido.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
    'auth/operation-not-allowed': 'El acceso con correo aún no está activado en HULUL.',
    'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
  };
  return map[code] ?? 'No pudimos iniciar sesión. Inténtalo de nuevo.';
}
