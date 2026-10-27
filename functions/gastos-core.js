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
  tecnologia: { label: 'Tecnología, software y nube', code: '520228', account: 'OTROS GASTOS' },
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

/** Valida y normaliza un gasto que llega del panel. */
export function expenseInput(d) {
  const fecha = String(d?.fecha ?? '');
  const categoria = String(d?.categoria ?? '');
  const proveedor = String(d?.proveedor ?? '').trim().slice(0, 120);
  const descripcion = String(d?.descripcion ?? '').trim().slice(0, 400);
  const base = r2(d?.base); const iva = r2(d?.iva);
  const retRenta = r2(d?.retRenta); const retIva = r2(d?.retIva);
  if (!ISO.test(fecha)) return { error: 'Elige la fecha.' };
  if (!MANUAL_CATEGORIES.includes(categoria)) return { error: 'Elige la categoría.' };
  if (proveedor.length < 2) return { error: 'Escribe a quién se le pagó.' };
  if (!(base > 0)) return { error: 'Escribe el valor sin IVA.' };
  if (iva < 0 || retRenta < 0 || retIva < 0) return { error: 'Los valores no pueden ser negativos.' };
  if (iva > base * 0.16) return { error: 'El IVA parece alto para esa base (máximo 15 %).' };
  const estado = d?.estado === 'por_pagar' ? 'por_pagar' : 'pagado';
  const vence = ISO.test(String(d?.vence ?? '')) ? d.vence : null;
  if (estado === 'por_pagar' && !vence) return { error: 'Si está por pagar, pon la fecha de vencimiento.' };
  return {
    fecha, categoria, proveedor, descripcion, base, iva, total: r2(base + iva), retRenta, retIva,
    aPagar: r2(base + iva - retRenta - retIva),
    identificacion: String(d?.identificacion ?? '').replace(/\D/g, '').slice(0, 13),
    factura: String(d?.factura ?? '').trim().slice(0, 30),
    formaPago: PAY_METHODS.includes(d?.formaPago) ? d.formaPago : 'transferencia',
    estado, vence, recurrente: !!d?.recurrente,
  };
}

/* ---------------------------------- Nómina ---------------------------------- */

/** Parámetros 2026 (Ecuador). Editables en el panel; confirmar con la contadora. */
export const PAYROLL_PARAMS_2026 = {
  sbu: 482, aportePersonal: 0.0945, aportePatronal: 0.1115, iece: 0.005, secap: 0.005, fondoReserva: 0.0833,
};

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
  const neto = r2(ingresos + decimosEnRol + fondoEnRol - aportePersonal - anticipos - otrosDesc);
  return {
    empleadoId: emp.id, nombre: emp.nombre, cedula: emp.cedula ?? '', cargo: emp.cargo ?? '', dias, sueldo, proporcional, extras, bonos, ingresos,
    aportePersonal, anticipos, otrosDescuentos: otrosDesc, decimo13, decimo14, decimosEnRol, fondo, fondoEnRol, vacaciones,
    patronal, iece, secap, neto,
    // Lo que le cuesta a la empresa en el mes.
    costo: r2(ingresos + decimo13 + decimo14 + fondo + vacaciones + patronal + iece + secap),
    // Al IESS: aporte personal + patronal + IECE + SECAP + fondos no pagados en rol.
    alIess: r2(aportePersonal + patronal + iece + secap + (emp.fondoMensual ? 0 : fondo)),
  };
}

export function payrollTotals(lines) {
  const keys = ['ingresos', 'aportePersonal', 'anticipos', 'otrosDescuentos', 'decimo13', 'decimo14', 'decimosEnRol', 'fondo', 'fondoEnRol', 'vacaciones', 'patronal', 'iece', 'secap', 'neto', 'costo', 'alIess'];
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
    identificacion: '', factura: '', formaPago: 'transferencia', estado: 'pagado', vence: null, recurrente: false, origen: 'nomina',
  }));
}

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
  return {
    nombre, cedula, sueldo, ingreso, cargo: String(d?.cargo ?? '').trim().slice(0, 80), correo: String(d?.correo ?? '').trim().toLowerCase().slice(0, 120),
    cuenta: String(d?.cuenta ?? '').trim().slice(0, 60), activo: d?.activo !== false, decimosMensuales: !!d?.decimosMensuales, fondoMensual: !!d?.fondoMensual,
    bajoSbu: sueldo < PAYROLL_PARAMS_2026.sbu,
  };
}
