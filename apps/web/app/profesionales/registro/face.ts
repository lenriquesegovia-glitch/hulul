'use client';

/**
 * Rostro en el navegador, igual que el formulario anónimo: @vladmandic/face-api
 * corre en el celular (la cara no se envía a terceros). Se usa para encontrar
 * el rostro de la cédula y compararlo con la selfie.
 */

const FACE_LIB = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/dist/face-api.js';
const FACE_MODELS = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/';
const DESC_KEY = 'hulul.cedulaFace';

/** Mismos umbrales que el servidor (functions/doc-verify.js). */
export const FACE_REJECT = 0.5;

/* eslint-disable @typescript-eslint/no-explicit-any */
type FaceApi = any;
declare global { interface Window { faceapi?: FaceApi } }

let ready: Promise<FaceApi> | null = null;

export function loadFace(): Promise<FaceApi> {
  if (ready) return ready;
  ready = (window.faceapi ? Promise.resolve() : new Promise<void>((res, rej) => {
    const s = document.createElement('script');
    s.src = FACE_LIB; s.onload = () => res();
    s.onerror = () => rej(new Error('No se pudo cargar el verificador de rostro. Revisa tu conexión e inténtalo otra vez.'));
    document.head.appendChild(s);
  }))
    .then(async () => {
      const fa = window.faceapi!;
      let ok = false;
      try { ok = await fa.tf.setBackend('webgl'); } catch { /* sin WebGL */ }
      if (!ok) await fa.tf.setBackend('cpu');
      await fa.tf.ready();
      await Promise.all([
        fa.nets.ssdMobilenetv1.loadFromUri(FACE_MODELS),
        fa.nets.tinyFaceDetector.loadFromUri(FACE_MODELS),
        fa.nets.faceLandmark68Net.loadFromUri(FACE_MODELS),
        fa.nets.faceRecognitionNet.loadFromUri(FACE_MODELS),
      ]);
      return fa;
    })
    .catch((e) => { ready = null; throw new Error(/verificador/.test(e?.message ?? '') ? e.message : 'No se pudo preparar el verificador de rostro. Revisa tu conexión e inténtalo otra vez.'); });
  return ready;
}

export function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('No se pudo abrir la imagen.')); i.src = src; });
}

/** Rostros de una imagen o cuadro, del más grande al más chico. */
export async function facesIn(src: HTMLImageElement | HTMLCanvasElement): Promise<{ descriptor: Float32Array; detection: { box: { area: number } } }[]> {
  const fa = await loadFace();
  const r = await fa.detectAllFaces(src, new fa.SsdMobilenetv1Options({ minConfidence: 0.45 })).withFaceLandmarks().withFaceDescriptors();
  return r.sort((a: any, b: any) => b.detection.box.area - a.detection.box.area);
}

/** Giro horizontal de la cabeza: nariz respecto al centro de los ojos (0 = de frente). */
export function faceYaw(p: { x: number; y: number }[]): number {
  const eL = p[36], eR = p[45], nose = p[30];
  return (nose.x - (eL.x + eR.x) / 2) / Math.max(1, eR.x - eL.x);
}

export function grab(video: HTMLVideoElement): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = video.videoWidth; cv.height = video.videoHeight;
  cv.getContext('2d')!.drawImage(video, 0, 0);
  return cv;
}

export function distance(a: Float32Array, b: Float32Array): number {
  return window.faceapi!.euclideanDistance(a, b);
}

/** Rostro de la cédula: se guarda en esta pestaña para comparar la selfie. */
export function saveCedulaFace(d: Float32Array | null) {
  try {
    if (d) sessionStorage.setItem(DESC_KEY, JSON.stringify(Array.from(d)));
    else sessionStorage.removeItem(DESC_KEY);
  } catch { /* sin almacenamiento */ }
}
export function cedulaFace(): Float32Array | null {
  try {
    const raw = sessionStorage.getItem(DESC_KEY);
    return raw ? new Float32Array(JSON.parse(raw)) : null;
  } catch { return null; }
}

/** Foto reducida (máx. 1600 px) en JPEG, para subir más rápido y que el OCR la lea bien. */
export async function shrinkImage(file: File, max = 1600): Promise<{ blob: Blob; img: HTMLImageElement }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImg(url);
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
    cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo preparar la foto.'))), 'image/jpeg', 0.88));
    const small = await loadImg(cv.toDataURL('image/jpeg', 0.88));
    return { blob, img: small };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const canvasBlob = (cv: HTMLCanvasElement) => new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('No se pudo preparar la foto.'))), 'image/jpeg', 0.88));
