/**
 * Estado de cuenta del profesional en PDF (marca HULUL). Lo usan el panel
 * (descarga) y el correo semanal de los lunes. Sin datos de clientes más allá
 * del nombre de pila; la cuenta bancaria va tapada.
 * statementData es pura (pruebas en statement-pdf.test.js).
 */
import PDFDocument from 'pdfkit';

const C = { brand: '#123F43', dark: '#0B2F33', text: '#1C2B2A', muted: '#5E6E6B', line: '#D5DDD9', soft: '#EEF3F1', ok: '#206344', bad: '#B42318' };
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
export const usd = (n) => `${r2(n) < 0 ? '-' : ''}$${Math.abs(r2(n)).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (ms) => new Date(ms - 5 * 3_600_000).toISOString().slice(0, 10).split('-').reverse().join('/');

/** Lo que ve el profesional (sin movimientos internos de HULUL). */
const PRO_LABEL = {
  visita: 'Visita', adicional: 'Cobro adicional', cargo_cancelacion: 'Cancelación tardía o cliente ausente',
  plataforma: 'Cargo de plataforma cobrado en efectivo', plataforma_iva: 'IVA del cargo de plataforma (efectivo)',
  comision: 'Comisión HULUL', comision_iva: 'IVA de la comisión', adicional_comision: 'Comisión del adicional', adicional_comision_iva: 'IVA comisión del adicional',
  multa: 'Multa', retencion_renta: 'Retención de renta', retencion_iva: 'Retención de IVA', abono_profesional: 'Pago tuyo a HULUL (deuda de efectivo)',
};

/**
 * Resumen y filas del estado de cuenta. ledger = movimientos del profesional
 * ({kind, proDelta, createdAt(ms), bookingId, availableAt, payoutId}), payouts = sus liquidaciones.
 */
export function statementData({ ledger, payouts, from, to, now = Date.now() }) {
  const rows = ledger.filter((e) => e.proDelta && e.createdAt >= from && e.createdAt <= to && PRO_LABEL[e.kind])
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) => ({ date: e.createdAt, bookingId: e.bookingId, code: e.bookingId ? String(e.bookingId).slice(-6).toUpperCase() : '', label: PRO_LABEL[e.kind], amount: r2(e.proDelta), kind: e.kind }));
  // Una línea por reserva (visita, comisión, cargos…) y una por cada movimiento suelto (abonos, retenciones).
  const groups = [];
  const byId = new Map();
  for (const r of rows) {
    const g = r.bookingId ? byId.get(r.bookingId) : null;
    if (g) { g.items.push(r); g.net = r2(g.net + r.amount); continue; }
    const ng = { date: r.date, code: r.code, items: [r], net: r.amount };
    groups.push(ng); if (r.bookingId) byId.set(r.bookingId, ng);
  }
  const sum = (f) => r2(rows.filter(f).reduce((t, r) => t + r.amount, 0));
  const earned = sum((r) => r.amount > 0 && r.kind !== 'abono_profesional');
  const fees = -sum((r) => r.amount < 0 && !['multa', 'retencion_renta', 'retencion_iva'].includes(r.kind));
  const fines = -sum((r) => r.kind === 'multa');
  const retentions = -sum((r) => r.kind.startsWith('retencion_'));
  const abonos = sum((r) => r.kind === 'abono_profesional');
  const pend = ledger.filter((e) => !e.payoutId);
  const pending = r2(pend.reduce((t, e) => t + Number(e.proDelta || 0), 0));
  const held = r2(pend.filter((e) => Number(e.availableAt || 0) > now && e.proDelta > 0).reduce((t, e) => t + e.proDelta, 0));
  const pays = payouts.filter((p) => (p.paidAt ?? p.createdAt ?? 0) >= from && (p.paidAt ?? p.createdAt ?? 0) <= to).sort((a, b) => String(a.week).localeCompare(String(b.week)));
  return {
    rows, groups, earned, fees, fines, retentions, abonos,
    paid: r2(pays.filter((p) => p.status === 'pagado').reduce((t, p) => t + p.net, 0)),
    toPay: r2(payouts.filter((p) => p.status === 'por_pagar').reduce((t, p) => t + p.net, 0)),
    pending, held, payouts: pays,
  };
}

/** PDF como Buffer. pro = {name, ruc, regime, bank}. */
export function statementPdf({ pro, from, to, data, company = 'Corporación Coffeeport Cía. Ltda. · HULUL' }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true, info: { Title: `Estado de cuenta HULUL - ${pro.name}`, Author: 'HULUL' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    const W = doc.page.width - 84; const X = 42;

    // Cabecera
    doc.rect(0, 0, doc.page.width, 92).fill(C.brand);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(24).text('HULUL', X, 26, { characterSpacing: 3 });
    doc.font('Helvetica').fontSize(9).fillColor('#BFD2CF').text('SERVICIOS DEL HOGAR', X, 54, { characterSpacing: 2 });
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#FFFFFF').text('Estado de cuenta', X, 28, { width: W, align: 'right' });
    doc.font('Helvetica').fontSize(9.5).fillColor('#DCE7E5').text(`Del ${day(from)} al ${day(to)}`, X, 48, { width: W, align: 'right' });
    doc.text(`Emitido el ${day(Date.now())}`, X, 62, { width: W, align: 'right' });

    // Datos del profesional
    let y = 112;
    doc.fillColor(C.text).font('Helvetica-Bold').fontSize(14).text(pro.name || 'Profesional', X, y); y += 20;
    doc.font('Helvetica').fontSize(9.5).fillColor(C.muted)
      .text([pro.ruc ? `RUC ${pro.ruc}` : '', pro.regime, pro.bank ? `Cuenta ${pro.bank}` : 'Sin cuenta bancaria registrada'].filter(Boolean).join('  ·  '), X, y);
    y += 26;

    // Resumen en tarjetas
    const cards = [
      ['Ganado en el periodo', usd(data.earned), C.ok],
      ['Comisión y cargos HULUL', usd(-data.fees), C.text],
      ['Multas', usd(-data.fines), data.fines ? C.bad : C.text],
      ['Depositado en el periodo', usd(data.paid), C.brand],
    ];
    const cw = (W - 18) / 4;
    cards.forEach(([label, value, color], i) => {
      const cx = X + i * (cw + 6);
      doc.roundedRect(cx, y, cw, 58, 8).fill(C.soft);
      doc.fillColor(C.muted).font('Helvetica').fontSize(8.5).text(label, cx + 10, y + 10, { width: cw - 20 });
      doc.fillColor(color).font('Helvetica-Bold').fontSize(15).text(value, cx + 10, y + 28, { width: cw - 20 });
    });
    y += 72;
    const line2 = [
      `Por depositar: ${usd(data.toPay)}`,
      `Saldo sin liquidar: ${usd(data.pending)}${data.held ? ` (${usd(data.held)} en las 48 h de reclamos)` : ''}`,
      data.retentions ? `Retenciones: ${usd(-data.retentions)}` : '',
      data.abonos ? `Pagos tuyos a HULUL: ${usd(data.abonos)}` : '',
    ].filter(Boolean).join('   ·   ');
    doc.fillColor(C.text).font('Helvetica').fontSize(9.5).text(line2, X, y, { width: W }); y = doc.y + 8;
    if (data.pending < 0) {
      doc.fillColor(C.bad).fontSize(9).text(`Debes ${usd(-data.pending)} a HULUL por cobros en efectivo o multas: se descuenta de tu próximo depósito o puedes pagarlo por transferencia o DeUna.`, X, y, { width: W });
      y = doc.y + 8;
    }

    // Tabla de movimientos
    const cols = [{ t: 'Fecha', w: 66 }, { t: 'Reserva', w: 62 }, { t: 'Detalle', w: W - 66 - 62 - 80 }, { t: 'Neto', w: 80, right: true }];
    const header = () => {
      doc.rect(X, y, W, 20).fill(C.brand);
      let cx = X;
      for (const c of cols) { doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5).text(c.t.toUpperCase(), cx + 6, y + 6, { width: c.w - 12, align: c.right ? 'right' : 'left' }); cx += c.w; }
      y += 20;
    };
    const ensure = (h, table = true) => { if (y + h > doc.page.height - 70) { doc.addPage(); y = 42; if (table) header(); } };
    doc.fillColor(C.text).font('Helvetica-Bold').fontSize(11).text('Movimientos', X, y + 4); y = doc.y + 6;
    header();
    if (!data.groups.length) { doc.fillColor(C.muted).font('Helvetica').fontSize(9.5).text('Sin movimientos en el periodo.', X + 6, y + 8); y += 28; }
    data.groups.forEach((g, i) => {
      const detail = g.items.map((r) => `${r.label} ${usd(r.amount)}`).join('  ·  ');
      doc.font('Helvetica').fontSize(8.5);
      const h = Math.max(18, doc.heightOfString(detail, { width: cols[2].w - 12 }) + 9);
      ensure(h);
      if (i % 2) doc.rect(X, y, W, h).fill('#F7FAF9');
      let cx = X;
      const vals = [day(g.date), g.code || '—', detail, usd(g.net)];
      cols.forEach((c, k) => {
        doc.fillColor(k === 3 ? (g.net < 0 ? C.bad : C.ok) : k === 2 ? C.muted : C.text).font(k === 3 ? 'Helvetica-Bold' : 'Helvetica').fontSize(k === 2 ? 8.5 : 9)
          .text(vals[k], cx + 6, y + 5, { width: c.w - 12, align: c.right ? 'right' : 'left' });
        cx += c.w;
      });
      y += h;
    });
    doc.moveTo(X, y).lineTo(X + W, y).strokeColor(C.line).stroke(); y += 14;

    // Depósitos
    if (data.payouts.length) {
      ensure(60, false);
      doc.fillColor(C.text).font('Helvetica-Bold').fontSize(11).text('Depósitos semanales', X, y); y = doc.y + 6;
      for (const p of data.payouts) {
        ensure(18, false);
        doc.fillColor(C.text).font('Helvetica').fontSize(9.5)
          .text(`Semana del ${String(p.week).split('-').reverse().join('/')}`, X, y, { width: 150 })
          .text(p.status === 'pagado' ? `Depositado${p.paidAt ? ` el ${day(p.paidAt)}` : ''}${p.paymentReference ? ` · ref. ${p.paymentReference}` : ''}` : 'Por depositar', X + 150, y, { width: W - 240 });
        doc.font('Helvetica-Bold').text(usd(p.net), X + W - 90, y, { width: 90, align: 'right' });
        y += 18;
      }
      y += 6;
    }

    // Pie
    ensure(40, false);
    doc.fillColor(C.muted).font('Helvetica').fontSize(8)
      .text('Tú facturas tus visitas al cliente; HULUL cobra con tarjeta por cuenta tuya y te deposita cada lunes lo que ya pasó las 48 h de reclamos, menos comisión, cargos, multas y deudas de efectivo. HULUL te factura su comisión cada semana. Si algo no cuadra, responde a este correo o escríbenos desde la app.', X, y, { width: W });
    // Pie de página en cada hoja, sin crear una hoja nueva.
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const bottom = doc.page.margins.bottom; doc.page.margins.bottom = 0;
      doc.fillColor(C.muted).font('Helvetica').fontSize(8).text(`${company}  ·  Página ${i + 1} de ${range.count}`, X, doc.page.height - 30, { width: W, align: 'center', lineBreak: false });
      doc.page.margins.bottom = bottom;
    }
    doc.end();
  });
}

/* ------------------------------ Estado de cuenta del cliente ------------------------------ */

const HULUL_RUC = '0993265160001';
const FEE = 1.99;

/** Comprobantes de una reserva para el cliente (mismo criterio que el panel). */
export function clientInvoicesOf(b, proRuc = '') {
  const charged = ['completada', 'en_disputa', 'por_aprobar'].includes(b.status);
  const out = [];
  if (charged) {
    const ex = b.extra && ['por_cobrar', 'pagado', 'pagado_tarjeta', 'pagado_efectivo'].includes(b.extra.status) ? Number(b.extra.amount || 0) : 0;
    const base = r2(Number(b.visit ?? b.subtotal ?? 0) + Number(b.surcharge || 0) + ex);
    const iva = b.taxRegime === 'rimpe_popular' ? 0 : r2(base * 0.15);
    out.push({ issuer: `${b.professionalName ?? 'Profesional'}${proRuc ? ` (RUC ${proRuc})` : ''}`, concept: 'Visita', base, iva, total: r2(base + iva) });
    out.push({ issuer: `HULUL (RUC ${HULUL_RUC})`, concept: 'Cargo de plataforma', base: FEE, iva: r2(FEE * 0.15), total: r2(FEE * 1.15) });
  } else if (b.status === 'cancelada' && Number(b.cancelFee) > 0) {
    out.push({ issuer: `${b.professionalName ?? 'Profesional'}${proRuc ? ` (RUC ${proRuc})` : ''}`, concept: b.cancelledBy === 'cliente_ausente' ? 'Visita (no estabas en casa)' : 'Cancelación tardía', base: r2(b.cancelFee), iva: 0, total: r2(b.cancelFee) });
  }
  return out;
}

/** PDF del estado de cuenta de un cliente: sus servicios, los dos comprobantes de cada uno, créditos y saldo. */
export function clientStatementPdf({ client, from, to, bookings, proRucs = {} }) {
  const rows = bookings.filter((b) => b.dateMs >= from && b.dateMs <= to).sort((a, b) => a.dateMs - b.dateMs);
  const PAY = { tarjeta: 'Tarjeta', efectivo: 'Efectivo', deuna: 'DeUna', transferencia: 'Transferencia' };
  let paid = 0; let credits = 0; let services = 0;
  const lines = rows.map((b) => {
    const inv = clientInvoicesOf(b, proRucs[b.professionalId] ?? '');
    const total = r2(inv.reduce((t, i) => t + i.total, 0));
    if (total) { paid = r2(paid + total); services += 1; }
    credits = r2(credits + Number(b.clientCredit || 0));
    return { b, inv, total };
  });
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true, info: { Title: `Estado de cuenta HULUL - ${client.name}`, Author: 'HULUL' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    const W = doc.page.width - 84; const X = 42;
    doc.rect(0, 0, doc.page.width, 92).fill(C.brand);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(24).text('HULUL', X, 26, { characterSpacing: 3 });
    doc.font('Helvetica').fontSize(9).fillColor('#BFD2CF').text('SERVICIOS DEL HOGAR', X, 54, { characterSpacing: 2 });
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#FFFFFF').text('Estado de cuenta del cliente', X, 28, { width: W, align: 'right' });
    doc.font('Helvetica').fontSize(9.5).fillColor('#DCE7E5').text(`Del ${day(from)} al ${day(to)}`, X, 48, { width: W, align: 'right' }).text(`Emitido el ${day(Date.now())}`, X, 62, { width: W, align: 'right' });
    let y = 112;
    doc.fillColor(C.text).font('Helvetica-Bold').fontSize(14).text(client.name || 'Cliente', X, y); y += 20;
    doc.font('Helvetica').fontSize(9.5).fillColor(C.muted).text(client.email || '', X, y); y += 22;
    const cards = [['Servicios con cobro', String(services), C.brand], ['Total pagado', usd(paid), C.ok], ['Créditos a tu favor', usd(credits), C.text], ['Saldo pendiente', usd(client.balance || 0), (client.balance || 0) > 0 ? C.bad : C.text]];
    const cw = (W - 18) / 4;
    cards.forEach(([label, value, color], i) => {
      const cx = X + i * (cw + 6);
      doc.roundedRect(cx, y, cw, 58, 8).fill(C.soft);
      doc.fillColor(C.muted).font('Helvetica').fontSize(8.5).text(label, cx + 10, y + 10, { width: cw - 20 });
      doc.fillColor(color).font('Helvetica-Bold').fontSize(15).text(value, cx + 10, y + 28, { width: cw - 20 });
    });
    y += 74;
    doc.fillColor(C.text).font('Helvetica-Bold').fontSize(11).text('Tus servicios y comprobantes', X, y); y = doc.y + 6;
    const cols = [{ t: 'Fecha', w: 62 }, { t: 'Reserva', w: 58 }, { t: 'Servicio y comprobantes', w: W - 62 - 58 - 70 }, { t: 'Total', w: 70, right: true }];
    const header = () => { doc.rect(X, y, W, 20).fill(C.brand); let cx = X; for (const c of cols) { doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5).text(c.t.toUpperCase(), cx + 6, y + 6, { width: c.w - 12, align: c.right ? 'right' : 'left' }); cx += c.w; } y += 20; };
    header();
    if (!lines.length) { doc.fillColor(C.muted).font('Helvetica').fontSize(9.5).text('Sin servicios en el periodo.', X + 6, y + 8); y += 28; }
    lines.forEach(({ b, inv, total }, i) => {
      const status = b.status === 'cancelada' ? (total ? 'Cancelada con cargo' : 'Cancelada sin cobro') : b.status === 'completada' ? 'Completada' : b.status === 'en_disputa' ? 'En revisión' : 'Programada';
      const detail = [`${b.categoryName} con ${b.professionalName ?? 'profesional'} · ${status}${b.paymentMethod ? ` · ${PAY[b.paymentMethod] ?? b.paymentMethod}` : ''}`,
        ...inv.map((x) => `${x.issuer}: ${x.concept} ${usd(x.base)} + IVA ${usd(x.iva)} = ${usd(x.total)}`),
        ...(Number(b.clientCredit) > 0 ? [`Crédito a tu favor: ${usd(b.clientCredit)}`] : [])].join('\n');
      doc.font('Helvetica').fontSize(8.5);
      const h = Math.max(18, doc.heightOfString(detail, { width: cols[2].w - 12 }) + 10);
      if (y + h > doc.page.height - 70) { doc.addPage(); y = 42; header(); }
      if (i % 2) doc.rect(X, y, W, h).fill('#F7FAF9');
      let cx = X;
      [day(b.dateMs), String(b.id).slice(-6).toUpperCase(), detail, total ? usd(total) : '—'].forEach((v, k) => {
        doc.fillColor(k === 2 ? C.text : k === 3 ? C.brand : C.text).font(k === 3 ? 'Helvetica-Bold' : 'Helvetica').fontSize(k === 2 ? 8.5 : 9).text(v, cx + 6, y + 5, { width: cols[k].w - 12, align: cols[k].right ? 'right' : 'left' });
        cx += cols[k].w;
      });
      y += h;
    });
    y += 12;
    if (y > doc.page.height - 110) { doc.addPage(); y = 42; }
    doc.fillColor(C.muted).font('Helvetica').fontSize(8).text('Por cada servicio recibes dos comprobantes: el del profesional por la visita y el de HULUL por el cargo de plataforma. Si algo no cuadra, escríbenos desde la app.', X, y, { width: W });
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i); const bm = doc.page.margins.bottom; doc.page.margins.bottom = 0;
      doc.fillColor(C.muted).font('Helvetica').fontSize(8).text(`Corporación Coffeeport Cía. Ltda. · HULUL  ·  Página ${i + 1} de ${range.count}`, X, doc.page.height - 30, { width: W, align: 'center', lineBreak: false });
      doc.page.margins.bottom = bm;
    }
    doc.end();
  });
}
