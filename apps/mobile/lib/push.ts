/**
 * Notificaciones en el celular (como Pedidos Ya): al profesional le suena una
 * reserva nueva, y al cliente cada paso de su servicio, aunque la app esté
 * cerrada. El servidor (funciones de Firebase) las envía por el servicio de
 * Expo a los celulares registrados de cada cuenta.
 *
 * Los APK armados antes de las notificaciones no traen el módulo nativo: en
 * ellos todo esto no hace nada (y la app no se cae al recibir esta versión).
 */
import { useEffect, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { registerPushToken } from '@hulul/shared/firebase';
import { useUser } from '@/lib/auth';

type NotificationsModule = typeof import('expo-notifications');

/** El módulo de notificaciones, o null si este APK no lo trae. */
function notifications(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  if (!requireOptionalNativeModule('ExpoPushTokenManager')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

/** Canal de Android con sonido y vibración fuerte (el que usa el servidor). */
export const PUSH_CHANNEL = 'pedidos';

let handlerSet = false;

async function setup(N: NotificationsModule): Promise<string | null> {
  if (!handlerSet) {
    handlerSet = true;
    // También suena y se muestra si la app está abierta.
    N.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
  }
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync(PUSH_CHANNEL, {
      name: 'Reservas y avisos de servicio',
      description: 'Reservas nuevas, profesional en camino, llegada y fin del servicio.',
      importance: N.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 600, 250, 600, 250, 600],
      lightColor: '#7A1E2C',
      lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
    });
  }
  const perm = await N.getPermissionsAsync();
  let granted = perm.granted;
  if (!granted && perm.canAskAgain) granted = (await N.requestPermissionsAsync()).granted;
  if (!granted) return null;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId
    ?? (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  const { data } = await N.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return data;
}

/** Al tocar una notificación: el profesional va a su agenda; el cliente, a su reserva. */
function openFrom(data: Record<string, unknown> | undefined) {
  if (!data) return;
  if (typeof data.url === 'string' && data.url.startsWith('https://hululec.com/')) {
    Linking.openURL(data.url).catch(() => {});
    return;
  }
  if (typeof data.bookingId === 'string' && /^[A-Za-z0-9]{10,40}$/.test(data.bookingId)) {
    router.push({ pathname: '/reserva/[id]', params: { id: data.bookingId } });
  }
}

/**
 * Registra este celular para recibir avisos de la cuenta con sesión abierta y
 * abre la pantalla correcta al tocar una notificación. Va una vez, en el layout.
 */
export function usePushNotifications() {
  const user = useUser();
  const last = useRef('');

  useEffect(() => {
    const N = notifications();
    if (!N || !user) return;
    let off = false;
    setup(N)
      .then((token) => {
        if (off || !token) return;
        const key = `${user.uid}|${token}`;
        if (last.current === key) return;
        last.current = key;
        return registerPushToken(token, Platform.OS);
      })
      .catch(() => { /* sin permiso o sin conexión: se intenta la próxima vez */ });
    return () => { off = true; };
  }, [user]);

  useEffect(() => {
    const N = notifications();
    if (!N) return;
    // Si la app se abrió tocando una notificación.
    N.getLastNotificationResponseAsync()
      // Pequeña espera para que la navegación esté lista.
      .then((r) => { if (r) setTimeout(() => openFrom(r.notification.request.content.data as Record<string, unknown> | undefined), 600); })
      .catch(() => {});
    const sub = N.addNotificationResponseReceivedListener((r) => openFrom(r.notification.request.content.data as Record<string, unknown> | undefined));
    return () => sub.remove();
  }, []);
}
