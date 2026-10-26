'use client';

import { useState } from 'react';
import { MAX_DOC_MB, PROVIDER_DOCS, requiredDocs, type CategorySlug, type ProviderDocSpec } from '@hulul/shared';
import { canvasBlob, cedulaFace, distance, FACE_REJECT, facesIn, loadImg, saveCedulaFace, shrinkImage } from './face';
import { SelfieCamera } from './SelfieCamera';

/**
 * Paso "Documentos" con verificación en el momento, igual que el formulario
 * anónimo: cada documento se lee en el servidor apenas se sube y, si no pasa,
 * no deja continuar. La cédula (frente) debe tener rostro y la selfie se toma
 * con cámara en vivo y se compara con esa foto.
 */

type DocKey = ProviderDocSpec['key'];
export type DocCheck = { status: 'verificando' | 'ok' | 'revisar' | 'rechazado' | 'error'; msg: string; path?: string };
export type DocChecks = Partial<Record<DocKey, DocCheck>>;
type Uploaded = { path: string; name: string };

async function fb() {
  const [{ firebaseApp }, st] = await Promise.all([import('@hulul/shared/firebase'), import('firebase/storage')]);
  return { storage: st.getStorage(firebaseApp()), st };
}

async function uploadTo(uid: string, key: DocKey, blob: Blob, ext: string, contentType: string): Promise<string> {
  const { storage, st } = await fb();
  const path = `providers/${uid}/${key}-${Date.now()}.${ext}`;
  await st.uploadBytes(st.ref(storage, path), blob, { contentType });
  return path;
}

async function verify(key: DocKey, path: string, face?: { distance: number; liveness: boolean; mode: string; tries: number }): Promise<DocCheck> {
  try {
    const { verifyProviderDoc } = await import('@hulul/shared/firebase');
    const r = await verifyProviderDoc(key, path, face);
    return { status: r.status, msg: r.msg, path };
  } catch (e) {
    return { status: 'error', msg: (e as Error).message || 'No pudimos verificar el documento. Inténtalo otra vez.', path };
  }
}

/** ¿El documento está verificado (ok o revisar) sobre el archivo actual? */
export const docPasses = (c: DocCheck | undefined, path: string | undefined) => !!c && !!path && c.path === path && (c.status === 'ok' || c.status === 'revisar');

export function docsProblem(categories: CategorySlug[], docs: Partial<Record<DocKey, Uploaded>>, checks: DocChecks): string {
  const label = (k: DocKey) => PROVIDER_DOCS.find((d) => d.key === k)?.label ?? k;
  for (const k of requiredDocs(categories)) {
    if (!docs[k]) return `Falta: ${label(k)}.`;
    const c = checks[k];
    if (c?.status === 'verificando') return `Espera a que terminemos de verificar: ${label(k)}.`;
    if (!docPasses(c, docs[k]?.path)) return `${label(k)}: ${c?.msg || 'falta verificarlo. Vuelve a subirlo.'}`;
  }
  return '';
}

export function StepDocs({ uid, categories, docs, checks, setCheck, onUploaded }: {
  uid: string;
  categories: CategorySlug[];
  docs: Partial<Record<DocKey, Uploaded>>;
  checks: DocChecks;
  setCheck: (k: DocKey, c: DocCheck) => void;
  onUploaded: (k: DocKey, v: Uploaded) => Promise<void>;
}) {
  const required = requiredDocs(categories);
  return (
    <section className="stack gap-16">
      <h2 className="fs-title">4. Documentos</h2>
      <p className="muted" style={{ fontSize: 14 }}>
        Solo el equipo de HULUL los ve. Revisamos cada documento apenas lo subes: debe ser tuyo, vigente y verse claro. Fotos o PDF de hasta {MAX_DOC_MB} MB.
      </p>
      {PROVIDER_DOCS.map((spec) => spec.selfie ? (
        <SelfieRow key={spec.key} spec={spec} uid={uid} value={docs[spec.key]} check={checks[spec.key]} cedulaOk={docPasses(checks.cedulaFrente, docs.cedulaFrente?.path)}
          setCheck={(c) => setCheck(spec.key, c)} onUploaded={onUploaded} />
      ) : (
        <DocRow key={spec.key} spec={spec} uid={uid} required={required.includes(spec.key)} value={docs[spec.key]} check={checks[spec.key]}
          setCheck={(c) => setCheck(spec.key, c)} onUploaded={onUploaded} onCedula={() => setCheck('selfie', { status: 'error', msg: 'Cambiaste la foto de tu cédula: vuelve a tomar la selfie.' })} />
      ))}
    </section>
  );
}

function Status({ c, path }: { c?: DocCheck; path?: string }) {
  if (!c || (c.path && path && c.path !== path && c.status !== 'verificando')) return null;
  if (c.status === 'verificando') return <span className="doc-check wait">{c.msg || 'Verificando…'}</span>;
  if (c.status === 'ok') return <span className="doc-check ok">✓ Verificado</span>;
  if (c.status === 'revisar') return <span className="doc-check warn">✓ Recibido. {c.msg}</span>;
  return <span className="doc-check bad">{c.msg}</span>;
}

function DocRow({ spec, uid, required, value, check, setCheck, onUploaded, onCedula }: {
  spec: ProviderDocSpec; uid: string; required: boolean; value?: Uploaded; check?: DocCheck;
  setCheck: (c: DocCheck) => void; onUploaded: (k: DocKey, v: Uploaded) => Promise<void>; onCedula: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_DOC_MB * 1024 * 1024) { setCheck({ status: 'rechazado', msg: `El archivo pesa más de ${MAX_DOC_MB} MB.` }); return; }
    const isPdf = file.type === 'application/pdf';
    if (!(file.type.startsWith('image/') || isPdf)) { setCheck({ status: 'rechazado', msg: 'Sube una foto o un PDF.' }); return; }
    setBusy(true);
    try {
      let blob: Blob = file; let ext = isPdf ? 'pdf' : 'jpg'; let type = isPdf ? 'application/pdf' : 'image/jpeg';
      if (!isPdf) {
        const s = await shrinkImage(file);
        blob = s.blob;
        if (spec.key === 'cedulaFrente') {
          setCheck({ status: 'verificando', msg: 'Buscando el rostro en tu cédula…' });
          const faces = await facesIn(s.img);
          if (!faces.length) { setCheck({ status: 'rechazado', msg: 'No encontramos el rostro en la foto de tu cédula. Tómala de cerca, con buena luz y sin reflejos sobre la foto.' }); return; }
          saveCedulaFace(faces[0].descriptor);
          onCedula();
        }
      } else if (spec.key === 'cedulaFrente' || spec.key === 'cedulaReverso') {
        setCheck({ status: 'rechazado', msg: 'Sube una foto de tu cédula (no un PDF).' }); return;
      } else { type = 'application/pdf'; ext = 'pdf'; }
      setCheck({ status: 'verificando', msg: 'Subiendo…' });
      const path = await uploadTo(uid, spec.key, blob, ext, type);
      await onUploaded(spec.key, { path, name: file.name.slice(0, 120) });
      setCheck({ status: 'verificando', msg: 'Revisando tu documento…', path });
      setCheck(await verify(spec.key, path));
    } catch (e) {
      setCheck({ status: 'error', msg: (e as Error).message || 'No se pudo subir. Revisa tu conexión e inténtalo de nuevo.' });
    } finally {
      setBusy(false);
    }
  };
  const pass = docPasses(check, value?.path);
  return (
    <div className={`doc-row ${pass ? 'done' : ''}`}>
      <div className="stack gap-4" style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ fontSize: 15 }}>{spec.label} {required ? <span className="req">obligatorio</span> : <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>(opcional)</span>}</strong>
        <span className="muted" style={{ fontSize: 13 }}>{value && pass ? value.name : spec.help}</span>
        <Status c={check} path={value?.path} />
      </div>
      <label className={`btn ${pass ? 'btn-ghost' : 'btn-primary'} doc-btn`} aria-busy={busy}>
        {busy ? 'Revisando…' : value ? 'Cambiar' : 'Subir'}
        <input type="file" accept={spec.key.startsWith('cedula') ? 'image/*' : spec.accept} disabled={busy}
          onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
    </div>
  );
}

let tries = 0;

function SelfieRow({ spec, uid, value, check, cedulaOk, setCheck, onUploaded }: {
  spec: ProviderDocSpec; uid: string; value?: Uploaded; check?: DocCheck; cedulaOk: boolean;
  setCheck: (c: DocCheck) => void; onUploaded: (k: DocKey, v: Uploaded) => Promise<void>;
}) {
  const [cam, setCam] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [busy, setBusy] = useState(false);

  const finish = async (frames: HTMLCanvasElement[], meta: { liveness: boolean; mode: string }) => {
    const ref = cedulaFace();
    if (!ref) { setCheck({ status: 'error', msg: 'Vuelve a subir la foto del frente de tu cédula: con ella comparamos tu rostro.' }); return; }
    setBusy(true);
    setCheck({ status: 'verificando', msg: 'Comparando con tu cédula…' });
    try {
      tries += 1;
      const dists: number[] = [];
      for (const c of frames) {
        const faces = await facesIn(c);
        if (faces.length > 1) { setCheck({ status: 'rechazado', msg: 'Aparece más de un rostro. Toma la selfie solo tú.' }); return; }
        if (faces.length === 1) dists.push(distance(faces[0].descriptor, ref));
      }
      if (!dists.length) { setCheck({ status: 'rechazado', msg: 'No se ve bien tu rostro. Busca buena luz y vuelve a intentarlo.' }); return; }
      dists.sort((a, b) => a - b);
      const dist = Math.round(dists[Math.floor(dists.length / 2)] * 1000) / 1000;
      if (dist < 0.15 && !meta.liveness) { setCheck({ status: 'rechazado', msg: 'La selfie debe ser de tu rostro, no una foto de tu cédula.' }); return; }
      if (dist > FACE_REJECT) { setCheck({ status: 'rechazado', msg: 'Tu rostro no coincide con la foto de tu cédula. Verifica que la cédula sea tuya y que su foto se vea nítida; luego repite la selfie con buena luz, sin gorra ni lentes.' }); return; }
      const path = await uploadTo(uid, 'selfie', await canvasBlob(frames[frames.length - 1]), 'jpg', 'image/jpeg');
      await onUploaded('selfie', { path, name: 'selfie.jpg' });
      setCheck(await verify('selfie', path, { distance: dist, liveness: meta.liveness, mode: meta.mode, tries }));
    } catch (e) {
      setCheck({ status: 'error', msg: (e as Error).message || 'No se pudo comparar tu rostro. Inténtalo otra vez.' });
    } finally {
      setBusy(false);
    }
  };

  const fromFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const url = URL.createObjectURL(file);
      const img = await loadImg(url);
      URL.revokeObjectURL(url);
      const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
      cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
      await finish([cv], { liveness: false, mode: 'foto' });
    } catch { setCheck({ status: 'error', msg: 'No se pudo abrir la foto.' }); }
  };

  const pass = docPasses(check, value?.path);
  return (
    <div className={`doc-row ${pass ? 'done' : ''}`}>
      <div className="stack gap-4" style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ fontSize: 15 }}>{spec.label} <span className="req">obligatorio</span></strong>
        <span className="muted" style={{ fontSize: 13 }}>
          {cedulaOk ? 'Con la cámara en vivo: miras de frente, giras la cabeza y vuelves. La comparamos con la foto de tu cédula.' : 'Primero sube la foto del frente de tu cédula: con ella comparamos tu rostro.'}
        </span>
        <Status c={check} path={value?.path} />
      </div>
      <div className="stack gap-8" style={{ alignItems: 'flex-end' }}>
        <button type="button" className={`btn ${pass ? 'btn-ghost' : 'btn-primary'} doc-btn`} disabled={!cedulaOk || busy} onClick={() => setCam(true)}>
          {busy ? 'Comparando…' : pass ? 'Repetir' : 'Tomar selfie'}
        </button>
        {fallback && (
          <label className="btn btn-ghost doc-btn">
            Tomar foto
            <input type="file" accept="image/*" capture="user" onChange={(e) => { fromFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        )}
      </div>
      {cam && (
        <SelfieCamera
          onCancel={() => setCam(false)}
          onNoCamera={(msg) => { setCam(false); setFallback(true); setCheck({ status: 'error', msg }); }}
          onDone={(frames) => { setCam(false); finish(frames, { liveness: true, mode: 'camara' }); }} />
      )}
    </div>
  );
}
