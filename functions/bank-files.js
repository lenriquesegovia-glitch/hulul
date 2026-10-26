/**
 * Archivo de pagos masivos para la banca web (pago semanal a profesionales).
 *
 * HULUL paga desde Banco del Pacífico (Cash Management → Plataforma de Pagos →
 * Carga Transmisión → Ingreso Archivo). El banco entrega la estructura exacta del
 * archivo al habilitar Cash Management; hasta tenerla, se genera la PLANTILLA HULUL
 * (CSV con todos los datos que pide cualquier pago a terceros). Cuando llegue el
 * instructivo, se agrega aquí el formato 'pacifico' y el panel lo usa sin más cambios.
 *
 * Funciones puras: pruebas en bank-files.test.js.
 */

export const BANK_FORMATS = {
  plantilla: { label: 'Plantilla HULUL (CSV para Excel)', ext: 'csv', mime: 'text/csv' },
};
export const DEFAULT_BANK_FORMAT = 'plantilla';

const digits = (v) => String(v ?? '').replace(/\D/g, '');
const clean = (v, max) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 .,-]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, max);

/** Tipo de identificación: C = cédula (10), R = RUC (13). */
export const idType = (id) => (digits(id).length === 13 ? 'R' : 'C');
export const accountType = (t) => (String(t).toLowerCase().startsWith('corr') ? 'CTE' : 'AHO');

/**
 * Valida y arma las líneas de pago de un lote. payouts = documentos payouts/{id}
 * (con bank: {bank, type, number, holder, holderId}). Devuelve las líneas listas y
 * las que no se pueden pagar (sin cuenta o datos incompletos) con el motivo.
 */
export function paymentLines(payouts, names = {}) {
  const ok = []; const skipped = [];
  for (const p of payouts) {
    const b = p.bank ?? null;
    const net = Math.round(Number(p.net ?? 0) * 100) / 100;
    const name = names[p.proId] ?? '';
    const reason = !b ? 'Sin cuenta bancaria'
      : !digits(b.number) ? 'Falta el número de cuenta'
      : ![10, 13].includes(digits(b.holderId).length) ? 'Falta la cédula o RUC del titular'
      : !b.bank ? 'Falta el banco'
      : !(net > 0) ? 'Monto en cero'
      : '';
    if (reason) { skipped.push({ id: p.id, proId: p.proId, name, net, reason }); continue; }
    ok.push({
      id: p.id, proId: p.proId, week: p.week,
      idType: idType(b.holderId), idNumber: digits(b.holderId), holder: clean(b.holder || name, 60),
      bank: String(b.bank), accountType: accountType(b.type), account: digits(b.number), amount: net,
      reference: clean(`HULUL SEMANA ${p.week}`, 40),
    });
  }
  return { ok, skipped, total: Math.round(ok.reduce((t, l) => t + l.amount, 0) * 100) / 100 };
}

/** Contenido del archivo en el formato pedido. */
export function bankFile(lines, format = DEFAULT_BANK_FORMAT) {
  if (format === 'plantilla') {
    const head = ['N', 'TIPO_ID', 'IDENTIFICACION', 'BENEFICIARIO', 'BANCO', 'TIPO_CUENTA', 'NUMERO_CUENTA', 'VALOR', 'REFERENCIA'];
    const rows = lines.map((l, i) => [i + 1, l.idType, l.idNumber, l.holder, clean(l.bank, 40), l.accountType, l.account, l.amount.toFixed(2), l.reference]);
    // ';' y número de cuenta como texto para que Excel no le quite los ceros.
    const body = rows.map((r) => r.map((c, k) => (k === 2 || k === 6 ? `="${c}"` : String(c))).join(';'));
    return '﻿' + [head.join(';'), ...body].join('\r\n');
  }
  throw new Error(`Formato de banco no disponible: ${format}`);
}
