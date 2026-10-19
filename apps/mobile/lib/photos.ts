/**
 * Fotos desde el celular: tomar con la cámara o elegir de la galería, y
 * subirlas a Storage. Los APK armados antes de este módulo no lo traen: ahí
 * `photosAvailable()` es false y la app no muestra los botones.
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { firebaseApp } from '@hulul/shared/firebase';

type PickerModule = typeof import('expo-image-picker');

function picker(): PickerModule | null {
  if (Platform.OS === 'web' || !requireOptionalNativeModule('ExponentImagePicker')) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-picker') as PickerModule;
  } catch {
    return null;
  }
}

export const photosAvailable = () => !!picker();

/** Toma una foto o elige varias de la galería. Devuelve las rutas locales (vacío si canceló). */
export async function pickPhotos(from: 'camara' | 'galeria', max: number): Promise<string[]> {
  const P = picker();
  if (!P || max <= 0) return [];
  const opts = { mediaTypes: ['images'] as ('images')[], quality: 0.6, allowsMultipleSelection: from === 'galeria', selectionLimit: max };
  if (from === 'camara') {
    const perm = await P.requestCameraPermissionsAsync();
    if (!perm.granted) throw Object.assign(new Error('camara'), { code: 'sin-permiso-camara' });
    const r = await P.launchCameraAsync(opts);
    return r.canceled ? [] : r.assets.map((a) => a.uri).slice(0, max);
  }
  const r = await P.launchImageLibraryAsync(opts);
  return r.canceled ? [] : r.assets.map((a) => a.uri).slice(0, max);
}

/** Sube fotos locales a Storage en `folder` y devuelve los enlaces de descarga. */
export async function uploadLocalPhotos(folder: string, uris: string[]): Promise<string[]> {
  const st = await import('firebase/storage');
  const storage = st.getStorage(firebaseApp());
  const urls: string[] = [];
  for (const uri of uris) {
    const blob = await (await fetch(uri)).blob();
    const r = st.ref(storage, `${folder}/${Date.now()}-${urls.length}.jpg`);
    await st.uploadBytes(r, blob, { contentType: blob.type || 'image/jpeg' });
    urls.push(await st.getDownloadURL(r));
  }
  return urls;
}
