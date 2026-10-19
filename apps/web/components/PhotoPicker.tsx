'use client';

import { useState } from 'react';

/**
 * Reduce la foto antes de subirla (lado mayor 1600 px, JPEG): sube rápido con
 * datos móviles. Si el navegador no puede leerla (p. ej. HEIC), sube la original.
 */
export async function shrinkImage(file: File, max = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}

/** Sube fotos a Storage en `folder` y devuelve sus enlaces de descarga. */
export async function uploadPhotos(folder: string, files: File[]): Promise<string[]> {
  const [{ firebaseApp }, st] = await Promise.all([import('@hulul/shared/firebase'), import('firebase/storage')]);
  const storage = st.getStorage(firebaseApp());
  const urls: string[] = [];
  for (const f of files) {
    const blob = await shrinkImage(f);
    const r = st.ref(storage, `${folder}/${Date.now()}-${urls.length}.jpg`);
    await st.uploadBytes(r, blob, { contentType: blob.type || 'image/jpeg' });
    urls.push(await st.getDownloadURL(r));
  }
  return urls;
}

/**
 * Fotos opcionales con dos botones: "Tomar foto" (abre la cámara del celular)
 * y "Galería". Muestra miniaturas y permite quitar una antes de enviar.
 */
export function PhotoPicker({ folder, max, value, onChange, label, help }: {
  folder: string; max: number; value: string[]; onChange: (v: string[]) => void; label: string; help?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const full = value.length >= max;

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setErr('');
    const files = Array.from(list).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)).slice(0, max - value.length);
    if (!files.length) { setErr(full ? `Máximo ${max} fotos.` : 'Elige fotos (imágenes).'); return; }
    if (files.some((f) => f.size > 20 * 1024 * 1024)) { setErr('Cada foto debe pesar menos de 20 MB.'); return; }
    setBusy(true);
    try {
      onChange([...value, ...(await uploadPhotos(folder, files))]);
    } catch (e) {
      setErr(`No se pudieron subir las fotos (${(e as { code?: string })?.code ?? 'error'}). Revisa tu conexión e inténtalo de nuevo.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack gap-8">
      <strong style={{ fontSize: 15 }}>{label}</strong>
      {help && <span className="muted" style={{ fontSize: 13.5 }}>{help}</span>}
      {value.length > 0 && (
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          {value.map((u, i) => (
            <div key={u} style={{ position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Foto ${i + 1}`} style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
              <button type="button" aria-label={`Quitar foto ${i + 1}`} onClick={() => onChange(value.filter((x) => x !== u))}
                style={{ position: 'absolute', top: -8, right: -8, width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'var(--text)', color: 'var(--surface)', cursor: 'pointer', fontWeight: 700 }}>×</button>
            </div>
          ))}
        </div>
      )}
      <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
        <label className="btn btn-ghost doc-btn" aria-busy={busy} aria-disabled={busy || full}>
          {busy ? 'Subiendo…' : '📷 Tomar foto'}
          <input type="file" accept="image/*" capture="environment" disabled={busy || full} onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
        </label>
        <label className="btn btn-ghost doc-btn" aria-disabled={busy || full}>
          Galería
          <input type="file" accept="image/*" multiple disabled={busy || full} onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
        </label>
        <span className="muted" style={{ fontSize: 13, alignSelf: 'center' }}>{value.length}/{max}</span>
      </div>
      {err && <p role="alert" className="form-error">{err}</p>}
    </div>
  );
}
