'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@hulul/shared/firebase';
import { uploadPhotos } from '@/components/PhotoPicker';
import { hasProfanity, PROFANITY_MESSAGE } from '@hulul/shared';

const hhmm = (d?: Date) => (d ? d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '');

/**
 * Chat de la reserva entre cliente y profesional, sin compartir números.
 * El profesional puede pedir fotos; el cliente las envía con la cámara o la
 * galería. Todo queda guardado en la reserva como respaldo.
 */
export function Chat({ bookingId, uid, me, otherName, open }: {
  bookingId: string; uid: string; me: 'cliente' | 'profesional'; otherName: string; open: boolean;
}) {
  const [list, setList] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let unsub = () => {};
    let off = false;
    import('@hulul/shared/firebase').then(({ watchChat }) => { if (!off) unsub = watchChat(bookingId, setList); });
    return () => { off = true; unsub(); };
  }, [bookingId]);

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [list?.length]);

  const send = async (m: { kind: 'texto' | 'foto' | 'pedir_fotos'; text?: string; photo?: string }) => {
    setErr('');
    const { sendChat } = await import('@hulul/shared/firebase');
    await sendChat(bookingId, { from: me, uid, ...m });
  };

  const sendText = async () => {
    const t = text.trim();
    if (!t) return;
    if (hasProfanity(t)) { setErr(PROFANITY_MESSAGE); return; }
    setBusy(true);
    try { await send({ kind: 'texto', text: t }); setText(''); } catch { setErr('No se pudo enviar. Revisa tu conexión.'); } finally { setBusy(false); }
  };

  const sendPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErr('');
    try {
      const urls = await uploadPhotos(`chat/${bookingId}/${uid}`, Array.from(files).slice(0, 4));
      for (const u of urls) await send({ kind: 'foto', photo: u });
    } catch (e) {
      setErr(`No se pudo enviar la foto (${(e as { code?: string })?.code ?? 'error'}).`);
    } finally {
      setBusy(false);
    }
  };

  const askPhotos = async () => {
    setBusy(true);
    try { await send({ kind: 'pedir_fotos', text: text.trim() || 'Para preparar mejor tu servicio, ¿me envías unas fotos?' }); setText(''); } catch { setErr('No se pudo enviar.'); } finally { setBusy(false); }
  };

  const lastAsk = list && [...list].reverse().find((m) => m.kind === 'pedir_fotos');
  const answered = lastAsk && list!.some((m) => m.kind === 'foto' && m.from === 'cliente' && (m.at?.getTime() ?? 0) >= (lastAsk.at?.getTime() ?? 0));

  const PhotoButtons = ({ primary = false }: { primary?: boolean }) => (
    <>
      <label className={`btn ${primary ? 'btn-primary' : 'btn-ghost'} doc-btn`} aria-busy={busy}>
        📷 Tomar foto
        <input type="file" accept="image/*" capture="environment" disabled={busy} onChange={(e) => { sendPhotos(e.target.files); e.target.value = ''; }} />
      </label>
      <label className="btn btn-ghost doc-btn">
        Galería
        <input type="file" accept="image/*" multiple disabled={busy} onChange={(e) => { sendPhotos(e.target.files); e.target.value = ''; }} />
      </label>
    </>
  );

  return (
    <div className="stack gap-8" style={{ width: '100%' }}>
      <div ref={box} className="stack gap-8" style={{ maxHeight: 320, overflowY: 'auto', padding: 10, borderRadius: 12, background: 'var(--surface-warm, #F6F1EA)', border: '1px solid var(--border)' }} aria-live="polite">
        {list === null && <span className="muted" style={{ fontSize: 13.5 }}>Cargando mensajes…</span>}
        {list?.length === 0 && <span className="muted" style={{ fontSize: 13.5 }}>Escríbele a {otherName} por aquí. Tu número no se comparte.</span>}
        {list?.map((m) => {
          const mine = m.from === me;
          return (
            <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
              <div style={{ padding: '8px 12px', borderRadius: 14, background: mine ? 'var(--primary)' : 'var(--surface)', color: mine ? '#fff' : 'var(--text)', border: mine ? 'none' : '1px solid var(--border)', fontSize: 15 }}>
                {m.kind === 'pedir_fotos' && <strong style={{ display: 'block', fontSize: 13 }}>📷 Pidió fotos</strong>}
                {m.text && <span style={{ whiteSpace: 'pre-line' }}>{m.text}</span>}
                {m.photo && (
                  <a href={m.photo} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.photo} alt="Foto enviada en el chat" style={{ display: 'block', width: 180, maxWidth: '100%', borderRadius: 10 }} />
                  </a>
                )}
              </div>
              <span className="muted" style={{ fontSize: 11.5, display: 'block', textAlign: mine ? 'right' : 'left' }}>{hhmm(m.at)}</span>
            </div>
          );
        })}
      </div>

      {open && me === 'cliente' && lastAsk && !answered && (
        <div className="notice stack gap-8">
          <strong>{otherName} te pide fotos</strong>
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}><PhotoButtons primary /></div>
        </div>
      )}

      {open ? (
        <>
          <div className="row gap-8">
            <input value={text} maxLength={1000} placeholder={`Mensaje para ${otherName}`} aria-label={`Mensaje para ${otherName}`} style={{ flex: 1, minWidth: 0 }}
              onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendText(); } }} />
            <button type="button" className="btn btn-primary" disabled={busy || !text.trim()} onClick={sendText}>Enviar</button>
          </div>
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            <PhotoButtons />
            {me === 'profesional' && <button type="button" className="btn btn-ghost" disabled={busy} onClick={askPhotos}>Pedir fotos al cliente</button>}
          </div>
        </>
      ) : (
        <span className="muted" style={{ fontSize: 13 }}>El chat se cerró con la reserva. Los mensajes quedan como respaldo.</span>
      )}
      {err && <p role="alert" className="form-error">{err}</p>}
    </div>
  );
}
