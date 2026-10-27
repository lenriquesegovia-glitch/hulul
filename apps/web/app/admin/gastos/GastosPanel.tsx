'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BILLING_LABEL, canDo, cardStatus, ecDate, EXPENSE_CATEGORIES, expenseSlices, ISD_EXEMPT_2026, ISD_RATE, monthEnd, platformCosts, PLATFORMS, EXPENSE_GROUPS, EXPENSE_PAY_LABEL, expenseGroupOf, expenseJournal, expenseSummary, incomeStatement, MANUAL_EXPENSE_CATEGORIES, percent, r2, resultSeries,
  type Employee, type Expense, type ExpenseGroup, type Granularity, type Payroll, type PayrollLine,
} from '@hulul/shared/dashboard';
import type { EmployeeInput, ExpenseInput, ExpensesData, PayrollAdjust } from '@hulul/shared/firebase';
import { MUESTRA, useAdmin } from '../AdminShell';
import { Badge, Donut, Drawer, fmtDay, FlowChart, HBars, Kpi, Loading, money, PageHead, PeriodBar } from '../ui';

/**
 * Gastos de la empresa y nómina: lo que HULUL gasta (administrativos, nómina, subcontratos,
 * marketing, financieros), lo que debe a sus proveedores, el rol de pagos mensual y el estado
 * de resultados (ingresos de HULUL − gastos = utilidad). Escriben socios y contadora (permiso pagos).
 */

type Tab = 'gastos' | 'pagar' | 'plataformas' | 'tarjeta' | 'nomina' | 'empleados';
const TABS: Tab[] = ['gastos', 'pagar', 'plataformas', 'tarjeta', 'nomina', 'empleados'];
const HEAD = ['CORPORACIÓN COFFEEPORT CÍA. LTDA. — HULUL', 'RUC 0993265160001'];
const errMsg = (e: unknown) => ((e as { message?: string }).message || 'No se pudo completar.').replace(/\s*\[\d{3}\]\s*$/, '');
const fb = () => import('@hulul/shared/firebase');
type Row = Record<string, string | number | null | undefined>;
const pct2 = (n: number) => `${(n * 100).toLocaleString('es-EC', { maximumFractionDigits: 2 })} %`;
const monthLabel = (ym: string) => new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('es-EC', { timeZone: 'UTC', month: 'long', year: 'numeric' });

export function GastosPanel() {
  const { view, range, now, role } = useAdmin();
  const [data, setData] = useState<ExpensesData | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('gastos');
  const [group, setGroup] = useState<ExpenseGroup | 'todos'>('todos');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [gran, setGran] = useState<Granularity>('mes');
  const [open, setOpen] = useState<Expense | 'nuevo' | null>(null);
  const [preset, setPreset] = useState<Partial<ExpenseInput> | null>(null);
  const [list, setList] = useState<{ title: string; ids: string[] } | null>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(MUESTRA ? await (await fetch('/muestra-gastos.json')).json() : await (await fb()).adminExpenses());
    } catch (e) { setError(errMsg(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  // ?vista=pagar|plataformas|tarjeta|nomina (desde la bandeja de novedades).
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('vista') as Tab | null;
    if (v && TABS.includes(v)) { setTab(v); setTimeout(() => document.getElementById('pestanas')?.scrollIntoView({ behavior: 'smooth' }), 400); }
  }, []);
  const card = useMemo(() => cardStatus(data?.gastos ?? [], data?.pagosTarjeta ?? [], now), [data, now]);
  const newExpense = (p: Partial<ExpenseInput> | null = null) => { setPreset(p); setOpen('nuevo'); };

  const canEdit = !!data?.canEdit && (!MUESTRA || canDo(role, 'pagos'));
  const gastos = useMemo(() => data?.gastos ?? [], [data]);
  const byId = useMemo(() => new Map(gastos.map((g) => [g.id, g])), [gastos]);
  const ledger = useMemo(() => view?.ledger ?? [], [view]);
  const sum = useMemo(() => expenseSummary(gastos, range, now), [gastos, range, now]);
  const is = useMemo(() => incomeStatement(ledger, gastos, range, now), [ledger, gastos, range, now]);
  const series = useMemo(() => resultSeries(ledger, gastos, range, gran), [ledger, gastos, range, gran]);
  const today = ecDate(now);
  const thisMonth = today.slice(0, 7);
  const payrollNow = data?.roles.find((r) => r.mes === thisMonth) ?? null;

  const rows = useMemo(() => gastos
    .filter((g) => g.fecha >= range.from && g.fecha <= range.to)
    .filter((g) => group === 'todos' || expenseGroupOf(g) === group)
    .filter((g) => !cat || g.categoria === cat)
    .filter((g) => !q || `${g.proveedor} ${g.descripcion} ${g.factura} ${g.identificacion}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, z) => z.fecha.localeCompare(a.fecha)), [gastos, range, group, cat, q]);

  const showList = (title: string, ids: string[]) => setList({ title, ids });
  const goGroup = (g: ExpenseGroup | 'todos') => { setGroup(g); setCat(''); setTab('gastos'); };

  /* ------------------------------ Excel y contadora ------------------------------ */
  const sheets = (): import('../excel').SheetSpec[] => {
    const inRange = gastos.filter((g) => g.fecha >= range.from && g.fecha <= range.to).sort((a, z) => a.fecha.localeCompare(z.fecha));
    const roles = (data?.roles ?? []).filter((r) => monthEnd(r.mes) >= range.from && monthEnd(r.mes) <= range.to);
    const j = expenseJournal(gastos, data?.roles ?? [], range, data?.pagosTarjeta ?? []);
    const pc = platformCosts(gastos, now, 12);
    const per = `Periodo ${range.from} al ${range.to}`;
    const out: import('../excel').SheetSpec[] = [
      { name: 'Estado de resultados', title: [...HEAD, per, 'Ingresos propios de HULUL (sin IVA ni valores de terceros) menos gastos. Utilidad antes de participación e impuesto a la renta.'],
        columns: [{ key: 'concepto', header: 'Concepto', width: 46 }, { key: 'valor', header: 'Valor', money: true }],
        rows: [
          { concepto: 'Prestación de servicios (4102): cargo de plataforma y comisión', valor: is.ingresos.servicios },
          { concepto: 'Otros ingresos ordinarios (4109): multas y cargos por cancelación', valor: is.ingresos.otros },
          { concepto: 'TOTAL INGRESOS', valor: is.ingresos.total },
          ...is.gastos.map((g) => ({ concepto: g.key === 'creditos' ? `(−) ${g.label}` : `(−) Gastos ${g.label.toLowerCase()}`, valor: -g.value })),
          { concepto: 'TOTAL GASTOS', valor: -is.totalGastos },
          { concepto: 'UTILIDAD (PÉRDIDA) DEL PERIODO', valor: is.utilidad },
        ] },
      { name: 'Gastos', title: [...HEAD, per, 'Gasto = base sin IVA. El IVA pagado va a crédito tributario (1010501).'],
        columns: [{ key: 'fecha', header: 'Fecha', width: 12 }, { key: 'grupo', header: 'Grupo', width: 16 }, { key: 'categoria', header: 'Categoría', width: 30 }, { key: 'cuenta', header: 'Cuenta Supercias', text: true }, { key: 'proveedor', header: 'Proveedor / beneficiario', width: 30 }, { key: 'identificacion', header: 'RUC / cédula', text: true, width: 16 }, { key: 'factura', header: 'Nº comprobante', text: true, width: 20 }, { key: 'descripcion', header: 'Detalle', width: 30 }, { key: 'base', header: 'Base', money: true }, { key: 'iva', header: 'IVA', money: true }, { key: 'isd', header: 'ISD', money: true }, { key: 'total', header: 'Total', money: true }, { key: 'retRenta', header: 'Ret. renta', money: true }, { key: 'retIva', header: 'Ret. IVA', money: true }, { key: 'aPagar', header: 'A pagar', money: true }, { key: 'forma', header: 'Forma de pago' }, { key: 'devengado', header: 'Se devenga (desde, meses)', width: 22 }, { key: 'exterior', header: 'Exterior' }, { key: 'liquidacion', header: 'Liquidación de compra' }, { key: 'estado', header: 'Estado' }, { key: 'vence', header: 'Vence' }, { key: 'pagadoEl', header: 'Pagado el' }],
        rows: inRange.map((g): Row => ({ ...g, recurrente: g.recurrente ? 'Sí' : '', exterior: g.exterior ? 'Sí' : '', liquidacion: g.liquidacion ? 'Sí' : g.exterior ? 'Falta' : '', devengado: g.cubreMeses > 1 ? `${g.cubreDesde} (${g.cubreMeses} meses)` : g.cubreDesde, grupo: EXPENSE_GROUPS.find((x) => x.key === expenseGroupOf(g))?.label, categoria: EXPENSE_CATEGORIES[g.categoria]?.label ?? g.categoria, cuenta: EXPENSE_CATEGORIES[g.categoria]?.code, forma: EXPENSE_PAY_LABEL[g.formaPago] ?? g.formaPago, estado: g.estado === 'pagado' ? 'Pagado' : 'Por pagar', vence: g.vence ?? '', pagadoEl: g.pagadoEl ?? '' })),
        totals: ['base', 'iva', 'isd', 'total', 'retRenta', 'retIva', 'aPagar'] },
      { name: 'Diario gastos y nómina', title: [...HEAD, per, 'Partida doble con el plan de cuentas de la Superintendencia de Compañías (propuesta para validar).'],
        columns: [{ key: 'date', header: 'Fecha', width: 12 }, { key: 'entry', header: 'Asiento', width: 22 }, { key: 'code', header: 'Código', text: true }, { key: 'accountName', header: 'Cuenta', width: 46 }, { key: 'party', header: 'Tercero', width: 28 }, { key: 'detail', header: 'Detalle', width: 40 }, { key: 'debit', header: 'Debe', money: true }, { key: 'credit', header: 'Haber', money: true }],
        rows: j as unknown as Row[], totals: ['debit', 'credit'] },
      { name: 'Compras (ATS)', title: [...HEAD, per, 'Comprobantes de compra con identificación del proveedor, para el anexo transaccional y las retenciones.'],
        columns: [{ key: 'fecha', header: 'Fecha', width: 12 }, { key: 'identificacion', header: 'RUC / cédula', text: true, width: 16 }, { key: 'proveedor', header: 'Proveedor', width: 30 }, { key: 'factura', header: 'Nº comprobante', text: true, width: 20 }, { key: 'base0', header: 'Base 0 %', money: true }, { key: 'base15', header: 'Base 15 %', money: true }, { key: 'iva', header: 'IVA', money: true }, { key: 'retRenta', header: 'Ret. renta', money: true }, { key: 'retIva', header: 'Ret. IVA', money: true }],
        rows: inRange.filter((g) => g.origen !== 'nomina').map((g): Row => ({ fecha: g.fecha, identificacion: g.identificacion, proveedor: g.proveedor, factura: g.factura, iva: g.iva, retRenta: g.retRenta, retIva: g.retIva, base0: g.iva ? 0 : g.base, base15: g.iva ? g.base : 0 })), totals: ['base0', 'base15', 'iva', 'retRenta', 'retIva'] },
    ];
    out.push({ name: 'Plataformas', title: [...HEAD, 'Costo devengado mensual de los servicios que hacen funcionar HULUL (últimos 12 meses).'],
      columns: [{ key: 'name', header: 'Servicio', width: 32 }, { key: 'billing', header: 'Cobro', width: 22 }, ...pc[0].months.map((m) => ({ key: m.mes, header: m.mes, money: true })), { key: 'total', header: 'Total', money: true }],
      rows: pc.map((r): Row => ({ name: r.name, billing: BILLING_LABEL[r.billing], ...Object.fromEntries(r.months.map((m) => [m.mes, m.monto])), total: r.total })), totals: [...pc[0].months.map((m) => m.mes), 'total'] });
    out.push({ name: 'Tarjeta de crédito', title: [...HEAD, `Deuda de la tarjeta al ${today}: ${money(card.saldo)} (cargos ${money(card.cargos)} − pagos ${money(card.pagos)}).`],
      columns: [{ key: 'fecha', header: 'Fecha', width: 12 }, { key: 'tipo', header: 'Movimiento', width: 14 }, { key: 'detalle', header: 'Detalle', width: 40 }, { key: 'tarjeta', header: 'Tarjeta', width: 20 }, { key: 'cargo', header: 'Cargo', money: true }, { key: 'pago', header: 'Pago', money: true }],
      rows: [
        ...gastos.filter((g) => g.formaPago === 'tarjeta' && g.pagador !== 'socio').map((g): Row => ({ fecha: g.fecha, tipo: 'Cargo', detalle: `${g.proveedor}${g.exterior ? ' (exterior)' : ''}`, tarjeta: g.tarjeta, cargo: g.aPagar, pago: null })),
        ...(data?.pagosTarjeta ?? []).filter((p) => p.tipo !== 'reembolso').map((p): Row => ({ fecha: p.fecha, tipo: 'Pago', detalle: p.referencia || 'Pago del estado de cuenta', tarjeta: p.tarjeta, cargo: null, pago: p.monto })),
      ].sort((a, z) => String(a.fecha).localeCompare(String(z.fecha))), totals: ['cargo', 'pago'] });
    for (const r of roles) out.push(payrollSheet(r));
    return out;
  };

  const exportXlsx = async () => {
    setBusy('xlsx'); setMsg('');
    try { const { downloadXlsx } = await import('../excel'); await downloadXlsx(`hulul-gastos-nomina-${range.from}_${range.to}.xlsx`, sheets()); }
    catch (e) { setMsg(errMsg(e)); } finally { setBusy(''); }
  };
  const sendAccountant = async () => {
    setBusy('mail'); setMsg('');
    try {
      if (MUESTRA) throw new Error('En la muestra no se envían correos.');
      const { buildXlsx, toBase64 } = await import('../excel');
      const content = toBase64(await buildXlsx(sheets()));
      const to = await (await fb()).adminSendToAccountant({ subject: `HULUL · gastos y nómina del ${range.from} al ${range.to}`, message: `Adjunto el estado de resultados, los gastos, el diario de gastos y nómina, las compras para el ATS y los roles de pago del ${range.from} al ${range.to}.`, files: [{ fileName: `hulul-gastos-nomina-${range.from}_${range.to}.xlsx`, content }] });
      setMsg(`Enviado a ${to.join(', ')}.`);
    } catch (e) { setMsg(errMsg(e)); } finally { setBusy(''); }
  };
  const copyRecurring = async () => {
    setBusy('rec'); setMsg('');
    try {
      if (MUESTRA) throw new Error('En la muestra no se guardan cambios.');
      const n = await (await fb()).adminCopyRecurring(thisMonth);
      setMsg(n ? `Se copiaron ${n} gastos fijos a ${monthLabel(thisMonth)} (quedan por pagar).` : 'No hay gastos fijos nuevos que copiar este mes.');
      await load();
    } catch (e) { setMsg(errMsg(e)); } finally { setBusy(''); }
  };

  if (error) return (<><PageHead title="Gastos y nómina" /><div className="adm-err" role="alert">{error}</div></>);

  const tabs: [Tab, string][] = [['gastos', `Gastos (${rows.length})`], ['pagar', `Por pagar (${sum.porPagar.ids.length})`], ['plataformas', 'Plataformas'], ['tarjeta', 'Tarjeta de crédito'], ['nomina', 'Rol de pagos'], ...(canEdit ? [['empleados', `Empleados (${data?.empleados.filter((e) => e.activo).length ?? 0})`] as [Tab, string]] : [])];
  const groupItems = sum.byGroup.map((g) => ({ label: g.label, color: g.color, count: Math.round(g.value ?? 0), onClick: () => goGroup(g.key as ExpenseGroup) }));

  return (
    <>
      <PageHead title="Gastos y nómina" lead="Lo que gasta la empresa, lo que se debe a proveedores, el rol de pagos y la utilidad real de HULUL.">
        {canEdit && <button type="button" className="adm-btn solid" onClick={() => newExpense()}>+ Registrar gasto</button>}
        <button type="button" className="adm-btn" disabled={!data || !!busy} onClick={exportXlsx}>{busy === 'xlsx' ? 'Armando…' : 'Descargar Excel'}</button>
        <button type="button" className="adm-btn" disabled={!data || !!busy} onClick={sendAccountant}>{busy === 'mail' ? 'Enviando…' : 'Enviar a la contadora'}</button>
      </PageHead>
      <PeriodBar only={['mes', 'ultimos_30', 'ultimos_90', 'todo', 'personalizado']} />
      {msg && <div className="adm-note" role="status">{msg}</div>}
      {!data || !view ? <Loading /> : (
        <>
          <div className="adm-kpis">
            <Kpi label="Ingresos de HULUL" value={money(is.ingresos.total)} hint="Plataforma, comisión y multas (sin IVA)" href="/admin/contabilidad" />
            <Kpi label="Gastos del periodo (devengado)" value={money(is.totalGastos)} hint={`${sum.count} gastos · IVA a crédito ${money(sum.ivaCredito)}${sum.prepaid.diferido ? ` · ${money(sum.prepaid.diferido)} diferido a meses siguientes` : ''}`} onClick={() => goGroup('todos')} />
            <Kpi accent label={is.utilidad >= 0 ? 'Utilidad' : 'Pérdida'} value={money(is.utilidad)} hint={is.ingresos.total ? `Margen ${percent(is.margen)}` : 'Sin ingresos en el periodo'} onClick={() => document.getElementById('resultados')?.scrollIntoView({ behavior: 'smooth' })} />
            <Kpi label="Por pagar a proveedores" value={money(sum.porPagar.total)} hint={sum.vencidos.total ? <span style={{ color: 'var(--bad)' }}>{money(sum.vencidos.total)} vencido</span> : sum.proximos.total ? `${money(sum.proximos.total)} vence en 7 días` : 'Nada vencido'} onClick={() => setTab('pagar')} />
            <Kpi label="Deuda de la tarjeta" value={money(card.saldo)} hint={card.socios.length ? `+ ${money(card.socios.reduce((t, x) => t + x.total, 0))} por reembolsar a socios` : 'Cargos − pagos del estado de cuenta'} onClick={() => setTab('tarjeta')} />
            <Kpi label={`Nómina de ${monthLabel(thisMonth).split(' ')[0]}`} value={payrollNow ? money(payrollNow.totals.costo) : '—'} hint={payrollNow ? `${payrollNow.status === 'aprobado' ? 'Aprobada' : 'Borrador'} · neto ${money(payrollNow.totals.neto)}` : 'Aún sin rol de pagos'} onClick={() => setTab('nomina')} />
          </div>

          <div className="adm-card">
            <div className="row gap-8" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div><h2>Ingresos vs. gastos</h2><p className="sub">Toca un punto para ver los gastos de ese {gran === 'mes' ? 'mes' : 'periodo'}.</p></div>
              <div className="adm-bar">{(['semana', 'mes'] as Granularity[]).map((g) => <button key={g} type="button" className="adm-chip" aria-pressed={gran === g} onClick={() => setGran(g)}>{g === 'semana' ? 'Semana' : 'Mes'}</button>)}</div>
            </div>
            <FlowChart gran={gran} keys={['inflow', 'outflow', 'net']} noun="gastos" labels={{ inflow: 'Ingresos de HULUL', outflow: 'Gastos', net: 'Utilidad' }}
              points={series.map((p) => ({ key: p.key, from: p.from, to: p.to, inflow: p.ingresos, card: 0, outflow: p.gastos, net: p.utilidad, projected: 0, ids: p.ids }))}
              onPick={(title, ids) => showList(`Gastos · ${title}`, ids)} />
          </div>

          <div className="adm-grid g-2">
            <div className="adm-card">
              <h2>¿En qué se va el dinero?</h2><p className="sub">Por grupo. Toca uno para ver sus gastos.</p>
              {groupItems.length ? <Donut items={groupItems} center={sum.total >= 1000 ? `${(sum.total / 1000).toLocaleString('es-EC', { maximumFractionDigits: 1 })} mil` : Math.round(sum.total)} sub="dólares en gastos" /> : <div className="adm-empty">Sin gastos en este periodo.</div>}
            </div>
            <div className="adm-card" id="resultados">
              <h2>Estado de resultados</h2><p className="sub">{fmtDay(range.from)} – {fmtDay(range.to)} · antes de participación e impuesto a la renta</p>
              <dl className="adm-kv">
                <dt>Prestación de servicios (4102)</dt><dd>{money(is.ingresos.servicios)}</dd>
                <dt>Otros ingresos: multas y cancelaciones (4109)</dt><dd>{money(is.ingresos.otros)}</dd>
                <dt style={{ fontWeight: 800 }}>Total ingresos</dt><dd>{money(is.ingresos.total)}</dd>
                {is.gastos.map((g) => (
                  <Fragment key={g.key}><dt>{g.ids.length ? <button type="button" className="adm-kpi-link" onClick={() => (g.key === 'creditos' ? null : goGroup(g.key as ExpenseGroup))}>(−) {g.label}</button> : <>(−) {g.label}</>}</dt><dd style={{ color: 'var(--bad)' }}>-{money(g.value)}</dd></Fragment>
                ))}
                <dt style={{ fontWeight: 800 }}>Total gastos</dt><dd style={{ color: 'var(--bad)' }}>-{money(is.totalGastos)}</dd>
                <dt style={{ fontWeight: 800 }}>{is.utilidad >= 0 ? 'Utilidad del periodo' : 'Pérdida del periodo'}</dt><dd className="big" style={{ color: is.utilidad >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{money(is.utilidad)}</dd>
              </dl>
            </div>
          </div>

          <div className="adm-grid g-2">
            <div className="adm-card">
              <h2>Por categoría</h2><p className="sub">Con su cuenta del plan de la Superintendencia.</p>
              <HBars items={sum.byCategory.map((c) => ({ label: `${c.code} · ${c.label}`, value: c.value ?? 0, display: money(c.value ?? 0), color: EXPENSE_GROUPS.find((g) => g.key === EXPENSE_CATEGORIES[c.key]?.group)?.color, onClick: () => { setGroup('todos'); setCat(c.key); setTab('gastos'); } }))} />
            </div>
            <div className="adm-card">
              <h2>A quién se le paga más</h2><p className="sub">Los 10 proveedores con más gasto en el periodo.</p>
              <HBars items={sum.byProvider.map((p) => ({ label: p.label, value: p.value ?? 0, display: money(p.value ?? 0), onClick: () => showList(p.label, p.ids) }))} />
            </div>
          </div>

          <div className="adm-tabs" role="tablist" id="pestanas">
            {tabs.map(([k, l]) => <button key={k} type="button" role="tab" className="adm-tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
          </div>

          {tab === 'gastos' && (
            <div className="adm-grid" style={{ gap: 10 }}>
              <div className="adm-bar">
                <button type="button" className="adm-chip" aria-pressed={group === 'todos' && !cat} onClick={() => goGroup('todos')}>Todos</button>
                {EXPENSE_GROUPS.map((g) => <button key={g.key} type="button" className="adm-chip" aria-pressed={group === g.key} onClick={() => goGroup(g.key)}>{g.label}</button>)}
                {cat && <Badge tone="t-info">{EXPENSE_CATEGORIES[cat]?.label} <button type="button" className="adm-x" style={{ fontSize: 14 }} aria-label="Quitar filtro" onClick={() => setCat('')}>×</button></Badge>}
                <input className="adm-input" placeholder="Buscar proveedor, detalle o factura" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 220 }} />
                {canEdit && <button type="button" className="adm-btn" disabled={!!busy} onClick={copyRecurring} title="Copia los gastos marcados como fijos del mes anterior">{busy === 'rec' ? 'Copiando…' : `Copiar gastos fijos a ${monthLabel(thisMonth).split(' ')[0]}`}</button>}
              </div>
              <ExpenseTable rows={rows} today={today} onOpen={setOpen} />
            </div>
          )}

          {tab === 'pagar' && <PayablesTab gastos={gastos} today={today} canEdit={canEdit} onOpen={setOpen} onDone={load} />}
          {tab === 'nomina' && <PayrollTab data={data} month={thisMonth} canEdit={canEdit} onDone={load} />}
          {tab === 'plataformas' && <PlatformsTab gastos={gastos} now={now} canEdit={canEdit} onAdd={(k) => newExpense(platformPreset(k, today))} onList={showList} />}
          {tab === 'tarjeta' && <CardTab data={data} now={now} canEdit={canEdit} onList={showList} onDone={load} />}
          {tab === 'empleados' && canEdit && <EmployeesTab empleados={data.empleados} sbu={data.params.sbu} onDone={load} />}
        </>
      )}

      {open && (
        <ExpenseDrawer g={open === 'nuevo' ? null : open} preset={preset} canEdit={canEdit} today={today} onClose={() => setOpen(null)} onSaved={async () => { setOpen(null); await load(); }} />
      )}
      {list && (
        <Drawer title={list.title} sub={`${list.ids.length} gastos · ${money(list.ids.reduce((t, id) => t + (byId.get(id)?.base ?? 0), 0))}`} onClose={() => setList(null)}>
          <ExpenseTable rows={list.ids.map((id) => byId.get(id)).filter((g): g is Expense => !!g)} today={today} onOpen={(g) => { setList(null); setOpen(g); }} compact />
        </Drawer>
      )}
    </>
  );
}

/* ---------------------------------- Tabla de gastos ---------------------------------- */

function StatusBadge({ g, today }: { g: Expense; today: string }) {
  if (g.pagador === 'socio') return <Badge tone="t-violet">Pagó {g.socio || 'un socio'}</Badge>;
  if (g.formaPago === 'tarjeta') return <Badge tone="t-info">En la tarjeta</Badge>;
  if (g.estado === 'pagado') return <Badge tone="t-ok">Pagado</Badge>;
  if (g.vence && g.vence < today) return <Badge tone="t-bad">Vencido {fmtDay(g.vence)}</Badge>;
  return <Badge tone="t-warn">Por pagar{g.vence ? ` · ${fmtDay(g.vence)}` : ''}</Badge>;
}

function ExpenseTable({ rows, today, onOpen, compact }: { rows: Expense[]; today: string; onOpen: (g: Expense) => void; compact?: boolean }) {
  if (!rows.length) return <div className="adm-empty">No hay gastos con esos filtros.</div>;
  const tot = (k: 'base' | 'iva' | 'aPagar') => rows.reduce((t, g) => t + g[k], 0);
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead><tr><th>Fecha</th><th>Proveedor</th>{!compact && <th>Categoría</th>}<th className="num">Base</th>{!compact && <th className="num">IVA</th>}<th className="num">A pagar</th><th>Estado</th></tr></thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.id} className="click" onClick={() => onOpen(g)}>
              <td style={{ whiteSpace: 'nowrap' }}>{fmtDay(g.fecha)}</td>
              <td><b>{g.proveedor}</b>{g.recurrente && <> <Badge tone="t-mute">fijo</Badge></>}{g.origen === 'nomina' && <> <Badge tone="t-info">nómina</Badge></>}<div className="muted" style={{ fontSize: 12.5 }}>{g.descripcion || g.factura || EXPENSE_PAY_LABEL[g.formaPago]}</div></td>
              {!compact && <td style={{ fontSize: 13 }}>{EXPENSE_CATEGORIES[g.categoria]?.label ?? g.categoria}<div className="muted" style={{ fontSize: 12 }}>{EXPENSE_CATEGORIES[g.categoria]?.code}</div></td>}
              <td className="num">{money(g.base)}</td>
              {!compact && <td className="num">{money(g.iva)}</td>}
              <td className="num"><b>{money(g.aPagar)}</b></td>
              <td><StatusBadge g={g} today={today} /></td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={compact ? 2 : 3}>Total ({rows.length})</td><td className="num">{money(tot('base'))}</td>{!compact && <td className="num">{money(tot('iva'))}</td>}<td className="num">{money(tot('aPagar'))}</td><td /></tr></tfoot>
      </table>
    </div>
  );
}

/* ---------------------------------- Por pagar ---------------------------------- */

function PayablesTab({ gastos, today, canEdit, onOpen, onDone }: { gastos: Expense[]; today: string; canEdit: boolean; onOpen: (g: Expense) => void; onDone: () => Promise<void> }) {
  const open = gastos.filter((g) => g.estado === 'por_pagar').sort((a, z) => (a.vence ?? '9').localeCompare(z.vence ?? '9'));
  const [sel, setSel] = useState<string[]>([]);
  const [fecha, setFecha] = useState(today);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!open.length) return <div className="adm-empty">No hay cuentas por pagar. Todo está al día.</div>;
  const total = open.filter((g) => sel.includes(g.id)).reduce((t, g) => t + g.aPagar, 0);
  const pay = async () => {
    setBusy(true); setMsg('');
    try {
      if (MUESTRA) throw new Error('En la muestra no se guardan cambios.');
      const n = await (await fb()).adminPayExpenses(sel, fecha);
      setMsg(`${n} gastos marcados como pagados.`); setSel([]); await onDone();
    } catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
  };
  const groups: [string, Expense[]][] = [
    ['Vencidos', open.filter((g) => g.vence && g.vence < today)],
    ['Vencen en los próximos 7 días', open.filter((g) => g.vence && g.vence >= today && Date.parse(g.vence) - Date.parse(today) <= 7 * 86_400_000)],
    ['Más adelante', open.filter((g) => !g.vence || Date.parse(g.vence) - Date.parse(today) > 7 * 86_400_000)],
  ];
  return (
    <div className="adm-grid" style={{ gap: 12 }}>
      {canEdit && (
        <div className="adm-bar">
          <span className="muted" style={{ fontSize: 13.5 }}>{sel.length ? `${sel.length} elegidos · ${money(total)}` : 'Marca los que ya pagaste.'}</span>
          <input className="adm-input" type="date" aria-label="Fecha de pago" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <button type="button" className="adm-btn solid" disabled={!sel.length || busy} onClick={pay}>{busy ? 'Guardando…' : 'Marcar como pagados'}</button>
        </div>
      )}
      {msg && <div className="adm-note" role="status">{msg}</div>}
      {groups.filter(([, l]) => l.length).map(([title, l]) => (
        <div key={title} className="adm-card">
          <h2 style={title === 'Vencidos' ? { color: 'var(--bad)' } : undefined}>{title} · {money(l.reduce((t, g) => t + g.aPagar, 0))}</h2>
          <div className="adm-table-wrap" style={{ marginTop: 10 }}>
            <table className="adm-table">
              <tbody>
                {l.map((g) => (
                  <tr key={g.id} className="click" onClick={() => onOpen(g)}>
                    {canEdit && <td style={{ width: 32 }} onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Elegir ${g.proveedor}`} checked={sel.includes(g.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, g.id] : s.filter((x) => x !== g.id)))} /></td>}
                    <td><b>{g.proveedor}</b><div className="muted" style={{ fontSize: 12.5 }}>{EXPENSE_CATEGORIES[g.categoria]?.label}{g.factura ? ` · ${g.factura}` : ''}</div></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{g.vence ? `Vence ${fmtDay(g.vence)}` : 'Sin fecha'}</td>
                    <td className="num"><b>{money(g.aPagar)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- Ficha / formulario de gasto ---------------------------------- */

const emptyExpense = (today: string): ExpenseInput => ({
  fecha: today, categoria: 'otros', proveedor: '', identificacion: '', factura: '', descripcion: '', base: 0, iva: 0, isd: 0, retRenta: 0, retIva: 0,
  formaPago: 'transferencia', estado: 'pagado', vence: null, recurrente: false, tarjeta: '', pagador: 'empresa', socio: '', exterior: false, liquidacion: false, plataforma: '',
  cubreDesde: today.slice(0, 7), cubreMeses: 1,
});

/** Datos para un cargo de una plataforma del stack (se completan el valor y la fecha). */
export function platformPreset(key: string, today: string): Partial<ExpenseInput> {
  const p = PLATFORMS.find((x) => x.key === key);
  if (!p) return {};
  const cover = p.billing === 'anual' ? 12 : 1;
  // Lo de consumo llega a inicios del mes siguiente: se devenga en el mes anterior.
  const desde = p.billing === 'consumo' ? addMonth(today.slice(0, 7), -1) : today.slice(0, 7);
  return { plataforma: p.key, proveedor: p.name, categoria: p.categoria, exterior: p.exterior, formaPago: 'tarjeta', recurrente: p.billing === 'mensual' || p.billing === 'consumo', cubreMeses: cover, cubreDesde: desde, descripcion: p.what };
}
const addMonth = (m: string, n: number) => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7); };

function ExpenseDrawer({ g, preset, canEdit, today, onClose, onSaved }: { g: Expense | null; preset?: Partial<ExpenseInput> | null; canEdit: boolean; today: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const nomina = g?.origen === 'nomina';
  const [edit, setEdit] = useState(!g);
  const [f, setF] = useState<ExpenseInput>(() => (g ? { ...emptyExpense(today), ...g } : { ...emptyExpense(today), ...preset }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof ExpenseInput>(k: K, v: ExpenseInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const total = r2(Number(f.base) + Number(f.iva) + Number(f.isd));
  const aPagar = r2(total - Number(f.retRenta) - Number(f.retIva));
  const card = f.formaPago === 'tarjeta';
  const applyPreset = (key: string) => setF((x) => ({ ...x, ...platformPreset(key, x.fecha || today) }));

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr('');
    try { if (MUESTRA) throw new Error('En la muestra no se guardan cambios.'); await fn(); await onSaved(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const save = () => run(async () => (await fb()).adminSaveExpense({ ...f, ...(g ? { id: g.id } : {}) }));
  const pay = () => run(async () => g && (await fb()).adminPayExpenses([g.id]));
  const del = () => { if (g && window.confirm(`¿Borrar el gasto de ${g.proveedor} por ${money(g.total)}?`)) run(async () => (await fb()).adminDeleteExpense(g.id)); };

  if (g && !edit) {
    const c = EXPENSE_CATEGORIES[g.categoria];
    const slices = expenseSlices(g).filter((s) => !s.isd);
    return (
      <Drawer title={g.proveedor} sub={`${c?.label ?? g.categoria} · cuenta ${c?.code ?? ''}`} onClose={onClose}>
        <div className="adm-grid" style={{ gap: 14 }}>
          <div className="adm-bar">
            <StatusBadge g={g} today={today} />{g.recurrente && <Badge tone="t-mute">Gasto fijo mensual</Badge>}{nomina && <Badge tone="t-info">Generado por el rol de pagos</Badge>}
            {g.exterior && <Badge tone="t-warm">Exterior</Badge>}{g.exterior && !g.liquidacion && <Badge tone="t-bad">Falta liquidación de compra</Badge>}
          </div>
          <dl className="adm-kv">
            <dt>Fecha del comprobante o del cargo</dt><dd>{fmtDay(g.fecha)}</dd>
            {g.identificacion && <><dt>RUC / cédula</dt><dd>{g.identificacion}</dd></>}
            {g.factura && <><dt>Nº comprobante</dt><dd>{g.factura}</dd></>}
            <dt>Base (gasto)</dt><dd>{money(g.base)}</dd>
            <dt>{g.exterior ? 'IVA cobrado por la tarjeta' : 'IVA'} (crédito tributario)</dt><dd>{money(g.iva)}</dd>
            {g.isd > 0 && <><dt>ISD 5 % (gasto)</dt><dd>{money(g.isd)}</dd></>}
            <dt>Total</dt><dd>{money(g.total)}</dd>
            {(g.retRenta > 0 || g.retIva > 0) && <><dt>Retenciones (renta + IVA)</dt><dd>-{money(g.retRenta + g.retIva)}</dd></>}
            <dt style={{ fontWeight: 800 }}>{g.formaPago === 'tarjeta' ? 'Cargado a la tarjeta' : 'A pagar al proveedor'}</dt><dd className="big">{money(g.aPagar)}</dd>
            <dt>Forma de pago</dt><dd>{EXPENSE_PAY_LABEL[g.formaPago] ?? g.formaPago}{g.tarjeta ? ` · ${g.tarjeta}` : ''}</dd>
            {g.pagador === 'socio' && <><dt>Lo pagó</dt><dd>{g.socio} (se le reembolsa)</dd></>}
            {g.vence && <><dt>Vence</dt><dd>{fmtDay(g.vence)}</dd></>}
            {g.pagadoEl && g.formaPago !== 'tarjeta' && <><dt>Pagado el</dt><dd>{fmtDay(g.pagadoEl)}</dd></>}
            <dt>Se devenga en</dt><dd>{slices.length === 1 ? monthLabel(slices[0].mes) : `${monthLabel(slices[0].mes)} – ${monthLabel(slices[slices.length - 1].mes)} (${money(slices[0].monto)} al mes)`}</dd>
            {g.creadoPor && <><dt>Registrado por</dt><dd style={{ fontWeight: 400 }}>{g.creadoPor}</dd></>}
          </dl>
          {g.descripcion && <p style={{ margin: 0, fontSize: 14 }}>{g.descripcion}</p>}
          {err && <div className="adm-err" role="alert">{err}</div>}
          {canEdit && !nomina && (
            <div className="adm-bar">
              {g.estado === 'por_pagar' && <button type="button" className="adm-btn solid" disabled={busy} onClick={pay}>Marcar pagado hoy</button>}
              <button type="button" className="adm-btn" disabled={busy} onClick={() => setEdit(true)}>Editar</button>
              <button type="button" className="adm-btn" disabled={busy} onClick={del} style={{ color: 'var(--bad)' }}>Borrar</button>
            </div>
          )}
          {nomina && <p className="muted" style={{ fontSize: 13, margin: 0 }}>Para cambiarlo, reabre el rol de pagos de ese mes.</p>}
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer title={g ? 'Editar gasto' : 'Registrar gasto'} sub="Escribe los valores del comprobante o del cargo en el estado de cuenta de la tarjeta." onClose={onClose}>
      <form className="adm-grid" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
        {!g && (
          <div className="adm-grid" style={{ gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>¿Es una plataforma de HULUL? Tócala y se llena sola:</span>
            <div className="adm-bar" style={{ gap: 6 }}>
              {PLATFORMS.map((p) => <button key={p.key} type="button" className="adm-chip" aria-pressed={f.plataforma === p.key} onClick={() => applyPreset(p.key)}>{p.name.split(' ·')[0].replace(' (Anthropic)', '')}</button>)}
            </div>
          </div>
        )}
        <div className="adm-grid g-2" style={{ gap: 10 }}>
          <label className="adm-field">Fecha del comprobante o del cargo<input className="adm-input" type="date" required value={f.fecha} onChange={(e) => set('fecha', e.target.value)} /></label>
          <label className="adm-field">Categoría
            <select className="adm-select" value={f.categoria} onChange={(e) => set('categoria', e.target.value)}>
              {EXPENSE_GROUPS.filter((gr) => gr.key !== 'nomina').map((gr) => (
                <optgroup key={gr.key} label={gr.label}>
                  {MANUAL_EXPENSE_CATEGORIES.filter((k) => EXPENSE_CATEGORIES[k].group === gr.key).map((k) => <option key={k} value={k}>{EXPENSE_CATEGORIES[k].label} ({EXPENSE_CATEGORIES[k].code})</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
        <label className="adm-field">Proveedor o beneficiario<input className="adm-input" required minLength={2} value={f.proveedor} onChange={(e) => set('proveedor', e.target.value)} placeholder="Ej.: Vercel, Inmobiliaria Kennedy S.A." /></label>
        <div className="adm-grid g-2" style={{ gap: 10 }}>
          <label className="adm-field">{f.exterior ? 'Nº de liquidación de compra' : 'Nº de comprobante'}<input className="adm-input" value={f.factura} onChange={(e) => set('factura', e.target.value)} placeholder="001-001-000000123" /></label>
          <label className="adm-field">RUC o cédula<input className="adm-input" inputMode="numeric" value={f.identificacion} onChange={(e) => set('identificacion', e.target.value)} placeholder={f.exterior ? 'No aplica (exterior)' : 'Para el ATS'} /></label>
        </div>
        <label className="adm-field">Detalle<input className="adm-input" value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} placeholder="Qué se compró o pagó" /></label>

        <div className="adm-grid g-2" style={{ gap: 10 }}>
          <label className="adm-field">Forma de pago
            <select className="adm-select" value={f.formaPago} onChange={(e) => set('formaPago', e.target.value)}>{Object.entries(EXPENSE_PAY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          {card ? (
            <label className="adm-field">¿De quién es la tarjeta?
              <select className="adm-select" value={f.pagador} onChange={(e) => set('pagador', e.target.value as Expense['pagador'])}><option value="empresa">De la empresa</option><option value="socio">Personal de un socio (se le reembolsa)</option></select>
            </label>
          ) : (
            <label className="adm-field">Estado
              <select className="adm-select" value={f.estado} onChange={(e) => set('estado', e.target.value as Expense['estado'])}><option value="pagado">Ya está pagado</option><option value="por_pagar">Por pagar</option></select>
            </label>
          )}
          {card && f.pagador === 'empresa' && <label className="adm-field">Tarjeta<input className="adm-input" value={f.tarjeta} onChange={(e) => set('tarjeta', e.target.value)} placeholder="Ej.: Visa Pacífico ••1234" /></label>}
          {f.pagador === 'socio' && card && <label className="adm-field">Socio<input className="adm-input" required value={f.socio} onChange={(e) => set('socio', e.target.value)} placeholder="Socio 1, Socio 2…" /></label>}
          {!card && f.estado === 'por_pagar' && <label className="adm-field">Vence<input className="adm-input" type="date" required value={f.vence ?? ''} onChange={(e) => set('vence', e.target.value || null)} /></label>}
        </div>
        <label className="adm-toggle"><input type="checkbox" checked={f.exterior} onChange={(e) => set('exterior', e.target.checked)} /> Servicio del exterior (Google, Vercel, Anthropic, Apple, Meta…)</label>

        <div className="adm-grid g-2" style={{ gap: 10 }}>
          <label className="adm-field">Valor sin IVA (base)<NumInput required value={f.base} onChange={(n) => set('base', n ?? 0)} /></label>
          <label className="adm-field">{f.exterior ? 'IVA cobrado por la tarjeta' : 'IVA'}
            <span className="row gap-8"><NumInput value={f.iva} onChange={(n) => set('iva', n ?? 0)} />
              <button type="button" className="adm-btn" onClick={() => set('iva', r2(Number(f.base) * 0.15))}>15 %</button>
              <button type="button" className="adm-btn" onClick={() => set('iva', 0)}>0 %</button></span>
          </label>
          {f.exterior ? (
            <label className="adm-field">ISD (si el banco lo cobró)
              <span className="row gap-8"><NumInput value={f.isd} onChange={(n) => set('isd', n ?? 0)} placeholder="0,00" />
                <button type="button" className="adm-btn" onClick={() => set('isd', r2(Number(f.base) * ISD_RATE))}>5 %</button></span>
            </label>
          ) : (
            <>
              <label className="adm-field">Retención de renta<NumInput value={f.retRenta} onChange={(n) => set('retRenta', n ?? 0)} placeholder="0,00" /></label>
              <label className="adm-field">Retención de IVA<NumInput value={f.retIva} onChange={(n) => set('retIva', n ?? 0)} placeholder="0,00" /></label>
            </>
          )}
        </div>
        {f.exterior && (
          <label className="adm-toggle"><input type="checkbox" checked={f.liquidacion} onChange={(e) => set('liquidacion', e.target.checked)} /> Ya se emitió la liquidación de compra (sustenta el gasto y el crédito de IVA ante el SRI)</label>
        )}
        <dl className="adm-kv"><dt>Total</dt><dd>{money(total)}</dd><dt style={{ fontWeight: 800 }}>{card ? 'Cargado a la tarjeta' : 'A pagar al proveedor'}</dt><dd className="big">{money(aPagar)}</dd></dl>

        <fieldset className="adm-card" style={{ padding: 12, display: 'grid', gap: 10 }}>
          <legend style={{ fontWeight: 800, fontSize: 13.5, padding: '0 4px' }}>Devengado: ¿a qué mes corresponde el gasto?</legend>
          <div className="adm-grid g-2" style={{ gap: 10 }}>
            <label className="adm-field">Desde el mes<input className="adm-input" type="month" required value={f.cubreDesde} onChange={(e) => set('cubreDesde', e.target.value)} /></label>
            <label className="adm-field">Cuántos meses cubre
              <select className="adm-select" value={f.cubreMeses} onChange={(e) => set('cubreMeses', Number(e.target.value))}>{[1, 2, 3, 6, 12, 24, 36].map((n) => <option key={n} value={n}>{n === 1 ? 'Solo ese mes' : `${n} meses`}</option>)}</select>
            </label>
          </div>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {f.cubreMeses > 1 ? `Se reconocen ${money(r2(Number(f.base) / f.cubreMeses))} cada mes; el resto queda como pagado por anticipado.` : f.cubreDesde < f.fecha.slice(0, 7) ? 'Corresponde a un mes anterior al cargo (p. ej. el consumo de la nube de octubre que se cobra en noviembre): se registra en ese mes.' : 'Se reconoce completo en ese mes.'}
          </span>
        </fieldset>
        <label className="adm-toggle"><input type="checkbox" checked={f.recurrente} onChange={(e) => set('recurrente', e.target.checked)} /> Gasto fijo mensual: se puede copiar al mes siguiente con un clic</label>
        {err && <div className="adm-err" role="alert">{err}</div>}
        <div className="adm-bar">
          <button type="submit" className="adm-btn solid" disabled={busy}>{busy ? 'Guardando…' : 'Guardar gasto'}</button>
          <button type="button" className="adm-btn" onClick={() => (g ? setEdit(false) : onClose())}>Cancelar</button>
        </div>
      </form>
    </Drawer>
  );

}

/* ---------------------------------- Rol de pagos ---------------------------------- */

const PAYROLL_COLUMNS: { key: keyof PayrollLine; header: string }[] = [
  { key: 'dias', header: 'Días' }, { key: 'sueldo', header: 'Sueldo' }, { key: 'extras', header: 'Horas extra' }, { key: 'bonos', header: 'Bonos' }, { key: 'ingresos', header: 'Total ingresos' },
  { key: 'aportePersonal', header: 'Aporte IESS 9,45 %' }, { key: 'anticipos', header: 'Anticipos' }, { key: 'otrosDescuentos', header: 'Otros descuentos' },
  { key: 'decimosEnRol', header: 'Décimos en rol' }, { key: 'fondoEnRol', header: 'Fondos de reserva en rol' }, { key: 'neto', header: 'Neto a recibir' },
  { key: 'patronal', header: 'Aporte patronal 11,15 %' }, { key: 'iece', header: 'IECE 0,5 %' }, { key: 'secap', header: 'SECAP 0,5 %' }, { key: 'decimo13', header: 'Provisión 13.º' }, { key: 'decimo14', header: 'Provisión 14.º' },
  { key: 'fondo', header: 'Fondos de reserva' }, { key: 'vacaciones', header: 'Provisión vacaciones' }, { key: 'costo', header: 'Costo empresa' },
];

function payrollSheet(r: Payroll): import('../excel').SheetSpec {
  return {
    name: `Rol ${r.mes}`, title: [...HEAD, `Rol de pagos de ${monthLabel(r.mes)} · ${r.status === 'aprobado' ? `aprobado por ${r.aprobadoPor ?? ''}` : 'BORRADOR'}`],
    columns: [{ key: 'nombre', header: 'Empleado', width: 28 }, { key: 'cedula', header: 'Cédula', text: true, width: 13 }, { key: 'cargo', header: 'Cargo', width: 22 },
      ...PAYROLL_COLUMNS.map((c) => ({ key: c.key, header: c.header, money: c.key !== 'dias' }))],
    rows: r.lines as unknown as Row[], totals: PAYROLL_COLUMNS.filter((c) => c.key !== 'dias' && c.key !== 'sueldo').map((c) => c.key),
  };
}

function nextMonths(base: string, n: number) {
  const [y, m] = base.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(y, m - 1 - i + 1, 1)); return d.toISOString().slice(0, 7); });
}

function PayrollTab({ data, month, canEdit, onDone }: { data: ExpensesData; month: string; canEdit: boolean; onDone: () => Promise<void> }) {
  const months = nextMonths(month, 7);
  const [mes, setMes] = useState(month);
  const saved = data.roles.find((r) => r.mes === mes) ?? null;
  const active = data.empleados.filter((e) => e.activo && e.ingreso <= `${mes}-31`);
  const [adj, setAdj] = useState<Record<string, PayrollAdjust>>({});
  const [result, setResult] = useState<Payroll | null>(saved);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { setResult(data.roles.find((r) => r.mes === mes) ?? null); setAdj({}); setMsg(''); }, [mes, data]);
  const approved = result?.status === 'aprobado';
  const setA = (id: string, k: keyof PayrollAdjust, v: number | undefined) => setAdj((a) => ({ ...a, [id]: { ...a[id], [k]: v } }));
  const adjOf = (id: string): PayrollAdjust => ({ ...(result?.lines.find((l) => l.empleadoId === id) ? (() => { const l = result!.lines.find((x) => x.empleadoId === id)!; return { dias: l.dias, extras: l.extras, bonos: l.bonos, anticipos: l.anticipos, otrosDescuentos: l.otrosDescuentos }; })() : {}), ...adj[id] });

  const act = async (accion: 'calcular' | 'aprobar' | 'reabrir') => {
    if (accion === 'aprobar' && !window.confirm(`¿Aprobar el rol de ${monthLabel(mes)}? Se registran los gastos de nómina en la contabilidad.`)) return;
    setBusy(accion); setMsg('');
    try {
      if (MUESTRA) throw new Error('En la muestra no se guardan cambios.');
      const ajustes = Object.fromEntries(active.map((e) => [e.id, adjOf(e.id)]));
      const r = await (await fb()).adminPayroll(mes, accion, accion === 'reabrir' ? undefined : ajustes);
      setMsg(accion === 'aprobar' ? 'Rol aprobado: los gastos de nómina ya están en la contabilidad.' : accion === 'reabrir' ? 'Rol reabierto: puedes corregirlo y volver a aprobarlo.' : 'Calculado y guardado como borrador.');
      if (r.lines && r.totals) setResult({ mes, status: r.status, lines: r.lines, totals: r.totals });
      await onDone();
    } catch (e) { setMsg(errMsg(e)); } finally { setBusy(''); }
  };
  const download = async () => { if (!result) return; const { downloadXlsx } = await import('../excel'); await downloadXlsx(`hulul-rol-de-pagos-${mes}.xlsx`, [payrollSheet(result)]); };
  const [y, m] = mes.split('-').map(Number);
  const iessDue = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-15`;

  return (
    <div className="adm-grid" style={{ gap: 12 }}>
      <div className="adm-bar">
        {months.map((x) => <button key={x} type="button" className="adm-chip" aria-pressed={mes === x} onClick={() => setMes(x)}>{monthLabel(x)}{data.roles.find((r) => r.mes === x)?.status === 'aprobado' ? ' ✓' : ''}</button>)}
      </div>
      {!canEdit && !result && <div className="adm-empty">Aún no hay rol de pagos para {monthLabel(mes)}.</div>}
      {canEdit && !active.length && <div className="adm-note">No hay empleados activos en {monthLabel(mes)}. Agrégalos en la pestaña «Empleados».</div>}
      {result && (
        <div className="adm-kpis">
          <Kpi accent label="Neto a pagar a empleados" value={money(result.totals.neto)} hint={`${result.lines.length} ${result.lines.length === 1 ? 'persona' : 'personas'}`} />
          <Kpi label="Planilla del IESS" value={money(result.totals.alIess)} hint={`Aportes, IECE y SECAP · pagar hasta ${fmtDay(iessDue)}`} />
          <Kpi label="Provisión de beneficios" value={money(r2(result.totals.decimo13 + result.totals.decimo14 - result.totals.decimosEnRol + result.totals.vacaciones))} hint="13.º, 14.º y vacaciones por pagar" />
          <Kpi label="Costo total para la empresa" value={money(result.totals.costo)} hint={approved ? 'Ya está en la contabilidad' : 'Borrador: aún no entra a la contabilidad'} />
        </div>
      )}
      {(active.length > 0 || result) && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Empleado</th>{canEdit && !approved && <><th>Días</th><th>Extras</th><th>Bonos</th><th>Anticipos</th><th>Otros desc.</th></>}<th className="num">Ingresos</th><th className="num">IESS 9,45 %</th><th className="num">Neto</th><th className="num">Costo empresa</th></tr></thead>
            <tbody>
              {(canEdit && !approved ? active.map((e) => ({ e, l: result?.lines.find((x) => x.empleadoId === e.id) })) : (result?.lines ?? []).map((l) => ({ e: null as Employee | null, l }))).map(({ e, l }) => {
                const id = e?.id ?? l!.empleadoId; const a = adjOf(id);
                return (
                  <tr key={id}>
                    <td><b>{e?.nombre ?? l?.nombre}</b><div className="muted" style={{ fontSize: 12.5 }}>{e?.cargo ?? l?.cargo} · {money(e?.sueldo ?? l?.sueldo ?? 0)}</div></td>
                    {canEdit && !approved && (['dias', 'extras', 'bonos', 'anticipos', 'otrosDescuentos'] as (keyof PayrollAdjust)[]).map((k) => (
                      <td key={k}><NumInput style={{ width: k === 'dias' ? 56 : 82 }} aria-label={k} placeholder={k === 'dias' ? '30' : '0'} value={a[k]} onChange={(n) => setA(id, k, n)} /></td>
                    ))}
                    <td className="num">{l ? money(l.ingresos) : '—'}</td><td className="num">{l ? money(l.aportePersonal) : '—'}</td><td className="num"><b>{l ? money(l.neto) : '—'}</b></td><td className="num">{l ? money(l.costo) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {msg && <div className="adm-note" role="status">{msg}</div>}
      <div className="adm-bar">
        {canEdit && !approved && active.length > 0 && <button type="button" className="adm-btn" disabled={!!busy} onClick={() => act('calcular')}>{busy === 'calcular' ? 'Calculando…' : 'Calcular y guardar borrador'}</button>}
        {canEdit && !approved && result && <button type="button" className="adm-btn solid" disabled={!!busy || Object.keys(adj).length > 0} title={Object.keys(adj).length ? 'Primero calcula con los cambios' : undefined} onClick={() => act('aprobar')}>{busy === 'aprobar' ? 'Aprobando…' : 'Aprobar rol'}</button>}
        {canEdit && approved && <button type="button" className="adm-btn" disabled={!!busy} onClick={() => act('reabrir')}>{busy === 'reabrir' ? 'Reabriendo…' : 'Reabrir para corregir'}</button>}
        {result && <button type="button" className="adm-btn" onClick={download}>Descargar rol en Excel</button>}
      </div>
      <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
        Parámetros 2026: salario básico {money(data.params.sbu)}, aporte personal {pct2(data.params.aportePersonal)}, patronal {pct2(data.params.aportePatronal)} + IECE y SECAP de 0,5 % cada uno, fondos de reserva {pct2(data.params.fondoReserva)} desde el mes 13.
        Los décimos y fondos se pagan en el rol solo si el empleado lo pidió (ficha del empleado). Confírmalos con la contadora.
      </p>
    </div>
  );
}

/* ---------------------------------- Empleados ---------------------------------- */

const emptyEmployee = (): EmployeeInput => ({ nombre: '', cedula: '', cargo: '', correo: '', cuenta: '', sueldo: 482, ingreso: '', activo: true, decimosMensuales: false, fondoMensual: false });

function EmployeesTab({ empleados, sbu, onDone }: { empleados: Employee[]; sbu: number; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState<EmployeeInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof EmployeeInput>(k: K, v: EmployeeInput[K]) => setOpen((x) => (x ? { ...x, [k]: v } : x));
  const save = async () => {
    if (!open) return;
    setBusy(true); setErr('');
    try { if (MUESTRA) throw new Error('En la muestra no se guardan cambios.'); await (await fb()).adminSaveEmployee(open); setOpen(null); await onDone(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const sorted = [...empleados].sort((a, z) => Number(z.activo) - Number(a.activo) || a.nombre.localeCompare(z.nombre));
  return (
    <div className="adm-grid" style={{ gap: 12 }}>
      <div className="adm-bar"><button type="button" className="adm-btn solid" onClick={() => { setErr(''); setOpen(emptyEmployee()); }}>+ Agregar empleado</button>
        <span className="muted" style={{ fontSize: 13 }}>Solo personal en relación de dependencia. Los freelancers y profesionales con factura van como gasto en «Subcontratos» u «Honorarios».</span></div>
      {!sorted.length ? <div className="adm-empty">Aún no hay empleados registrados.</div> : (
        <div className="adm-cards">
          {sorted.map((e) => (
            <button key={e.id} type="button" className="adm-card" style={{ textAlign: 'left', cursor: 'pointer', opacity: e.activo ? 1 : .6 }} onClick={() => { setErr(''); setOpen({ ...e }); }}>
              <h3>{e.nombre}</h3>
              <div className="muted" style={{ fontSize: 13 }}>{e.cargo || 'Sin cargo'} · desde {fmtDay(e.ingreso)}</div>
              <div className="adm-bar" style={{ marginTop: 8 }}>
                <b>{money(e.sueldo)}</b>
                {!e.activo && <Badge tone="t-mute">Inactivo</Badge>}
                {e.sueldo < sbu && <Badge tone="t-bad">Bajo el salario básico</Badge>}
                {e.decimosMensuales && <Badge tone="t-info">Décimos mensuales</Badge>}
                {e.fondoMensual && <Badge tone="t-info">Fondos en rol</Badge>}
              </div>
            </button>
          ))}
        </div>
      )}
      {open && (
        <Drawer title={open.id ? open.nombre : 'Nuevo empleado'} sub="Datos para el rol de pagos y la planilla del IESS." onClose={() => setOpen(null)}>
          <form className="adm-grid" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
            <label className="adm-field">Nombre completo<input className="adm-input" required value={open.nombre} onChange={(e) => set('nombre', e.target.value)} /></label>
            <div className="adm-grid g-2" style={{ gap: 10 }}>
              <label className="adm-field">Cédula<input className="adm-input" required inputMode="numeric" maxLength={10} value={open.cedula} onChange={(e) => set('cedula', e.target.value)} /></label>
              <label className="adm-field">Cargo<input className="adm-input" value={open.cargo} onChange={(e) => set('cargo', e.target.value)} /></label>
              <label className="adm-field">Sueldo mensual<NumInput required value={open.sueldo} onChange={(n) => set('sueldo', n ?? 0)} /></label>
              <label className="adm-field">Fecha de ingreso<input className="adm-input" type="date" required value={open.ingreso} onChange={(e) => set('ingreso', e.target.value)} /></label>
              <label className="adm-field">Correo<input className="adm-input" type="email" value={open.correo} onChange={(e) => set('correo', e.target.value)} /></label>
              <label className="adm-field">Cuenta bancaria<input className="adm-input" value={open.cuenta} onChange={(e) => set('cuenta', e.target.value)} placeholder="Banco, tipo y número" /></label>
            </div>
            {open.sueldo > 0 && open.sueldo < sbu && <div className="adm-err">El sueldo es menor al salario básico ({money(sbu)}). Solo es válido si trabaja a tiempo parcial.</div>}
            <label className="adm-toggle"><input type="checkbox" checked={open.decimosMensuales} onChange={(e) => set('decimosMensuales', e.target.checked)} /> Pidió recibir el 13.º y 14.º sueldo cada mes</label>
            <label className="adm-toggle"><input type="checkbox" checked={open.fondoMensual} onChange={(e) => set('fondoMensual', e.target.checked)} /> Pidió recibir los fondos de reserva en el rol (si no, van al IESS)</label>
            <label className="adm-toggle"><input type="checkbox" checked={open.activo} onChange={(e) => set('activo', e.target.checked)} /> Activo (si sale de la empresa, desmárcalo)</label>
            {err && <div className="adm-err" role="alert">{err}</div>}
            <div className="adm-bar"><button type="submit" className="adm-btn solid" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button><button type="button" className="adm-btn" onClick={() => setOpen(null)}>Cancelar</button></div>
          </form>
        </Drawer>
      )}
    </div>
  );
}

/** Campo de dinero: deja escribir «12,» o «12.5» sin perder lo tecleado; entrega el número. */
function NumInput({ value, onChange, ...rest }: { value: number | undefined; onChange: (n: number | undefined) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState(value === undefined || value === 0 ? '' : String(value).replace('.', ','));
  useEffect(() => {
    const cur = text === '' ? undefined : Number(text.replace(',', '.'));
    if (cur !== value && !(cur === undefined && !value)) setText(value === undefined || value === 0 ? '' : String(value).replace('.', ','));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <input {...rest} className="adm-input" inputMode="decimal" value={text} onChange={(e) => {
    const t = e.target.value.replace(/[^\d.,]/g, ''); setText(t);
    const n = Number(t.replace(',', '.')); onChange(t === '' ? undefined : Number.isFinite(n) ? n : undefined);
  }} />;
}

/* ---------------------------------- Plataformas (stack) ---------------------------------- */

function PlatformsTab({ gastos, now, canEdit, onAdd, onList }: { gastos: Expense[]; now: number; canEdit: boolean; onAdd: (key: string) => void; onList: (title: string, ids: string[]) => void }) {
  const rows = useMemo(() => platformCosts(gastos, now), [gastos, now]);
  const months = rows[0]?.months.map((m) => m.mes) ?? [];
  const totals = months.map((mes) => r2(rows.reduce((t, r) => t + (r.months.find((m) => m.mes === mes)?.monto ?? 0), 0)));
  const cs = useMemo(() => cardStatus(gastos, [], now), [gastos, now]);
  const short = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('es-EC', { timeZone: 'UTC', month: 'short', year: '2-digit' });
  return (
    <div className="adm-grid" style={{ gap: 12 }}>
      <div className="adm-note">
        Todo lo que hace funcionar HULUL se registra como gasto <b>devengado</b>, mes a mes: la nube y la IA por consumo van al mes en que se usaron (aunque la tarjeta lo cobre al mes siguiente) y lo anual (Apple, dominios) se reparte en 12 meses.
        Para que el SRI acepte el gasto y el crédito de IVA de un servicio del exterior hay que emitir una <b>liquidación de compra</b>; el estado de cuenta de la tarjeta es el comprobante de retención del IVA.
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>Servicio</th><th>Cobro</th>{months.map((m) => <th key={m} className="num">{short(m)}</th>)}{canEdit && <th />}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td><b>{r.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{r.what}</div>{r.missing.length > 0 && <Badge tone="t-bad">Falta {r.missing.map(short).join(', ')}</Badge>}</td>
                <td style={{ fontSize: 12.5 }}>{BILLING_LABEL[r.billing]}</td>
                {r.months.map((m) => (
                  <td key={m.mes} className="num" style={{ cursor: m.ids.length ? 'pointer' : 'default', color: m.monto ? undefined : r.missing.includes(m.mes) ? 'var(--bad)' : 'var(--muted)' }}
                    onClick={() => m.ids.length && onList(`${r.name} · ${monthLabel(m.mes)}`, m.ids)}>{m.monto ? money(m.monto) : r.missing.includes(m.mes) ? 'falta' : '—'}</td>
                ))}
                {canEdit && <td><button type="button" className="adm-btn" onClick={() => onAdd(r.key)}>+ Cargo</button></td>}
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={2}>Costo de la plataforma</td>{totals.map((t, i) => <td key={months[i]} className="num">{money(t)}</td>)}{canEdit && <td />}</tr></tfoot>
        </table>
      </div>
      <div className="adm-kpis">
        <Kpi label="Consumos en el exterior este año" value={money(cs.exteriorAnio)} hint={`Exento de ISD hasta ${money(ISD_EXEMPT_2026)} al año; sobre eso, 5 %.`} />
        <Kpi label="Sin liquidación de compra" value={cs.sinLiquidacion.ids.length} hint={cs.sinLiquidacion.ids.length ? `${money(cs.sinLiquidacion.total)} sin sustento ante el SRI` : 'Todo sustentado'} onClick={() => cs.sinLiquidacion.ids.length && onList('Cargos del exterior sin liquidación de compra', cs.sinLiquidacion.ids)} />
      </div>
    </div>
  );
}

/* ---------------------------------- Tarjeta de crédito ---------------------------------- */

function CardTab({ data, now, canEdit, onList, onDone }: { data: ExpensesData; now: number; canEdit: boolean; onList: (title: string, ids: string[]) => void; onDone: () => Promise<void> }) {
  const pagos = data.pagosTarjeta ?? [];
  const cs = useMemo(() => cardStatus(data.gastos, pagos, now), [data.gastos, pagos, now]);
  const invested = useMemo(() => {
    const l = data.gastos.filter((g) => g.formaPago === 'tarjeta');
    return { total: r2(l.reduce((t, g) => t + g.total, 0)), count: l.length, ids: l.map((g) => g.id), first: l.map((g) => g.fecha).sort()[0] ?? '' };
  }, [data.gastos]);
  const today = ecDate(now);
  const [f, setF] = useState<{ fecha: string; monto: number | undefined; tarjeta: string; referencia: string; tipo: 'tarjeta' | 'reembolso'; socio: string }>({ fecha: today, monto: undefined, tarjeta: '', referencia: '', tipo: 'tarjeta', socio: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const save = async () => {
    setBusy(true); setMsg('');
    try {
      if (MUESTRA) throw new Error('En la muestra no se guardan cambios.');
      await (await fb()).adminCardPayment({ ...f, monto: f.monto ?? 0 });
      setMsg(f.tipo === 'reembolso' ? `Reembolso a ${f.socio} registrado.` : 'Pago de la tarjeta registrado.'); setF({ ...f, monto: undefined, referencia: '' }); await onDone();
    } catch (e) { setMsg(errMsg(e)); } finally { setBusy(false); }
  };
  const del = async (id: string) => {
    if (!window.confirm('¿Borrar este pago de la tarjeta?')) return;
    try { if (MUESTRA) throw new Error('En la muestra no se guardan cambios.'); await (await fb()).adminDeleteCardPayment(id); await onDone(); } catch (e) { setMsg(errMsg(e)); }
  };
  return (
    <div className="adm-grid" style={{ gap: 12 }}>
      <div className="adm-kpis">
        <Kpi accent label="Deuda de la tarjeta hoy" value={money(cs.saldo)} hint="Cargos registrados − pagos del estado de cuenta" />
        <Kpi label="Total invertido con tarjeta" value={money(invested.total)} hint={invested.first ? `Desde ${fmtDay(invested.first)} · ${invested.count} cargos (empresa y socios)` : 'Aún sin cargos'} onClick={() => invested.ids.length && onList('Todo lo invertido con tarjeta', invested.ids)} />
        <Kpi label="Cargos a la tarjeta" value={money(cs.cargos)} hint="Todo lo cargado a tarjetas de la empresa" onClick={() => onList('Cargos a la tarjeta de la empresa', cs.cargosIds)} />
        <Kpi label="Pagos de la tarjeta" value={money(cs.pagos)} hint={`${pagos.filter((p) => p.tipo !== 'reembolso').length} pagos registrados`} />
        {cs.socios.map((s) => <Kpi key={s.nombre} label={`Se le debe a ${s.nombre}`} value={money(s.total)} hint={canEdit ? 'Toca para registrar el reembolso' : 'Pagado con su tarjeta o dinero personal'} onClick={() => (canEdit ? setF({ ...f, tipo: 'reembolso', socio: s.nombre, monto: s.total }) : onList(`Gastos pagados por ${s.nombre}`, s.ids))} />)}
      </div>
      <div className="adm-note">Cada cargo es gasto del mes que corresponde (devengado) y deuda con la tarjeta; cuando pagas el estado de cuenta, registra el pago aquí y la deuda baja. Lo que cuadra con el banco es el pago, no cada cargo.</div>
      {canEdit && (
        <form className="adm-card adm-grid" style={{ gap: 10 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div className="adm-bar" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>{f.tipo === 'reembolso' ? `Reembolso a ${f.socio || 'un socio'}` : 'Registrar pago del estado de cuenta'}</h2>
            <span className="adm-bar"><button type="button" className="adm-chip" aria-pressed={f.tipo === 'tarjeta'} onClick={() => setF({ ...f, tipo: 'tarjeta' })}>Pago de la tarjeta</button><button type="button" className="adm-chip" aria-pressed={f.tipo === 'reembolso'} onClick={() => setF({ ...f, tipo: 'reembolso' })}>Reembolso a un socio</button></span>
          </div>
          <div className="adm-grid g-2" style={{ gap: 10 }}>
            <label className="adm-field">Fecha del pago<input className="adm-input" type="date" required value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></label>
            <label className="adm-field">Monto pagado<NumInput required value={f.monto} onChange={(n) => setF({ ...f, monto: n })} /></label>
            {f.tipo === 'reembolso'
              ? <label className="adm-field">Socio<input className="adm-input" required value={f.socio} onChange={(e) => setF({ ...f, socio: e.target.value })} placeholder="Socio 1" /></label>
              : <label className="adm-field">Tarjeta<input className="adm-input" value={f.tarjeta} onChange={(e) => setF({ ...f, tarjeta: e.target.value })} placeholder="Visa Pacífico ••1234" /></label>}
            <label className="adm-field">Referencia<input className="adm-input" value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} placeholder="Nº de comprobante del banco" /></label>
          </div>
          {msg && <div className="adm-note" role="status">{msg}</div>}
          <div className="adm-bar"><button type="submit" className="adm-btn solid" disabled={busy}>{busy ? 'Guardando…' : f.tipo === 'reembolso' ? 'Registrar reembolso' : 'Registrar pago'}</button>{f.tipo === 'tarjeta' && cs.saldo > 0 && <button type="button" className="adm-btn" onClick={() => setF({ ...f, monto: cs.saldo })}>Pagar todo ({money(cs.saldo)})</button>}</div>
        </form>
      )}
      {pagos.length > 0 && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Fecha</th><th>Tarjeta o socio</th><th>Referencia</th><th className="num">Monto</th>{canEdit && <th />}</tr></thead>
            <tbody>{[...pagos].sort((a, z) => z.fecha.localeCompare(a.fecha)).map((p) => (
              <tr key={p.id}><td>{fmtDay(p.fecha)}</td><td>{p.tipo === 'reembolso' ? `Reembolso a ${p.socio}` : p.tarjeta || 'Pago de la tarjeta'}</td><td>{p.referencia || '—'}</td><td className="num"><b>{money(p.monto)}</b></td>{canEdit && <td><button type="button" className="adm-btn" onClick={() => del(p.id)}>Borrar</button></td>}</tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
