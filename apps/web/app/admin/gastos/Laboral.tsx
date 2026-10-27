'use client';

import { Fragment, useMemo, useState } from 'react';
import {
  ecDate, EXIT_LABEL, incomeStatement, laborChecklist, profitSharing, settlement,
  type DashLedger, type Employee, type ExitReason, type LaborItem, type Settlement,
} from '@hulul/shared/dashboard';
import type { EmployeeInput, ExpensesData } from '@hulul/shared/firebase';
import { MUESTRA } from '../AdminShell';
import { Badge, Drawer, fmtDay, Kpi, money } from '../ui';
import { NumInput } from './NumInput';

/**
 * Lo laboral del panel de gastos: empleados (con cargas, gastos personales y salida con finiquito),
 * utilidades del 15 % y los documentos que piden el Ministerio del Trabajo, el IESS y el SRI.
 */
const HEAD = ['CORPORACIÓN COFFEEPORT CÍA. LTDA. — HULUL', 'RUC 0993265160001'];
const fb = () => import('@hulul/shared/firebase');
const errMsg = (e: unknown) => ((e as { message?: string }).message || 'No se pudo completar.').replace(/\s*\[\d{3}\]\s*$/, '');
const noSample = () => { if (MUESTRA) throw new Error('En la muestra no se guardan cambios.'); };
type Row = Record<string, string | number | null | undefined>;

/* ---------------------------------- Empleados ---------------------------------- */

const emptyEmployee = (): EmployeeInput => ({
  nombre: '', cedula: '', cargo: '', correo: '', cuenta: '', sueldo: 482, ingreso: '', activo: true, decimosMensuales: false, fondoMensual: false,
  cargasUtilidades: 0, cargasIr: 0, gastosPersonales: 0, region: 'costa', salida: null, motivoSalida: null, vacacionesPendientes: 0,
});

/** Días de vacaciones proporcionales desde el último aniversario (15 por año). */
function suggestedVacation(ingreso: string, salida: string) {
  if (!ingreso || !salida) return 0;
  const [y, m, d] = ingreso.split('-');
  let anniv = `${salida.slice(0, 4)}-${m}-${d}`;
  if (anniv > salida) anniv = `${Number(salida.slice(0, 4)) - 1}-${m}-${d}`;
  if (anniv < `${y}-${m}-${d}`) anniv = ingreso;
  const days = (Date.parse(salida) - Date.parse(anniv)) / 86_400_000;
  return Math.round(((days * 15) / 365) * 10) / 10;
}

export function EmployeesTab({ empleados, sbu, now, onDone }: { empleados: Employee[]; sbu: number; now: number; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState<(EmployeeInput & { finiquito?: Settlement | null }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = <K extends keyof EmployeeInput>(k: K, v: EmployeeInput[K]) => setOpen((x) => (x ? { ...x, [k]: v } : x));
  const leaving = !!open && !open.activo;
  const fin = useMemo(() => (open && leaving && open.salida && open.motivoSalida && open.ingreso
    ? settlement({ ...open, id: open.id ?? '' } as Employee, open.salida, open.motivoSalida, sbu, { vacaciones: open.vacacionesPendientes ?? 0 }) : null), [open, leaving, sbu]);

  const save = async () => {
    if (!open) return;
    setBusy(true); setErr('');
    try {
      noSample();
      const { finiquito: _f, ...input } = open;
      const id = await (await fb()).adminSaveEmployee(input);
      if (fin) await (await fb()).adminSaveSettlement(id, { ...fin, calculadoEl: ecDate(now) });
      setOpen(null); await onDone();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const downloadActa = async () => {
    if (!open || !fin) return;
    const { downloadXlsx } = await import('../excel');
    await downloadXlsx(`hulul-finiquito-${open.nombre.replace(/[^A-Za-z0-9]+/g, '-')}.xlsx`, [{
      name: 'Liquidación', title: [...HEAD, `Liquidación de haberes de ${open.nombre} (C.I. ${open.cedula})`, `Ingreso ${open.ingreso} · salida ${fin.salida} · ${EXIT_LABEL[fin.motivo]} · ${fin.anios} años`, 'Base para el acta de finiquito del SUT; validar con la contadora.'],
      columns: [{ key: 'tipo', header: 'Tipo', width: 12 }, { key: 'concepto', header: 'Concepto', width: 48 }, { key: 'nota', header: 'Detalle', width: 40 }, { key: 'valor', header: 'Valor', money: true }],
      rows: [...fin.ingresos.map((l): Row => ({ tipo: 'Ingreso', ...l })), ...fin.descuentos.map((l): Row => ({ tipo: 'Descuento', ...l, valor: -l.valor })), { tipo: '', concepto: 'NETO A PAGAR', valor: fin.neto }],
    }]);
  };

  const sorted = [...empleados].sort((a, z) => Number(z.activo) - Number(a.activo) || a.nombre.localeCompare(z.nombre));
  return (
    <div className="adm-grid" style={{ gap: 12 }}>
      <div className="adm-bar"><button type="button" className="adm-btn solid" onClick={() => { setErr(''); setOpen(emptyEmployee()); }}>+ Agregar empleado</button>
        <span className="muted" style={{ fontSize: 13 }}>Solo personal en relación de dependencia. Los freelancers y profesionales con factura van como gasto en «Subcontratos» u «Honorarios».</span></div>
      {!sorted.length ? <div className="adm-empty">Aún no hay empleados registrados.</div> : (
        <div className="adm-cards">
          {sorted.map((e) => (
            <button key={e.id} type="button" className="adm-card" style={{ textAlign: 'left', cursor: 'pointer', opacity: e.activo ? 1 : .7 }} onClick={() => { setErr(''); setOpen({ ...emptyEmployee(), ...e }); }}>
              <h3>{e.nombre}</h3>
              <div className="muted" style={{ fontSize: 13 }}>{e.cargo || 'Sin cargo'} · desde {fmtDay(e.ingreso)}{e.salida ? ` · salió ${fmtDay(e.salida)}` : ''}</div>
              <div className="adm-bar" style={{ marginTop: 8 }}>
                <b>{money(e.sueldo)}</b>
                {!e.activo && <Badge tone="t-mute">{e.motivoSalida ? EXIT_LABEL[e.motivoSalida] : 'Inactivo'}</Badge>}
                {e.finiquito && <Badge tone="t-info">Finiquito {money(e.finiquito.neto)}</Badge>}
                {e.sueldo < sbu && <Badge tone="t-bad">Bajo el salario básico</Badge>}
                {e.decimosMensuales && <Badge tone="t-info">Décimos mensuales</Badge>}
                {e.fondoMensual && <Badge tone="t-info">Fondos en rol</Badge>}
                {(e.cargasUtilidades ?? 0) > 0 && <Badge tone="t-mute">{e.cargasUtilidades} cargas</Badge>}
              </div>
            </button>
          ))}
        </div>
      )}
      {open && (
        <Drawer title={open.id ? open.nombre : 'Nuevo empleado'} sub="Datos para el rol de pagos, el IESS, el impuesto a la renta y las utilidades." onClose={() => setOpen(null)}>
          <form className="adm-grid" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
            <label className="adm-field">Nombre completo<input className="adm-input" required value={open.nombre} onChange={(e) => set('nombre', e.target.value)} /></label>
            <div className="adm-grid g-2" style={{ gap: 10 }}>
              <label className="adm-field">Cédula<input className="adm-input" required inputMode="numeric" maxLength={10} value={open.cedula} onChange={(e) => set('cedula', e.target.value)} /></label>
              <label className="adm-field">Cargo<input className="adm-input" value={open.cargo} onChange={(e) => set('cargo', e.target.value)} /></label>
              <label className="adm-field">Sueldo mensual<NumInput required value={open.sueldo} onChange={(n) => set('sueldo', n ?? 0)} /></label>
              <label className="adm-field">Fecha de ingreso<input className="adm-input" type="date" required value={open.ingreso} onChange={(e) => set('ingreso', e.target.value)} /></label>
              <label className="adm-field">Correo<input className="adm-input" type="email" value={open.correo} onChange={(e) => set('correo', e.target.value)} /></label>
              <label className="adm-field">Cuenta bancaria<input className="adm-input" value={open.cuenta} onChange={(e) => set('cuenta', e.target.value)} placeholder="Banco, tipo y número" /></label>
              <label className="adm-field">Región (para el décimo cuarto)
                <select className="adm-select" value={open.region ?? 'costa'} onChange={(e) => set('region', e.target.value as 'costa' | 'sierra')}><option value="costa">Costa y Galápagos (se paga hasta el 15 de marzo)</option><option value="sierra">Sierra y Amazonía (hasta el 15 de agosto)</option></select>
              </label>
            </div>
            {open.sueldo > 0 && open.sueldo < sbu && <div className="adm-err">El sueldo es menor al salario básico ({money(sbu)}). Solo es válido si trabaja a tiempo parcial.</div>}
            <label className="adm-toggle"><input type="checkbox" checked={open.decimosMensuales} onChange={(e) => set('decimosMensuales', e.target.checked)} /> Pidió recibir el 13.º y 14.º sueldo cada mes</label>
            <label className="adm-toggle"><input type="checkbox" checked={open.fondoMensual} onChange={(e) => set('fondoMensual', e.target.checked)} /> Pidió recibir los fondos de reserva en el rol (si no, van al IESS)</label>

            <fieldset className="adm-card" style={{ padding: 12, display: 'grid', gap: 10 }}>
              <legend style={{ fontWeight: 800, fontSize: 13.5, padding: '0 4px' }}>Cargas y gastos personales</legend>
              <div className="adm-grid g-2" style={{ gap: 10 }}>
                <label className="adm-field">Cargas para utilidades<input className="adm-input" type="number" min={0} max={15} value={open.cargasUtilidades ?? 0} onChange={(e) => set('cargasUtilidades', Number(e.target.value))} /></label>
                <label className="adm-field">Cargas para el impuesto a la renta<input className="adm-input" type="number" min={0} max={15} value={open.cargasIr ?? 0} onChange={(e) => set('cargasIr', Number(e.target.value))} /></label>
                <label className="adm-field">Gastos personales proyectados del año (formulario del SRI)<NumInput value={open.gastosPersonales} onChange={(n) => set('gastosPersonales', n ?? 0)} placeholder="0,00" /></label>
              </div>
              <span className="muted" style={{ fontSize: 12.5 }}>Utilidades: cónyuge o conviviente, hijos menores de 18 o con discapacidad. Impuesto a la renta: además padres e hijos hasta 21 años que dependan del trabajador. Con los gastos personales el rol calcula la retención mensual de IR (solo si su sueldo pasa la base exenta).</span>
            </fieldset>

            <label className="adm-toggle"><input type="checkbox" checked={open.activo} onChange={(e) => setOpen((x) => (x ? { ...x, activo: e.target.checked, salida: e.target.checked ? null : x.salida ?? ecDate(now), motivoSalida: e.target.checked ? null : x.motivoSalida ?? 'renuncia' } : x))} /> Activo (si sale de la empresa, desmárcalo)</label>
            {leaving && (
              <fieldset className="adm-card" style={{ padding: 12, display: 'grid', gap: 10 }}>
                <legend style={{ fontWeight: 800, fontSize: 13.5, padding: '0 4px' }}>Salida y finiquito</legend>
                <div className="adm-grid g-2" style={{ gap: 10 }}>
                  <label className="adm-field">Último día de trabajo<input className="adm-input" type="date" required value={open.salida ?? ''} onChange={(e) => set('salida', e.target.value)} /></label>
                  <label className="adm-field">Motivo
                    <select className="adm-select" value={open.motivoSalida ?? 'renuncia'} onChange={(e) => set('motivoSalida', e.target.value as ExitReason)}>{(Object.keys(EXIT_LABEL) as ExitReason[]).map((k) => <option key={k} value={k}>{EXIT_LABEL[k]}</option>)}</select>
                  </label>
                  <label className="adm-field">Días de vacaciones no gozadas
                    <span className="row gap-8"><NumInput value={open.vacacionesPendientes} onChange={(n) => set('vacacionesPendientes', n ?? 0)} placeholder="0" />
                      <button type="button" className="adm-btn" onClick={() => set('vacacionesPendientes', suggestedVacation(open.ingreso, open.salida ?? ''))} title="Proporcional desde el último aniversario">Calcular</button></span>
                  </label>
                </div>
                {fin && (
                  <>
                    <dl className="adm-kv">
                      {fin.ingresos.map((l) => <Fragment key={l.concepto}><dt>{l.concepto}{l.nota && <div className="muted" style={{ fontSize: 12 }}>{l.nota}</div>}</dt><dd>{money(l.valor)}</dd></Fragment>)}
                      {fin.descuentos.map((l) => <Fragment key={l.concepto}><dt>(−) {l.concepto}</dt><dd style={{ color: 'var(--bad)' }}>-{money(l.valor)}</dd></Fragment>)}
                      <dt style={{ fontWeight: 800 }}>Neto a pagar</dt><dd className="big">{money(fin.neto)}</dd>
                    </dl>
                    <span className="muted" style={{ fontSize: 12.5 }}>Se paga al salir. El acta de finiquito se registra en el SUT dentro de 30 días y se da el aviso de salida al IESS (ver «Documentos laborales»). Validar con la contadora antes de pagar.</span>
                    <div className="adm-bar"><button type="button" className="adm-btn" onClick={downloadActa}>Descargar liquidación (Excel)</button></div>
                  </>
                )}
              </fieldset>
            )}
            {err && <div className="adm-err" role="alert">{err}</div>}
            <div className="adm-bar"><button type="submit" className="adm-btn solid" disabled={busy}>{busy ? 'Guardando…' : fin ? 'Guardar y registrar finiquito' : 'Guardar'}</button><button type="button" className="adm-btn" onClick={() => setOpen(null)}>Cancelar</button></div>
          </form>
        </Drawer>
      )}
    </div>
  );
}

/* ---------------------------------- Utilidades ---------------------------------- */

export function ProfitTab({ data, ledger, now, onDone }: { data: ExpensesData; ledger: DashLedger[]; now: number; onDone: () => Promise<void> }) {
  const thisYear = Number(ecDate(now).slice(0, 4));
  const [year, setYear] = useState(String(thisYear - 1));
  const saved = (data.utilidades ?? []).find((u) => u.year === year) ?? null;
  const estimated = useMemo(() => incomeStatement(ledger, data.gastos, { from: `${year}-01-01`, to: `${year}-12-31` }, now).utilidad, [ledger, data.gastos, year, now]);
  const [utilidad, setUtilidad] = useState<number | undefined>(undefined);
  const base = utilidad ?? saved?.utilidad ?? Math.max(0, estimated);
  const ps = useMemo(() => profitSharing(data.empleados, year, base, data.params.sbu), [data.empleados, year, base, data.params.sbu]);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const approved = saved?.status === 'aprobado';

  const act = async (kind: 'borrador' | 'aprobar' | 'reabrir') => {
    if (kind === 'aprobar' && !window.confirm(`¿Aprobar las utilidades de ${year}: ${money(ps.quince)} a repartir?`)) return;
    setBusy(kind); setMsg('');
    try {
      noSample();
      await (await fb()).adminSaveProfitSharing({ year, utilidad: base, lines: ps.lines, aprobar: kind === 'aprobar', reabrir: kind === 'reabrir' });
      setMsg(kind === 'aprobar' ? 'Utilidades aprobadas. Págalas hasta el 15 de abril y regístralas en el Ministerio del Trabajo.' : kind === 'reabrir' ? 'Reabiertas para corregir.' : 'Guardado como borrador.');
      await onDone();
    } catch (e) { setMsg(errMsg(e)); } finally { setBusy(''); }
  };
  const download = async () => {
    const { downloadXlsx } = await import('../excel');
    await downloadXlsx(`hulul-utilidades-${year}.xlsx`, [{
      name: `Utilidades ${year}`, title: [...HEAD, `Participación de los trabajadores en las utilidades de ${year}`, `Utilidad: ${money(base)} · 15 %: ${money(ps.quince)} (10 %: ${money(ps.diez)} · 5 %: ${money(ps.cinco)})`, `Tope por trabajador: 24 salarios básicos; excedente al IESS: ${money(ps.excedenteIess)}`],
      columns: [{ key: 'nombre', header: 'Trabajador', width: 28 }, { key: 'cedula', header: 'Cédula', text: true }, { key: 'dias', header: 'Días' }, { key: 'cargas', header: 'Cargas' }, { key: 'parte10', header: '10 %', money: true }, { key: 'parte5', header: '5 %', money: true }, { key: 'total', header: 'Total', money: true }, { key: 'excedente', header: 'Excedente al IESS', money: true }, { key: 'aPagar', header: 'A pagar', money: true }],
      rows: ps.lines as unknown as Row[], totals: ['parte10', 'parte5', 'total', 'excedente', 'aPagar'],
    }]);
  };

  return (
    <div className="adm-grid" style={{ gap: 12 }}>
      <div className="adm-bar">
        {[thisYear - 2, thisYear - 1, thisYear].map((y) => <button key={y} type="button" className="adm-chip" aria-pressed={year === String(y)} onClick={() => { setYear(String(y)); setUtilidad(undefined); }}>{y}{(data.utilidades ?? []).find((u) => u.year === String(y))?.status === 'aprobado' ? ' ✓' : ''}</button>)}
      </div>
      <div className="adm-note">El 15 % de la utilidad del año se reparte a los trabajadores (incluidos los que salieron): 10 % según los días trabajados y 5 % según días y cargas familiares. Se paga <b>hasta el 15 de abril</b> del año siguiente y se registra en el Ministerio del Trabajo. Usa la utilidad contable de la declaración de impuesto a la renta que prepara la contadora; la estimación del panel es solo una referencia.</div>
      <div className="adm-grid g-2" style={{ gap: 10, alignItems: 'end' }}>
        <label className="adm-field">Utilidad contable de {year} (antes de participación e impuestos)<NumInput value={base} onChange={setUtilidad} disabled={approved} /></label>
        <span className="muted" style={{ fontSize: 12.5 }}>Estimada por el panel con ingresos y gastos registrados: {money(estimated)}</span>
      </div>
      <div className="adm-kpis">
        <Kpi accent label="15 % a repartir" value={money(ps.quince)} hint={`10 %: ${money(ps.diez)} · 5 %: ${money(ps.cinco)}`} />
        <Kpi label="Trabajadores" value={ps.lines.length} hint={ps.sinCargas ? 'Nadie con cargas: el 5 % se reparte como el 10 %' : `${ps.lines.filter((l) => l.cargas > 0).length} con cargas`} />
        <Kpi label="Excedente al IESS" value={money(ps.excedenteIess)} hint="Lo que pasa de 24 salarios básicos por persona" />
      </div>
      {base <= 0 ? <div className="adm-empty">Con pérdida o sin utilidad no hay reparto.</div> : !ps.lines.length ? <div className="adm-empty">No hubo empleados en {year}.</div> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Trabajador</th><th className="num">Días</th><th className="num">Cargas</th><th className="num">10 %</th><th className="num">5 %</th><th className="num">A pagar</th></tr></thead>
            <tbody>{ps.lines.map((l) => <tr key={l.empleadoId}><td><b>{l.nombre}</b>{l.excedente > 0 && <div><Badge tone="t-warn">Tope: {money(l.excedente)} al IESS</Badge></div>}</td><td className="num">{l.dias}</td><td className="num">{l.cargas}</td><td className="num">{money(l.parte10)}</td><td className="num">{money(l.parte5)}</td><td className="num"><b>{money(l.aPagar)}</b></td></tr>)}</tbody>
          </table>
        </div>
      )}
      {msg && <div className="adm-note" role="status">{msg}</div>}
      <div className="adm-bar">
        {!approved && <button type="button" className="adm-btn" disabled={!!busy || base <= 0} onClick={() => act('borrador')}>Guardar borrador</button>}
        {!approved && <button type="button" className="adm-btn solid" disabled={!!busy || base <= 0 || !ps.lines.length} onClick={() => act('aprobar')}>Aprobar utilidades</button>}
        {approved && <button type="button" className="adm-btn" disabled={!!busy} onClick={() => act('reabrir')}>Reabrir para corregir</button>}
        {ps.lines.length > 0 && <button type="button" className="adm-btn" onClick={download}>Descargar en Excel</button>}
      </div>
    </div>
  );
}

/* ---------------------------------- Documentos laborales ---------------------------------- */

function DocRow({ item, onSaved }: { item: LaborItem; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [fecha, setFecha] = useState(item.state?.fecha ?? '');
  const [ref, setRef] = useState(item.state?.ref ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const done = !!item.state?.hecho;
  const save = async (hecho: boolean) => {
    setBusy(true); setErr('');
    try {
      noSample();
      let archivo = null;
      if (file) {
        const buf = new Uint8Array(await file.arrayBuffer()); let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        archivo = { fileName: file.name, contentType: file.type || 'application/pdf', content: btoa(bin) };
      }
      await (await fb()).adminSaveLaborDoc({ owner: item.owner, key: item.key, hecho, fecha: fecha || null, ref, archivo });
      setOpen(false); await onSaved();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const view = async () => {
    try {
      noSample();
      const f = await (await fb()).adminLaborDocFile(item.owner, item.key);
      const bin = atob(f.content); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      window.open(URL.createObjectURL(new Blob([bytes], { type: f.contentType })), '_blank');
    } catch (e) { setErr(errMsg(e)); }
  };
  const badge = done ? <Badge tone="t-ok">Hecho{item.state?.fecha ? ` · ${fmtDay(item.state.fecha)}` : ''}</Badge>
    : item.overdue ? <Badge tone="t-bad">Vencido {fmtDay(item.due!)}</Badge>
    : item.due ? <Badge tone={item.soon ? 't-warn' : 't-mute'}>Vence {fmtDay(item.due)}</Badge>
    : <Badge tone="t-mute">Según cronograma</Badge>;
  return (
    <li className="adm-labor-row">
      <div>
        <b>{item.label}</b> {badge}
        <small>{item.help} · {item.who}{item.state?.ref ? ` · Ref.: ${item.state.ref}` : ''}</small>
        {open && (
          <div className="adm-grid g-2" style={{ gap: 8, marginTop: 8 }}>
            <label className="adm-field">Fecha en que se hizo<input className="adm-input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
            <label className="adm-field">Referencia (nº de trámite, registro…)<input className="adm-input" value={ref} onChange={(e) => setRef(e.target.value)} /></label>
            <label className="adm-field">Archivo (PDF o foto, opcional)<input className="adm-input" type="file" accept=".pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
            <span className="adm-bar" style={{ alignSelf: 'end' }}><button type="button" className="adm-btn solid" disabled={busy} onClick={() => save(true)}>{busy ? 'Guardando…' : 'Guardar como hecho'}</button>
              {done && <button type="button" className="adm-btn" disabled={busy} onClick={() => save(false)}>Marcar pendiente</button>}</span>
          </div>
        )}
        {err && <div className="adm-err" role="alert" style={{ marginTop: 6 }}>{err}</div>}
      </div>
      <span className="adm-bar" style={{ gap: 6, flexWrap: 'nowrap' }}>
        {item.state?.archivo && <button type="button" className="adm-btn" onClick={view}>Ver archivo</button>}
        <button type="button" className="adm-btn" onClick={() => setOpen((v) => !v)}>{open ? 'Cerrar' : done ? 'Editar' : 'Registrar'}</button>
      </span>
    </li>
  );
}

export function LaborDocsTab({ data, now, onDone }: { data: ExpensesData; now: number; onDone: () => Promise<void> }) {
  const [onlyPending, setOnlyPending] = useState(true);
  const items = useMemo(() => laborChecklist(data.empleados, data.laboral ?? {}, now), [data.empleados, data.laboral, now]);
  const shown = onlyPending ? items.filter((i) => !i.state?.hecho) : items;
  const groups = new Map<string, LaborItem[]>();
  for (const i of shown) { const k = i.owner.startsWith('empresa') ? `Empresa · ${i.ownerName}` : i.ownerName; groups.set(k, [...(groups.get(k) ?? []), i]); }
  const late = items.filter((i) => i.overdue).length;
  const done = items.filter((i) => i.state?.hecho).length;
  if (!data.empleados.length) return <div className="adm-empty">Agrega a tus empleados en la pestaña «Empleados» y aquí aparecerá todo lo que piden el Ministerio del Trabajo, el IESS y el SRI.</div>;
  return (
    <div className="adm-grid" style={{ gap: 12 }}>
      <div className="adm-kpis">
        <Kpi accent label="Vencidos" value={late} hint={late ? 'Pueden generar multas' : 'Nada vencido'} onClick={() => setOnlyPending(true)} />
        <Kpi label="Pendientes" value={items.length - done} hint="Por hacer o registrar" onClick={() => setOnlyPending(true)} />
        <Kpi label="Hechos" value={done} hint="Con fecha, referencia y archivo" onClick={() => setOnlyPending(false)} />
      </div>
      <div className="adm-note">Cada trámite se hace en su portal (SUT del Ministerio del Trabajo, IESS o SRI). Aquí queda registrado cuándo se hizo, el número de trámite y el archivo de respaldo, y la bandeja de novedades avisa antes de que venza. Los plazos son los generales: confírmalos con la contadora cada año.</div>
      <div className="adm-bar"><button type="button" className="adm-chip" aria-pressed={onlyPending} onClick={() => setOnlyPending(true)}>Pendientes</button><button type="button" className="adm-chip" aria-pressed={!onlyPending} onClick={() => setOnlyPending(false)}>Todo</button></div>
      {!shown.length ? <div className="adm-empty">Todo al día.</div> : [...groups.entries()].map(([name, list]) => (
        <section key={name} className="adm-card">
          <h2>{name}</h2>
          <ul className="adm-labor-list">{list.sort((a, z) => (a.due ?? '9').localeCompare(z.due ?? '9')).map((i) => <DocRow key={`${i.owner}-${i.key}`} item={i} onSaved={onDone} />)}</ul>
        </section>
      ))}
    </div>
  );
}
