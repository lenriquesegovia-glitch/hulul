/**
 * Lectura del estado de cuenta de la tarjeta con Claude (PDF, o texto de un Excel/CSV).
 * Devuelve los movimientos en JSON; el panel los revisa y crea los gastos.
 * El archivo no se guarda: se lee y se descarta. parseStatement es pura (pruebas en estado-tarjeta.test.js).
 */
import { IA_MODEL } from './ia-reclamos.js';

export const STATEMENT_SYSTEM = `Lees estados de cuenta de tarjetas de crédito de bancos de Ecuador (Pacífico, Pichincha, Guayaquil, Produbanco, Diners, Bolivariano, etc.).
Extrae TODOS los movimientos del periodo, uno por fila, tal como aparecen. Para cada uno indica:
- n: número de fila (1, 2, 3…)
- fecha: fecha del consumo en formato AAAA-MM-DD (si el año no aparece, dedúcelo del periodo del estado de cuenta)
- descripcion: el texto del comercio tal cual (sin número de tarjeta)
- monto: valor en dólares; positivo si es un cargo, negativo si es un pago, abono o reverso
- tipo: "consumo" (compra o suscripción), "iva" (IVA de servicios digitales cobrado por el banco), "isd" (impuesto a la salida de divisas), "pago" (pago a la tarjeta), "interes", "comision" (cargos del banco, seguros, membresía) u "otro"
- relacionado: para "iva" e "isd", el n del consumo al que corresponde (mismo comercio y fecha o la más cercana); si no se puede saber, null
- exterior: true si el comercio es del exterior (en dólares de EE. UU. desde el extranjero, nombres como GOOGLE*, APPLE.COM, VERCEL, ANTHROPIC, GITHUB, FACEBK, etc.)
Nunca incluyas números de tarjeta, cédulas ni datos personales del titular.
Responde SOLO con JSON válido: {"periodo":{"desde":"AAAA-MM-DD","hasta":"AAAA-MM-DD"},"banco":"…","movimientos":[{"n":1,"fecha":"…","descripcion":"…","monto":0,"tipo":"consumo","relacionado":null,"exterior":false}]}`;

const TIPOS = ['consumo', 'iva', 'isd', 'pago', 'interes', 'comision', 'otro'];
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Valida y limpia la respuesta de la IA. */
export function parseStatement(raw) {
  const txt = String(raw ?? '');
  const json = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
  const rows = (Array.isArray(json.movimientos) ? json.movimientos : []).slice(0, 500).map((m, i) => ({
    n: Number.isInteger(m?.n) ? m.n : i + 1,
    fecha: ISO.test(String(m?.fecha ?? '')) ? m.fecha : '',
    descripcion: String(m?.descripcion ?? '').replace(/\b\d{12,19}\b/g, '').replace(/\s+/g, ' ').trim().slice(0, 120),
    monto: r2(m?.monto),
    tipo: TIPOS.includes(m?.tipo) ? m.tipo : 'otro',
    relacionado: Number.isInteger(m?.relacionado) ? m.relacionado : null,
    exterior: !!m?.exterior,
  })).filter((m) => m.fecha && m.monto !== 0);
  const p = json.periodo ?? {};
  return { periodo: { desde: ISO.test(String(p.desde ?? '')) ? p.desde : '', hasta: ISO.test(String(p.hasta ?? '')) ? p.hasta : '' }, banco: String(json.banco ?? '').slice(0, 60), movimientos: rows };
}

/** Llama a Claude con el PDF (base64) o con el texto del Excel/CSV. */
export async function readStatement({ key, pdf, text, fetchImpl = fetch }) {
  const content = pdf
    ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf } }, { type: 'text', text: 'Extrae los movimientos de este estado de cuenta.' }]
    : [{ type: 'text', text: `Extrae los movimientos de este estado de cuenta (exportado de Excel/CSV):\n\n${String(text).slice(0, 200_000)}` }];
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: IA_MODEL, max_tokens: 16000, system: STATEMENT_SYSTEM, messages: [{ role: 'user', content }] }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status === 401 ? 'La clave de la API de Claude no es válida. Revísala en Administración.' : `La IA no pudo leer el archivo: ${body?.error?.message ?? `HTTP ${res.status}`}`);
  return (body.content ?? []).filter((p) => p.type === 'text').map((p) => p.text).join('');
}
