/**
 * Gastos de la empresa y nómina (rol de pagos) de HULUL / Corporación Coffeeport.
 * Categorías con códigos del plan de cuentas de la Superintendencia de Compañías
 * (propuesta para validar con la contadora). Parámetros de nómina de 2026 editables.
 * Funciones puras: pruebas en gastos-core.test.js.
 */

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/** Categorías de gasto → cuenta Supercias. */
export const EXPENSE_CATEGORIES = {
  honorarios: { label: 'Honorarios profesionales (contadora, abogado…)', code: '520205', account: 'HONORARIOS, COMISIONES Y DIETAS A PERSONAS NATURALES' },
  subcontratos: { label: 'Subcontratos y trabajadores autónomos', code: '520206', account: 'REMUNERACIONES A OTROS TRABAJADORES AUTÓNOMOS' },
  marketing: { label: 'Marketing y publicidad', code: '520111', account: 'PROMOCIÓN Y PUBLICIDAD' },
  tecnologia: { label: 'Plataformas y software (nube, tiendas de apps, IA, dominios)', code: '520228', account: 'OTROS GASTOS' },
  arriendo: { label: 'Arriendo de oficina', code: '520209', account: 'ARRENDAMIENTO OPERATIVO' },
  servicios: { label: 'Luz, agua, internet y teléfono', code: '520218', account: 'AGUA, ENERGÍA, LUZ Y TELECOMUNICACIONES' },
  mantenimiento: { label: 'Mantenimiento y reparaciones', code: '520208', account: 'MANTENIMIENTO Y REPARACIONES' },
  transporte: { label: 'Transporte y movilización', code: '520215', account: 'TRANSPORTE' },
  viajes: { label: 'Viajes', code: '520217', account: 'GASTOS DE VIAJE' },
  combustible: { label: 'Combustible', code: '520212', account: 'COMBUSTIBLES' },
  seguros: { label: 'Seguros', code: '520214', account: 'SEGUROS Y REASEGUROS (primas y cesiones)' },
  notarios: { label: 'Notarías, registros y marcas (SENADI)', code: '520219', account: 'NOTARIOS Y REGISTRADORES DE LA PROPIEDAD O MERCANTILES' },
  impuestos: { label: 'Impuestos, contribuciones y patentes', code: '520220', account: 'IMPUESTOS, CONTRIBUCIONES Y OTROS' },
  bancarios: { label: 'Comisiones bancarias y de la pasarela', code: '520302', account: 'COMISIONES (GASTOS FINANCIEROS)' },
  gestion: { label: 'Gastos de gestión (agasajos, atenciones)', code: '520216', account: 'GASTOS DE GESTIÓN' },
  otros: { label: 'Otros gastos', code: '520228', account: 'OTROS GASTOS' },
  // Los genera la nómina aprobada (no se crean a mano).
  nomina_sueldos: { label: 'Nómina: sueldos y horas extra', code: '520201', account: 'SUELDOS, SALARIOS Y DEMÁS REMUNERACIONES', payroll: true },
  nomina_aportes: { label: 'Nómina: aportes patronales y fondos de reserva', code: '520202', account: 'APORTES A LA SEGURIDAD SOCIAL (incluido fondo de reserva)', payroll: true },
  nomina_beneficios: { label: 'Nómina: décimos y vacaciones', code: '520203', account: 'BENEFICIOS SOCIALES E INDEMNIZACIONES', payroll: true },
};
export const MANUAL_CATEGORIES = Object.keys(EXPENSE_CATEGORIES).filter((k) => !EXPENSE_CATEGORIES[k].payroll);
export const PAY_METHODS = ['transferencia', 'tarjeta', 'efectivo', 'debito', 'cheque'];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Umbral anual exento de ISD en consumos con tarjeta en el exterior (2026). */
export const ISD_RATE = 0.05;
export const ISD_EXEMPT_2026 = 5188.26;

const ym = (iso) => String(iso).slice(0, 7);
const addMonths = (m, n) => { const [y, mo] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const monthDiff = (a, b) => { const [y1, m1] = a.split('-').map(Number); const [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); };

/**
 * Valida y normaliza un gasto que llega del panel. Devengado: el gasto se reconoce en los meses
 * que cubre (cubreDesde + cubreMeses), no cuando se paga. Con tarjeta de crédito el gasto queda
 * pagado al proveedor y la deuda pasa a la tarjeta hasta que se paga su estado de cuenta.
 */
export function expenseInput(d) {
  const fecha = String(d?.fecha ?? '');
  const categoria = String(d?.categoria ?? '');
  const proveedor = String(d?.proveedor ?? '').trim().slice(0, 120);
  const descripcion = String(d?.descripcion ?? '').trim().slice(0, 400);
  const base = r2(d?.base); const iva = r2(d?.iva); const isd = r2(d?.isd);
  const retRenta = r2(d?.retRenta); const retIva = r2(d?.retIva);
  if (!ISO.test(fecha)) return { error: 'Elige la fecha.' };
  if (!MANUAL_CATEGORIES.includes(categoria)) return { error: 'Elige la categoría.' };
  if (proveedor.length < 2) return { error: 'Escribe a quién se le pagó.' };
  if (!(base > 0)) return { error: 'Escribe el valor sin IVA.' };
  if (iva < 0 || retRenta < 0 || retIva < 0 || isd < 0) return { error: 'Los valores no pueden ser negativos.' };
  if (iva > base * 0.16) return { error: 'El IVA parece alto para esa base (máximo 15 %).' };
  if (isd > (base + iva) * 0.055) return { error: 'El ISD parece alto (es el 5 %).' };
  const formaPago = PAY_METHODS.includes(d?.formaPago) ? d.formaPago : 'transferencia';
  const tarjeta = formaPago === 'tarjeta';
  const estado = !tarjeta && d?.estado === 'por_pagar' ? 'por_pagar' : 'pagado';
  const vence = estado === 'por_pagar' && ISO.test(String(d?.vence ?? '')) ? d.vence : null;
  if (estado === 'por_pagar' && !vence) return { error: 'Si está por pagar, pon la fecha de vencimiento.' };
  const cubreMeses = Math.max(1, Math.min(36, Math.round(Number(d?.cubreMeses) || 1)));
  const cubreDesde = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(d?.cubreDesde ?? '')) ? d.cubreDesde : ym(fecha);
  if (Math.abs(monthDiff(ym(fecha), cubreDesde)) > 12) return { error: 'El periodo que cubre debe empezar como máximo 12 meses antes o después de la fecha.' };
  const exterior = !!d?.exterior;
  if (d?.pagador === 'socio' && String(d?.socio ?? '').trim().length < 2) return { error: 'Escribe qué socio lo pagó.' };
  return {
    fecha, categoria, proveedor, descripcion, base, iva, isd, total: r2(base + iva + isd), retRenta, retIva,
    aPagar: r2(base + iva + isd - retRenta - retIva),
    identificacion: String(d?.identificacion ?? '').replace(/\D/g, '').slice(0, 13),
    factura: String(d?.factura ?? '').trim().slice(0, 30),
    formaPago, estado, vence, recurrente: !!d?.recurrente,
    tarjeta: tarjeta ? String(d?.tarjeta ?? '').trim().slice(0, 40) : '',
    exterior, liquidacion: exterior && !!d?.liquidacion,
    cubreDesde, cubreMeses,
    // De quién es la tarjeta o el dinero: si es de un socio, la empresa le debe el reembolso.
    pagador: d?.pagador === 'socio' ? 'socio' : 'empresa',
    socio: d?.pagador === 'socio' ? String(d?.socio ?? '').trim().slice(0, 60) : '',
    plataforma: /^[a-z0-9_]{2,30}$/.test(String(d?.plataforma ?? '')) ? d.plataforma : '',
  };
}

/** Meses (AAAA-MM) y monto devengado de cada uno: la base repartida en partes iguales. */
export function accrualMonths(g) {
  const n = Math.max(1, Number(g.cubreMeses) || 1);
  const from = g.cubreDesde || ym(g.fecha);
  const part = r2(g.base / n);
  return Array.from({ length: n }, (_, i) => ({ mes: addMonths(from, i), monto: i === n - 1 ? r2(g.base - part * (n - 1)) : part }));
}

/** Pago del estado de cuenta de la tarjeta de crédito. */
export function cardPaymentInput(d) {
  const fecha = String(d?.fecha ?? '');
  const monto = r2(d?.monto);
  if (!ISO.test(fecha)) return { error: 'Elige la fecha del pago.' };
  if (!(monto > 0)) return { error: 'Escribe cuánto pagaste de la tarjeta.' };
  const tipo = d?.tipo === 'reembolso' ? 'reembolso' : 'tarjeta';
  const socio = tipo === 'reembolso' ? String(d?.socio ?? '').trim().slice(0, 60) : '';
  if (tipo === 'reembolso' && socio.length < 2) return { error: 'Escribe a qué socio se le reembolsó.' };
  return { fecha, monto, tipo, socio, tarjeta: tipo === 'tarjeta' ? String(d?.tarjeta ?? '').trim().slice(0, 40) : '', referencia: String(d?.referencia ?? '').trim().slice(0, 80) };
}

/* ---------------------------------- Nómina ---------------------------------- */

/** Parámetros 2026 (Ecuador). Editables en el panel; confirmar con la contadora. */
export const PAYROLL_PARAMS_2026 = {
  sbu: 482, aportePersonal: 0.0945, aportePatronal: 0.1115, iece: 0.005, secap: 0.005, fondoReserva: 0.0833,
  // Canasta familiar básica de enero 2026 (rebaja de IR por gastos personales).
  cfb: 821.80,
};

/** Tabla del impuesto a la renta 2026, personas naturales (Res. NAC-DGERCGC25-00000043): [desde, impuesto fijo, % excedente]. */
export const IR_TABLE_2026 = [
  [0, 0, 0], [12208, 0, 0.05], [15549, 167, 0.10], [20188, 631, 0.12], [26700, 1412, 0.15],
  [35136, 2678, 0.20], [46575, 4965, 0.25], [62005, 8823, 0.30], [82679, 15025, 0.35], [109956, 24572, 0.37],
];
/** Canastas para el tope de gastos personales según cargas familiares (0, 1, 2, 3, 4, 5+). */
export const IR_CANASTAS = [7, 9, 11, 14, 17, 20];
export const IR_REBATE = 0.18;

export function incomeTaxAnnual(base, table = IR_TABLE_2026) {
  if (!(base > 0)) return 0;
  const row = [...table].reverse().find(([from]) => base > from) ?? table[0];
  return r2(row[1] + (base - row[0]) * row[2]);
}

/**
 * Retención mensual de IR en relación de dependencia: proyecta el ingreso gravado del año
 * (sueldo × 12 + extras y bonos del mes, menos el aporte personal; décimos y fondos son exentos),
 * calcula el impuesto, resta la rebaja por gastos personales (18 % del menor entre lo proyectado
 * y el tope de canastas) y divide para 12.
 */
export function incomeTaxRetention(emp, ingresosMes, p = PAYROLL_PARAMS_2026) {
  const extrasMes = Math.max(0, r2(ingresosMes - Number(emp.sueldo || 0)));
  const bruto = Number(emp.sueldo || 0) * 12 + extrasMes;
  const base = r2(bruto * (1 - p.aportePersonal));
  const tax = incomeTaxAnnual(base);
  const canastas = IR_CANASTAS[Math.min(5, Math.max(0, Math.round(Number(emp.cargasIr || 0))))];
  const rebaja = r2(Math.min(Number(emp.gastosPersonales || 0), canastas * (p.cfb ?? 821.80)) * IR_REBATE);
  return { base, impuesto: tax, rebaja, mensual: r2(Math.max(0, tax - rebaja) / 12) };
}

/** Meses completos entre el ingreso y el mes de la nómina. */
export function monthsWorked(ingreso, mes) {
  if (!ISO.test(String(ingreso ?? '')) || !/^\d{4}-\d{2}$/.test(String(mes ?? ''))) return 0;
  const [y1, m1, d1] = ingreso.split('-').map(Number); const [y2, m2] = mes.split('-').map(Number);
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) - (d1 > 1 ? 1 : 0));
}

/** Una línea del rol de pagos. emp = empleado; adj = ajustes del mes. */
export function payrollLine(emp, adj = {}, mes, p = PAYROLL_PARAMS_2026) {
  const dias = Math.max(0, Math.min(30, Number(adj.dias ?? 30)));
  const sueldo = r2(emp.sueldo);
  const proporcional = r2((sueldo * dias) / 30);
  const extras = r2(adj.extras); const bonos = r2(adj.bonos);
  const ingresos = r2(proporcional + extras + bonos);
  const aportePersonal = r2(ingresos * p.aportePersonal);
  const decimo13 = r2(ingresos / 12);
  const decimo14 = r2(((p.sbu / 12) * dias) / 30);
  // Fondos de reserva desde el mes 13 de trabajo.
  const fondo = monthsWorked(emp.ingreso, mes) >= 12 ? r2(ingresos * p.fondoReserva) : 0;
  const vacaciones = r2(ingresos / 24);
  const patronal = r2(ingresos * p.aportePatronal); const iece = r2(ingresos * p.iece); const secap = r2(ingresos * p.secap);
  const anticipos = r2(adj.anticipos); const otrosDesc = r2(adj.otrosDescuentos);
  const decimosEnRol = emp.decimosMensuales ? r2(decimo13 + decimo14) : 0;
  const fondoEnRol = emp.fondoMensual ? fondo : 0;
  const retencionIr = incomeTaxRetention(emp, ingresos, p).mensual;
  const neto = r2(ingresos + decimosEnRol + fondoEnRol - aportePersonal - retencionIr - anticipos - otrosDesc);
  return {
    empleadoId: emp.id, nombre: emp.nombre, cedula: emp.cedula ?? '', cargo: emp.cargo ?? '', dias, sueldo, proporcional, extras, bonos, ingresos,
    aportePersonal, retencionIr, anticipos, otrosDescuentos: otrosDesc, decimo13, decimo14, decimosEnRol, fondo, fondoEnRol, vacaciones,
    patronal, iece, secap, neto,
    // Lo que le cuesta a la empresa en el mes.
    costo: r2(ingresos + decimo13 + decimo14 + fondo + vacaciones + patronal + iece + secap),
    // Al IESS: aporte personal + patronal + IECE + SECAP + fondos no pagados en rol.
    alIess: r2(aportePersonal + patronal + iece + secap + (emp.fondoMensual ? 0 : fondo)),
  };
}

export function payrollTotals(lines) {
  const keys = ['ingresos', 'aportePersonal', 'retencionIr', 'anticipos', 'otrosDescuentos', 'decimo13', 'decimo14', 'decimosEnRol', 'fondo', 'fondoEnRol', 'vacaciones', 'patronal', 'iece', 'secap', 'neto', 'costo', 'alIess'];
  return Object.fromEntries(keys.map((k) => [k, r2(lines.reduce((t, l) => t + Number(l[k] || 0), 0))]));
}

/** Gastos que deja la nómina aprobada (por cuenta), para el estado de resultados. */
export function payrollExpenses(mes, totals) {
  const fecha = `${mes}-28`;
  return [
    { id: `nomina_${mes}_sueldos`, categoria: 'nomina_sueldos', base: totals.ingresos },
    { id: `nomina_${mes}_aportes`, categoria: 'nomina_aportes', base: r2(totals.patronal + totals.iece + totals.secap + totals.fondo) },
    { id: `nomina_${mes}_beneficios`, categoria: 'nomina_beneficios', base: r2(totals.decimo13 + totals.decimo14 + totals.vacaciones) },
  ].filter((g) => g.base > 0).map((g) => ({
    ...g, fecha, proveedor: 'Nómina del mes', descripcion: `Rol de pagos ${mes}`, iva: 0, total: g.base, retRenta: 0, retIva: 0, aPagar: g.base,
    identificacion: '', factura: '', formaPago: 'transferencia', estado: 'pagado', vence: null, recurrente: false, origen: 'nomina', isd: 0, tarjeta: '', pagador: 'empresa', socio: '', plataforma: '', exterior: false, liquidacion: false, cubreDesde: mes, cubreMeses: 1,
  }));
}

const int = (v, min, max) => Math.max(min, Math.min(max, Math.round(Number(v) || 0)));
export const EXIT_REASONS = ['renuncia', 'mutuo_acuerdo', 'despido_intempestivo', 'desahucio', 'visto_bueno', 'periodo_prueba', 'fin_obra'];

/** Valida un empleado. */
export function employeeInput(d) {
  const nombre = String(d?.nombre ?? '').trim().slice(0, 100);
  const cedula = String(d?.cedula ?? '').replace(/\D/g, '');
  const sueldo = r2(d?.sueldo);
  const ingreso = String(d?.ingreso ?? '');
  if (nombre.length < 3) return { error: 'Escribe el nombre completo.' };
  if (cedula.length !== 10) return { error: 'La cédula debe tener 10 dígitos.' };
  if (!(sueldo > 0)) return { error: 'Escribe el sueldo mensual.' };
  if (!ISO.test(ingreso)) return { error: 'Escribe la fecha de ingreso.' };
  if (d?.activo === false && d?.salida && (!ISO.test(String(d.salida)) || d.salida < ingreso)) return { error: 'La fecha de salida no es válida.' };
  return {
    nombre, cedula, sueldo, ingreso, cargo: String(d?.cargo ?? '').trim().slice(0, 80), correo: String(d?.correo ?? '').trim().toLowerCase().slice(0, 120),
    cuenta: String(d?.cuenta ?? '').trim().slice(0, 60), activo: d?.activo !== false, decimosMensuales: !!d?.decimosMensuales, fondoMensual: !!d?.fondoMensual,
    bajoSbu: sueldo < PAYROLL_PARAMS_2026.sbu,
    // Cargas: para utilidades (cónyuge o conviviente, hijos menores o con discapacidad) y para el IR (además padres e hijos hasta 21).
    cargasUtilidades: int(d?.cargasUtilidades, 0, 15), cargasIr: int(d?.cargasIr, 0, 15),
    gastosPersonales: Math.max(0, Math.min(200000, r2(d?.gastosPersonales))),
    region: d?.region === 'sierra' ? 'sierra' : 'costa',
    salida: d?.activo === false && ISO.test(String(d?.salida ?? '')) ? d.salida : null,
    motivoSalida: d?.activo === false && EXIT_REASONS.includes(d?.motivoSalida) ? d.motivoSalida : null,
    vacacionesPendientes: Math.max(0, Math.min(90, r2(d?.vacacionesPendientes))),
  };
}
