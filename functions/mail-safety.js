/**
 * Seguridad de correo: cada aviso sale a UNA dirección válida.
 * Los correos de clientes y profesionales los escriben ellos mismos; sin este
 * filtro, una lista ("a@x.com, b@y.com") o una dirección con comentarios haría
 * que los avisos de HULUL llegaran a terceros (spam o suplantación).
 */
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

/** Devuelve la dirección si es un único correo válido; si no, ''. */
export function oneEmail(v) {
  const s = String(v ?? '').trim();
  return s.length <= 160 && EMAIL_RE.test(s) ? s : '';
}

/**
 * Limpia un mensaje antes de enviarlo: `to` debe ser un único correo válido
 * (si no, el mensaje no se envía) y `replyTo` se descarta si no lo es.
 * Los destinatarios internos (notifyTo, configurados por HULUL) pueden ser una lista
 * fija y se marcan con `trusted: true`.
 */
export function safeMessage(m) {
  if (!m) return null;
  const { trusted, ...msg } = m;
  if (!trusted) {
    const to = oneEmail(msg.to);
    if (!to) return null;
    msg.to = to;
  }
  if (msg.replyTo !== undefined) {
    const r = oneEmail(msg.replyTo);
    if (r) msg.replyTo = r; else delete msg.replyTo;
  }
  for (const k of ['cc', 'bcc']) delete msg[k];
  return msg;
}
