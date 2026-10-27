// Datos de MUESTRA para revisar el tablero /admin en local, sin la base real.
// Uso:  node scripts/muestra-tablero.mjs
//       cd apps/web && NEXT_PUBLIC_ADMIN_MUESTRA=1 npx next dev   →  http://localhost:3000/admin
// El archivo generado (apps/web/public/muestra-tablero.json) está en .gitignore y
// el modo muestra solo existe en `next dev`.
import { writeFileSync } from 'node:fs';
import { bookingRow, claimRow, ledgerRow, payoutRow, providerRow } from '../functions/tablero-core.js';
import { ledgerEntriesFor, priceOf, weeklyPayout } from '../functions/money.js';

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 26, 17); // lunes 26-oct-2026, 12:00 en Ecuador
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const T = (n) => ({ toMillis: () => n });
const ecDay = (t) => new Date(t - 5 * 3_600_000).toISOString().slice(0, 10);
const at = (date, slot) => { const [y, m, d] = date.split('-').map(Number); const [h, mi] = slot.split(':').map(Number); return Date.UTC(y, m - 1, d, h + 5, mi); };
const id20 = (p, i) => { let s = ''; let x = (i + 1) * 7919 + p.length * 104729; for (let k = 0; k < 20 - p.length; k++) { x = (x * 48271) % 2147483647; s += 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[x % 57]; } return p + s; };

const PROS = [
  ['Juan', 'Vargas', ['plomeria', 'electricidad'], 20, 4.8, 'general'],
  ['María', 'Quiñónez', ['limpieza'], 25, 4.9, 'rimpe_emprendedor'],
  ['Carlos', 'Mendoza', ['climatizacion', 'electrodomesticos'], 28, 4.6, 'general'],
  ['Ana', 'Cevallos', ['belleza'], 15, 4.7, 'rimpe_popular'],
  ['Luis', 'Bravo', ['jardineria', 'piscinas'], 20, 3.9, 'rimpe_emprendedor'],
  ['Pedro', 'Sarmiento', ['pintura', 'albanileria'], 25, 4.2, 'general'],
  ['Rosa', 'Alcívar', ['limpieza'], 22, 4.4, 'rimpe_popular'],
  ['Servicios Técnicos', 'del Pacífico', ['electricidad', 'tecnologia'], 22, 4.5, 'general'],
];
const CLIENTS = ['Andrea Torres', 'Jorge Plaza', 'Valeria Ruiz', 'Diego Mora', 'Camila León', 'Roberto Gil', 'Paola Ortiz', 'Fernando Ríos', 'Gabriela Vera', 'Esteban Cruz', 'Lucía Salas', 'Martín Paredes', 'Daniela Pino', 'Andrés Rivas'];
const SLOTS = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '19:00'];

const providers = PROS.map(([f, l, cats, , rating, regime], i) => {
  const uid = id20('PRO', i);
  return { uid, raw: {
    kind: i === 7 ? 'empresa' : 'persona', businessName: i === 7 ? `${f} ${l}` : undefined, firstName: f, lastName: l, status: i === 6 ? 'en_revision' : 'aprobado',
    categories: cats, catStatus: Object.fromEntries(cats.map((c) => [c, 'aprobado'])), cities: ['Guayaquil', 'Samborondón'],
    rating, reviewCount: 8 + i * 3, jobsDone: 10 + i * 4, strikeLog: i === 4 ? [now - 5 * DAY, now - 12 * DAY] : [],
    taxRegime: regime, eSignature: i % 2 === 0, acceptsCash: i % 3 !== 0, ruc: `09${String(10000000 + i * 7919).slice(0, 8)}001`,
    email: `${f.toLowerCase()}@correo.com`, phone: `09${String(81234567 + i * 1111)}`, submittedAt: T(now - 40 * DAY), payoutBalance: 0,
    suspendedUntil: i === 4 ? now + 3 * DAY : 0, suspendedReason: i === 4 ? 'Calificación menor a 3,5 con 5 reseñas o más.' : '',
  } };
});

const bookings = []; const claims = {}; const reviews = {};
let n = 0;
for (let d = -45; d <= 40; d++) {
  const day = ecDay(now + d * DAY);
  const count = d > 0 ? (d < 14 ? 2 + Math.floor(rnd() * 3) : Math.floor(rnd() * 2)) : 1 + Math.floor(rnd() * 4);
  for (let k = 0; k < count; k++) {
    const pi = Math.floor(rnd() * PROS.length); const p = PROS[pi]; const pro = providers[pi];
    const slot = pick(SLOTS); const ci = Math.floor(rnd() * CLIENTS.length);
    const visit = p[3] + pick([0, 0, 0, 5, -2]);
    const night = slot === '19:00';
    const surcharge = night ? 8 : 0;
    const q = priceOf(visit, surcharge, p[5]);
    const bid = id20('BK', n++);
    const t = at(day, slot);
    const b = {
      date: day, slot, category: pick(p[2]), professionalId: pro.uid, professionalName: `${p[0]} ${p[1]}`, clientId: id20('CLI', ci), contactName: CLIENTS[ci], contactPhone: `09${String(91234560 + ci)}`,
      paymentMethod: rnd() < 0.75 ? 'tarjeta' : 'efectivo', visit, surcharge, surchargeKind: night ? 'nocturno' : '', fee: 1.99, iva: q.iva ?? 0, total: q.total, taxRegime: p[5],
      createdAt: T(t - (2 + Math.floor(rnd() * 6)) * DAY), source: rnd() < 0.6 ? 'app' : 'web',
    };
    const r = rnd();
    if (t > now + 2 * 3_600_000) b.status = rnd() < 0.3 ? 'pendiente' : 'confirmada';
    else if (t > now - 3 * 3_600_000) { b.status = pick(['en_camino', 'en_curso', 'por_aprobar']); if (b.status !== 'en_camino') { b.arrivedAt = T(t + 4 * 60_000); b.startedAt = T(t + 6 * 60_000); } }
    else if (r < 0.62) { b.status = 'completada'; b.arrivedAt = T(t + Math.floor(rnd() * 12) * 60_000); b.startedAt = b.arrivedAt; b.finishedAt = T(t + 90 * 60_000); b.rating = pick([5, 5, 5, 4, 4]); b.outcome = 'resuelto'; }
    else if (r < 0.72) { b.status = 'completada'; b.arrivedAt = T(t + (20 + Math.floor(rnd() * 25)) * 60_000); b.finishedAt = T(t + 120 * 60_000); b.rating = pick([3, 4, 4]); b.outcome = 'resuelto'; b.delay = { minutes: 25, status: 'aceptado' }; }
    else if (r < 0.78) { b.status = 'completada'; b.arrivedAt = T(t + 3 * 60_000); b.finishedAt = T(t + 80 * 60_000); b.rating = pick([1, 2]); b.outcome = pick(['parcial', 'no_resuelto']); }
    else if (r < 0.82) { b.status = 'completada'; b.arrivedAt = T(t + 2 * 60_000); b.finishedAt = T(t + 70 * 60_000); b.rating = 5; b.clientRating = { stars: 1 }; }
    else if (r < 0.86) { b.status = 'cancelada'; b.cancelledBy = 'cliente_ausente'; b.cancelFee = visit; b.arrivedAt = T(t); b.rings = [1, 2, 3]; b.cancelledAt = T(t + 12 * 60_000); }
    else if (r < 0.92) { b.status = 'cancelada'; b.cancelledBy = 'cliente'; b.cancelFee = rnd() < 0.5 ? 3 : 0; b.cancelledAt = T(t - 3 * 3_600_000); }
    else if (r < 0.96) { b.status = 'cancelada'; b.cancelledBy = 'sistema'; b.proFault = 'no_se_presento'; b.proFine = 10; b.clientCredit = 5; b.cancelledAt = T(t + 40 * 60_000); b.cancelReason = 'El profesional no se presentó.'; }
    else { b.status = d > -3 ? 'en_disputa' : 'completada'; b.arrivedAt = T(t + 5 * 60_000); b.finishedAt = T(t + 60 * 60_000); b.rating = 2; }
    if (b.status === 'completada' && rnd() < 0.15) b.extra = { amount: pick([10, 15, 30]), status: 'pagado', method: b.paymentMethod };
    if (b.rating && b.rating <= 2 && rnd() < 0.6 || b.status === 'en_disputa') {
      const open = d > -3;
      claims[bid] = { code: `R-${bid.slice(2, 6)}`, bookingId: bid, openedBy: 'cliente', kind: pick(['incompleto', 'trato', 'cobro']), kindLabel: 'El trabajo quedó incompleto', text: 'El profesional se fue antes de terminar y no volvió a contestar.', status: open ? 'en_revision' : 'resuelto',
        clientId: b.clientId, proId: b.professionalId, category: b.category, openedAt: T(t + DAY), resolveDueAt: T(t + 4 * DAY), decision: open ? null : { outcome: pick(['cliente', 'profesional']), at: T(t + 3 * DAY), multaPro: 0, creditoCliente: 0 } };
    }
    if (b.clientRating && rnd() < 0.5) claims[bid] = { code: `R-${bid.slice(2, 6)}`, bookingId: bid, openedBy: 'profesional', kind: 'trato', kindLabel: 'Trato del cliente', status: 'resuelto', clientId: b.clientId, proId: b.professionalId, category: b.category, openedAt: T(t + DAY), decision: { outcome: 'profesional', at: T(t + 2 * DAY) } };
    if (b.status !== 'pendiente') b.acceptedAt = T(b.createdAt.toMillis() + (3 + Math.floor(rnd() * 40)) * 60_000);
    if (b.rating) reviews[bid] = { text: b.rating <= 2 ? pick(['Llegó tarde y no avisó.', 'Dejó el trabajo a medias, tuve que llamar a otro.', 'Muy caro para lo que hizo.', 'No trajo los materiales.']) : b.rating === 3 ? pick(['Cumplió, pero se demoró más de lo dicho.', 'Bien, aunque dejó sucio.']) : pick(['Excelente, muy puntual.', 'Todo perfecto, lo vuelvo a llamar.', '']) };
    bookings.push([bid, b]);
  }
}

// Casos para ver alertas de cumplimiento: un cliente con trabajos grandes en efectivo, repetidos.
for (let i = 0; i < 6; i++) {
  const day = ecDay(now - (12 - i) * DAY); const pro = providers[5];
  bookings.push([id20('BIG', i), { date: day, slot: '09:00', category: 'albanileria', professionalId: pro.uid, professionalName: 'Pedro Sarmiento', clientId: id20('CLI', 3), contactName: CLIENTS[3], contactPhone: '0991234563',
    paymentMethod: 'efectivo', visit: 900, surcharge: 0, fee: 1.99, iva: 0.3, total: 1036.29, taxRegime: 'general', status: 'completada', arrivedAt: T(at(day, '09:00')), finishedAt: T(at(day, '15:00')), rating: 5, outcome: 'resuelto', createdAt: T(at(day, '09:00') - 2 * DAY), source: 'web' }]);
}

// Libro y liquidaciones semanales (lunes), como lo hace el servidor.
const ledger = []; const payouts = [];
for (const [bid, b] of bookings) {
  const es = ledgerEntriesFor(b) ?? [];
  const created = (b.finishedAt ?? b.cancelledAt)?.toMillis() ?? at(b.date, b.slot);
  es.forEach((e, i) => { const { hold, memo, ...rest } = e; ledger.push({ id: `${bid}_${String(i + 1).padStart(3, '0')}`, bookingId: bid, proId: b.professionalId, clientId: b.clientId, paymentMethod: b.paymentMethod, payoutId: null, createdAt: T(created), availableAt: hold ? created + 48 * 3_600_000 : created, ...rest }); });
}
for (let w = 5; w >= 0; w--) {
  const cut = now - w * 7 * DAY - 6 * 3_600_000;
  const week = ecDay(cut);
  for (const p of providers) {
    const es = ledger.filter((e) => e.proId === p.uid && !e.payoutId && e.availableAt <= cut && !bookings.find(([id, b]) => id === e.bookingId && b.status === 'en_disputa'));
    if (!es.length) continue;
    const pay = weeklyPayout(es, p.raw.taxRegime);
    if (pay.net <= 0) continue;
    const pid = `${week}_${p.uid}`;
    es.forEach((e) => { e.payoutId = pid; });
    payouts.push([pid, { proId: p.uid, week, status: w === 0 ? 'por_pagar' : 'pagado', regime: p.raw.taxRegime, ...pay, entryIds: es.map((e) => e.id), bank: { bank: pick(['Banco Pichincha', 'Banco Guayaquil', 'Produbanco']), number: '2200' + String(1234567 + payouts.length) }, createdAt: T(cut), paidAt: w === 0 ? null : T(cut + DAY) }]);
  }
}

const out = {
  range: { from: ecDay(now - 180 * DAY), to: ecDay(now + 90 * DAY) },
  generatedAt: now,
  bookings: bookings.map(([id, b]) => bookingRow(id, b, claims[id] ?? null, reviews[id] ?? null)),
  ledger: ledger.map((e) => ledgerRow(e.id, e)),
  payouts: payouts.map(([id, p]) => payoutRow(id, p)),
  providers: providers.map((p) => providerRow(p.uid, p.raw, now)),
  clients: CLIENTS.map((name, i) => ({ uid: id20('CLI', i), name, phone: '09•• ••• •' + (60 + i), email: '', balance: 0, noShows: 0, strikes: 0, createdAt: now - 60 * DAY })),
  claims: Object.entries(claims).map(([id, c]) => claimRow(id, c)),
};
writeFileSync(new URL('../apps/web/public/muestra-tablero.json', import.meta.url), JSON.stringify(out));
console.log(`Muestra: ${out.bookings.length} reservas, ${out.ledger.length} movimientos, ${out.payouts.length} liquidaciones, ${out.claims.length} reclamos.`);

// Gastos y nómina de muestra (apps/web/public/muestra-gastos.json).
{
  const { expenseInput, payrollExpenses, payrollLine, payrollTotals, PAYROLL_PARAMS_2026, employeeInput } = await import('../functions/gastos-core.js');
  const empleados = [
    { id: 'EMP000000001', ...employeeInput({ nombre: 'Karla Jiménez', cedula: '0923456781', cargo: 'Soporte y operaciones', sueldo: 650, ingreso: '2025-03-01', correo: 'karla@hululec.com', cuenta: 'Pacífico ahorros ••••4521', cargasUtilidades: 2, cargasIr: 2 }) },
    { id: 'EMP000000002', ...employeeInput({ nombre: 'Bryan Macías', cedula: '0934567812', cargo: 'Atención al cliente', sueldo: 482, ingreso: '2026-06-01', decimosMensuales: true, cuenta: 'Pichincha ahorros ••••8810' }) },
  ];
  const months = ['2026-08', '2026-09', '2026-10'];
  const gastos = []; const roles = []; let n = 0;
  const r2s = (x) => Math.round(x * 100) / 100;
  const add = (d, extra = {}) => { const g = expenseInput(d); if (g.error) throw new Error(`${g.error} ${JSON.stringify(d)}`); gastos.push({ id: `GASTO${String(++n).padStart(7, '0')}`, ...g, pagadoEl: g.estado === 'pagado' ? g.fecha : null, origen: 'manual', ...extra }); };
  for (const m of months) {
    const last = m === '2026-10';
    add({ fecha: `${m}-01`, categoria: 'arriendo', proveedor: 'Inmobiliaria Kennedy S.A.', identificacion: '0991234567001', factura: `001-001-0000${m.slice(5)}12`, base: 450, iva: 67.5, retRenta: 36, retIva: 67.5, recurrente: true });
    add({ fecha: `${m}-05`, categoria: 'servicios', proveedor: 'CNT EP', identificacion: '1768152560001', base: 39.9, iva: 5.99, recurrente: true, formaPago: 'debito' });
    const prevM = m === '2026-08' ? '2026-07' : m === '2026-09' ? '2026-08' : '2026-09';
    const tc = { formaPago: 'tarjeta', tarjeta: 'Visa Pacífico ••4410', exterior: true, recurrente: true };
    add({ fecha: `${m}-03`, categoria: 'tecnologia', proveedor: 'Google Cloud · Firebase', plataforma: 'firebase', base: 38 + n, iva: r2s((38 + n) * 0.15), cubreDesde: prevM, liquidacion: m !== '2026-10', ...tc });
    if (m !== '2026-09') add({ fecha: `${m}-05`, categoria: 'tecnologia', proveedor: 'Vercel', plataforma: 'vercel', base: 20, iva: 3, liquidacion: true, ...tc });
    add({ fecha: `${m}-08`, categoria: 'tecnologia', proveedor: 'Claude (Anthropic) · suscripción', plataforma: 'claude', base: 100, iva: 15, liquidacion: m !== '2026-10', ...(m === '2026-08' ? { formaPago: 'tarjeta', pagador: 'socio', socio: 'Socio 1', exterior: true } : tc) });
    add({ fecha: `${m}-02`, categoria: 'tecnologia', proveedor: 'Claude API (Anthropic)', plataforma: 'claude_api', base: 6 + (n % 5), iva: r2s((6 + (n % 5)) * 0.15), cubreDesde: prevM, liquidacion: true, ...tc });
    add({ fecha: `${m}-09`, categoria: 'tecnologia', proveedor: 'Expo · EAS', plataforma: 'expo', base: 19, iva: 2.85, liquidacion: true, ...tc });
    add({ fecha: `${m}-10`, categoria: 'honorarios', proveedor: 'María Fernanda Salazar (contadora)', identificacion: '0912345678', factura: `001-002-00000${m.slice(5)}4`, base: 300, iva: 45, retRenta: 30, retIva: 45, recurrente: true,
      ...(last ? { estado: 'por_pagar', vence: '2026-10-20' } : {}) });
    add({ fecha: `${m}-12`, categoria: 'marketing', proveedor: 'Meta Platforms (Instagram/Facebook)', base: 180 + (last ? 120 : 0), iva: 27 + (last ? 18 : 0), formaPago: 'tarjeta' });
    add({ fecha: `${m}-15`, categoria: 'subcontratos', proveedor: 'Diseñador freelance', identificacion: '0956781234', base: 220, iva: 0, retRenta: 17.6 });
    add({ fecha: `${m}-27`, categoria: 'bancarios', proveedor: 'Pasarela de pagos', base: 18 + n / 2, iva: 2.7, formaPago: 'debito' });
    const lines = empleados.filter((e) => e.ingreso <= `${m}-31`).map((e) => payrollLine(e, m === '2026-09' ? { extras: e.id.endsWith('1') ? 40 : 0 } : {}, m, PAYROLL_PARAMS_2026));
    const totals = payrollTotals(lines);
    roles.push({ mes: m, status: last ? 'borrador' : 'aprobado', lines, totals, aprobadoPor: last ? null : 'muestra@hululec.com', aprobadoEl: last ? null : now });
    if (!last) for (const g of payrollExpenses(m, totals)) gastos.push({ ...g, pagadoEl: g.fecha });
  }
  add({ fecha: '2026-08-14', categoria: 'tecnologia', proveedor: 'Apple Developer Program', plataforma: 'apple', base: 99, iva: 14.85, cubreMeses: 12, formaPago: 'tarjeta', tarjeta: 'Visa Pacífico ••4410', exterior: true, liquidacion: true });
  add({ fecha: '2026-08-14', categoria: 'tecnologia', proveedor: 'Google Play Console', plataforma: 'google_play', base: 25, iva: 3.75, formaPago: 'tarjeta', tarjeta: 'Visa Pacífico ••4410', exterior: true, liquidacion: true });
  add({ fecha: '2026-09-20', categoria: 'tecnologia', proveedor: 'Dominios (hululec.com, hulul.ec…)', plataforma: 'dominios', base: 64, iva: 9.6, cubreMeses: 12, formaPago: 'tarjeta', tarjeta: 'Visa Pacífico ••4410', exterior: true, liquidacion: true });
  add({ fecha: '2026-09-02', categoria: 'notarios', proveedor: 'SENADI', base: 208, iva: 0, descripcion: 'Registro de la marca HULUL' });
  add({ fecha: '2026-10-24', categoria: 'mantenimiento', proveedor: 'TecnoFix', identificacion: '0990011223001', factura: '001-001-000000231', base: 85, iva: 12.75, estado: 'por_pagar', vence: '2026-10-30' });
    empleados.push({ id: 'EMP000000003', ...employeeInput({ nombre: 'Daniel Ortega', cedula: '0945678123', cargo: 'Ventas', sueldo: 700, ingreso: '2025-06-01', activo: false, salida: '2026-09-30', motivoSalida: 'renuncia', vacacionesPendientes: 4.5 }) });
  const laboral = { EMP000000001: { contrato: { hecho: true, fecha: '2025-03-01' }, contrato_sut: { hecho: true, fecha: '2025-03-20', ref: 'SUT-88231' }, aviso_entrada: { hecho: true, fecha: '2025-03-01' }, cedula: { hecho: true } },
    EMP000000002: { contrato: { hecho: true, fecha: '2026-06-01' }, aviso_entrada: { hecho: true, fecha: '2026-06-01' } } };
  writeFileSync(new URL('../apps/web/public/muestra-gastos.json', import.meta.url), JSON.stringify({ laboral, utilidades: [], gastos, empleados, roles, pagosTarjeta: [{ id: 'TC1', fecha: '2026-09-15', monto: 300, tarjeta: 'Visa Pacífico ••4410', referencia: 'Pago agosto' }, { id: 'TC2', fecha: '2026-10-15', monto: 250, tarjeta: 'Visa Pacífico ••4410', referencia: 'Pago septiembre' }], params: PAYROLL_PARAMS_2026, canEdit: true, viewer: { role: 'dueno', email: 'muestra@hululec.com' } }));
  console.log(`Muestra de gastos: ${gastos.length} gastos, ${empleados.length} empleados, ${roles.length} roles.`);
}
