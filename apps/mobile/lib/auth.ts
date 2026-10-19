/**
 * Cuentas en la app (Firebase Authentication con sesión guardada en el
 * celular). En Expo Go se entra con correo y contraseña; Google, Facebook y
 * celular por SMS llegan con la app compilada para las tiendas.
 * Es la misma cuenta que en la web.
 */
import { useEffect, useState } from 'react';
import { TurboModuleRegistry } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FirebaseAuth from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
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

/** Id del cliente web de Google (sale de google-services.json al armar el APK). */
const googleWebClientId = (Constants.expoConfig?.extra as { googleWebClientId?: string } | undefined)?.googleWebClientId ?? '';

type GoogleModule = typeof import('@react-native-google-signin/google-signin');
let googleConfigured = false;

/** El módulo de Google, o null si este APK no lo trae o no hay cliente configurado. */
function google(): GoogleModule | null {
  if (!googleWebClientId) return null;
  if (!TurboModuleRegistry.get('RNGoogleSignin')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('@react-native-google-signin/google-signin') as GoogleModule;
    if (!googleConfigured) { m.GoogleSignin.configure({ webClientId: googleWebClientId }); googleConfigured = true; }
    return m;
  } catch {
    return null;
  }
}

/** ¿Se puede entrar con Google en este APK? */
export const googleAvailable = () => !!google();

/**
 * Entra con la cuenta de Google del celular. Es la misma cuenta que "Continuar
 * con Google" en hululec.com. Devuelve false si la persona cerró la ventana.
 */
export async function signInGoogle(): Promise<boolean> {
  const m = google();
  if (!m) throw Object.assign(new Error('google'), { code: 'auth/google-unavailable' });
  await m.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await m.GoogleSignin.signIn();
  if (res.type !== 'success') return false;
  const idToken = res.data.idToken;
  if (!idToken) throw Object.assign(new Error('google'), { code: 'auth/google-no-token' });
  await signInWithCredential(appAuth(), GoogleAuthProvider.credential(idToken));
  return true;
}

export const resetPassword = (email: string) => sendPasswordResetEmail(appAuth(), email);
export const logout = async () => {
  await signOut(appAuth());
  // Para que la próxima vez deje elegir otra cuenta de Google.
  try { await google()?.GoogleSignin.signOut(); } catch { /* sin Google */ }
};

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
    'auth/google-unavailable': 'Entrar con Google aún no está disponible en esta versión de la app.',
    'auth/google-no-token': 'Google no devolvió los datos de tu cuenta. Inténtalo de nuevo.',
    'auth/account-exists-with-different-credential': 'Ese correo ya tiene cuenta con otro método. Entra con tu correo y contraseña.',
    DEVELOPER_ERROR: 'Falta terminar de configurar el acceso con Google (huella SHA-1 en Firebase).',
  };
  return map[code] ?? 'No pudimos iniciar sesión. Inténtalo de nuevo.';
}
