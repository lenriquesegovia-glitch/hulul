'use client';

import { useEffect, useRef, useState } from 'react';
import { faceYaw, grab, loadFace } from './face';

/**
 * Selfie con cámara en vivo y prueba de vida (igual que el formulario anónimo):
 * mirar de frente → girar la cabeza → volver. Una foto o una pantalla fija no
 * puede girar. Devuelve 3 cuadros de frente para comparar con la cédula.
 */
export function SelfieCamera({ onDone, onCancel, onNoCamera }: {
  onDone: (frames: HTMLCanvasElement[]) => void;
  onCancel: () => void;
  onNoCamera: (msg: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [msg, setMsg] = useState('Preparando la cámara…');
  const [phase, setPhase] = useState(0);
  // Los avisos al padre van por referencia para que la cámara no se reinicie en cada render.
  const done = useRef(onDone); done.current = onDone;
  const noCam = useRef(onNoCamera); noCam.current = onNoCamera;

  useEffect(() => {
    let stop = false;
    let stream: MediaStream | null = null;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const say = (t: string) => { if (!stop) setMsg(t); };
    (async () => {
      let fa;
      try { fa = await loadFace(); } catch (e) { noCam.current((e as Error).message); return; }
      if (stop) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } }, audio: false });
      } catch {
        noCam.current('No pudimos abrir la cámara en vivo. Da permiso de cámara a esta página y vuelve a intentarlo, o toma la foto con el botón «Tomar foto» (la revisaremos a mano).');
        return;
      }
      if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
      const v = video.current!;
      v.srcObject = stream;
      try { await v.play(); } catch { /* algunos navegadores ya reproducen solos */ }
      const opts = new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
      let ph = 0; let base = 0; const t0 = Date.now(); const shots: HTMLCanvasElement[] = []; const first: number[] = [];
      while (!stop) {
        if (Date.now() - t0 > 90_000) { noCam.current('Se acabó el tiempo para la selfie. Busca buena luz y vuelve a intentarlo.'); return; }
        if (!v.videoWidth) { await sleep(100); continue; }
        const r = await fa.detectAllFaces(v, opts).withFaceLandmarks();
        if (stop) return;
        if (r.length !== 1) { say(r.length ? 'Que solo aparezca tu rostro en la cámara.' : 'Pon tu rostro dentro del óvalo.'); first.length = 0; await sleep(120); continue; }
        const yaw = faceYaw(r[0].landmarks.positions);
        if (r[0].detection.box.width / v.videoWidth < 0.18) { say('Acércate un poco más a la cámara.'); first.length = 0; await sleep(120); continue; }
        if (ph === 0) {
          say('Mira de frente a la cámara y quédate quieto…');
          if (Math.abs(yaw) > 0.25) first.length = 0;
          else {
            first.push(yaw);
            if (first.length >= 4) {
              if (Math.max(...first) - Math.min(...first) < 0.06) { base = first.reduce((a, b) => a + b, 0) / first.length; ph = 1; } else first.shift();
            }
          }
        } else if (ph === 1) {
          say('Ahora gira la cabeza despacio hacia un lado…');
          if (Math.abs(yaw - base) > 0.2) ph = 2;
        } else {
          say('¡Bien! Vuelve a mirar de frente…');
          if (Math.abs(yaw - base) < 0.07) { shots.push(grab(v)); if (shots.length >= 3) break; } else shots.length = 0;
        }
        setPhase(ph);
        await sleep(80);
      }
      if (stop) return;
      setPhase(3); say('Comparando con tu cédula…');
      stream.getTracks().forEach((t) => t.stop());
      done.current(shots);
    })();
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  return (
    <div className="cam" role="dialog" aria-modal="true" aria-label="Selfie con prueba de vida">
      <div className="cam-box">
        <video ref={video} playsInline muted autoPlay />
        <div className="cam-oval" />
      </div>
      <p className="cam-msg" aria-live="polite">{msg}</p>
      <div className="cam-steps">{[0, 1, 2].map((i) => <i key={i} className={i < phase ? 'on' : ''} />)}</div>
      <button type="button" className="btn btn-ghost cam-cancel" onClick={onCancel}>Cancelar</button>
    </div>
  );
}
