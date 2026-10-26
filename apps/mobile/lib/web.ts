import { Linking } from 'react-native';
import { webLoginToken } from '@hulul/shared/firebase';
import { appAuth } from './auth';

type WebPath = '/profesionales/registro' | '/profesionales/agenda' | '/cuenta';

/**
 * Abre una página de hululec.com con la misma cuenta de la app (sin volver a
 * entrar): pide un pase de un solo uso y lo manda en el # de la dirección.
 * Sin sesión, o si falla el pase, abre la página normal (ahí se entra).
 */
export async function openWebAs(path: WebPath): Promise<void> {
  const plain = `https://hululec.com${path}`;
  if (!appAuth().currentUser) { await Linking.openURL(plain); return; }
  try {
    const token = await webLoginToken();
    await Linking.openURL(`https://hululec.com/entrar?next=${encodeURIComponent(path)}#token=${encodeURIComponent(token)}`);
  } catch {
    await Linking.openURL(plain);
  }
}
