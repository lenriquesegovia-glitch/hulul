import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accrualMonths, cardPaymentInput, employeeInput, expenseInput, monthsWorked, payrollExpenses, payrollLine, payrollTotals } from './gastos-core.js';

test('gasto: valida y calcula lo que se paga', () => {
  const g = expenseInput({ fecha: '2026-10-20', categoria: 'honorarios', proveedor: 'Contadora', base: 200, iva: 30, retRenta: 20, retIva: 21, estado: 'pagado' });
  assert.equal(g.total, 230);
  assert.equal(g.aPagar, 189);
  assert.ok(expenseInput({ fecha: '2026-10-20', categoria: 'nomina_sueldos', proveedor: 'X', base: 1 }).error, 'la nómina no se registra a mano');
  assert.ok(expenseInput({ fecha: '2026-10-20', categoria: 'otros', proveedor: 'X', base: 10, estado: 'por_pagar' }).error, 'por pagar exige vencimiento');
  assert.ok(expenseInput({ fecha: '2026-10-20', categoria: 'otros', proveedor: 'X', base: 10, iva: 5 }).error, 'IVA demasiado alto');
});

test('meses trabajados', () => {
  assert.equal(monthsWorked('2025-10-01', '2026-10'), 12);
  assert.equal(monthsWorked('2025-10-15', '2026-10'), 11);
  assert.equal(monthsWorked('2026-10-01', '2026-10'), 0);
});

test('rol de pagos con salario básico 2026', () => {
  const emp = { id: 'e1', nombre: 'Ana', sueldo: 482, ingreso: '2026-01-01', decimosMensuales: false, fondoMensual: false };
  const l = payrollLine(emp, {}, '2026-10');
  assert.equal(l.aportePersonal, 45.55);
  assert.equal(l.patronal, 53.74);
  assert.equal(l.decimo14, 40.17);
  assert.equal(l.fondo, 0, 'sin fondos de reserva el primer año');
  assert.equal(l.neto, 436.45);
  const l2 = payrollLine({ ...emp, ingreso: '2025-01-01', decimosMensuales: true, fondoMensual: true }, { extras: 18, anticipos: 50 }, '2026-10');
  assert.equal(l2.ingresos, 500);
  assert.equal(l2.fondo, 41.65);
  assert.equal(l2.neto, Math.round((500 + 41.67 + 40.17 + 41.65 - 47.25 - 50) * 100) / 100);
  const t = payrollTotals([l, l2]);
  const g = payrollExpenses('2026-10', t);
  assert.deepEqual(g.map((x) => x.categoria), ['nomina_sueldos', 'nomina_aportes', 'nomina_beneficios']);
  assert.equal(g[0].base, 982);
});

test('empleado: valida', () => {
  assert.ok(employeeInput({ nombre: 'Ana Ruiz', cedula: '0912345678', sueldo: 482, ingreso: '2026-01-02' }).nombre);
  assert.ok(employeeInput({ nombre: 'Ana', cedula: '12', sueldo: 482, ingreso: '2026-01-02' }).error);
  assert.equal(employeeInput({ nombre: 'Ana Ruiz', cedula: '0912345678', sueldo: 300, ingreso: '2026-01-02' }).bajoSbu, true);
});

test('tarjeta, exterior y devengado', () => {
  const g = expenseInput({ fecha: '2026-10-03', categoria: 'tecnologia', proveedor: 'Apple Developer', base: 99, iva: 14.85, isd: 4.95, formaPago: 'tarjeta', estado: 'por_pagar', exterior: true, cubreMeses: 12 });
  assert.equal(g.estado, 'pagado', 'con tarjeta el proveedor ya cobró; la deuda es con la tarjeta');
  assert.equal(g.total, 118.8);
  const m = accrualMonths(g);
  assert.equal(m.length, 12); assert.equal(m[0].mes, '2026-10'); assert.equal(m[11].mes, '2027-09');
  assert.equal(Math.round(m.reduce((t, x) => t + x.monto, 0) * 100) / 100, 99);
  const nov = expenseInput({ fecha: '2026-11-02', categoria: 'tecnologia', proveedor: 'Google Cloud', base: 40, formaPago: 'tarjeta', cubreDesde: '2026-10' });
  assert.deepEqual(accrualMonths(nov), [{ mes: '2026-10', monto: 40 }], 'la factura de octubre cobrada en noviembre se devenga en octubre');
  assert.ok(expenseInput({ fecha: '2026-10-03', categoria: 'otros', proveedor: 'X', base: 100, isd: 20 }).error);
  assert.ok(cardPaymentInput({ fecha: '2026-10-25', monto: 0 }).error);
});
