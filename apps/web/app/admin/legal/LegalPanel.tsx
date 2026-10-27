'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ecDate } from '@hulul/shared/dashboard';
import type { AcceptanceRecord, LegalCase, LegalCaseInput, ShieldItem } from '@hulul/shared/firebase';
import { MUESTRA, useAdmin } from '../AdminShell';
import { Badge, Drawer, downloadPdf, fmtDay, Kpi, Loading, money, PageHead } from '../ui';

/**
 * Legal y blindaje: prueba de aceptación de los términos (quién, qué versión, cuándo, IP y
 * dispositivo, con constancia en PDF), casos legales (demandas, denuncias, Defensoría…) y la
 * lista de lo que protege a la compañía. Aceptaciones: socios y UAFE. Casos y blindaje: socios.
 */
const fb = () => import('@hulul/shared/firebase');
const errMsg = (e: unknown) => ((e as { message?: string }).message || 'No se pudo completar.').replace(/\s*\[\d{3}\]\s*$/, '');
type Tab = 'aceptaciones' | 'casos' | 'blindaje';
const DOC_LABEL: Record<string, string> = { terminos: 'Términos', privacidad: 'Privacidad', mandato: 'Mandato de cobro' };
const MOMENTO: Record<string, string> = { registro: 'Registro', cambio_version: 'Versión nueva', reserva: 'Reserva' };

const CASE_TYPES: Record<string, string> = {
  demanda_civil: 'Demanda civil', denuncia_penal: 'Denuncia penal (Fiscalía)', defensoria: 'Defensoría del Pueblo (consumidor)', laboral: 'Ministerio del Trabajo',
  datos: 'Protección de datos (LOPDP)', sri: 'Requerimiento del SRI', extrajudicial: 'Reclamo extrajudicial o carta de abogado', otro: 'Otro',
};
const CASE_STATUS: Record<string, { label: string; tone: string }> = {
  abierto: { label: 'Abierto', tone: 't-warn' }, en_tramite: { label: 'En trámite', tone: 't-info' }, audiencia: { label: 'Audiencia', tone: 't-violet' },
  cerrado_favorable: { label: 'Cerrado a favor', tone: 't-ok' }, cerrado_acuerdo: { label: 'Cerrado con acuerdo', tone: 't-mute' }, cerrado_desfavorable: { label: 'Cerrado en contra', tone: 't-bad' },
};

/** Lo que protege a HULUL ante clientes, profesionales y autoridades. */
const SHIELD: { key: string; label: string; why: string }[] = [
  { key: 'terminos_abogado', label: 'Términos y condiciones revisados por un abogado', why: 'Que HULUL sea intermediario, límites claros y cláusulas válidas ante la Ley de Defensa del Consumidor (las que eximen de toda responsabilidad son nulas).' },
  { key: 'aceptacion_probada', label: 'Aceptación con prueba (versión, fecha, IP, dispositivo y copia por correo)', why: 'Funciona en la plataforma desde esta versión; revisa la pestaña Aceptaciones.' },
  { key: 'contrato_profesional', label: 'Contrato de prestación de servicios y mandato de cobro con cada profesional', why: 'Deja claro que no hay relación laboral; idealmente firmado con firma electrónica.' },
  { key: 'privacidad_lopdp', label: 'Privacidad conforme a la LOPDP y registro de actividades de tratamiento', why: 'Incluye el uso de IA (Claude) para analizar reclamos y leer estados de cuenta.' },
  { key: 'delegado_datos', label: 'Delegado de protección de datos (si aplica)', why: 'Según el volumen y tipo de datos que trata la plataforma.' },
  { key: 'seguro_rc', label: 'Seguro de responsabilidad civil de la plataforma', why: 'Cubre daños en domicilios o a terceros durante un servicio.' },
  { key: 'verificacion_profesionales', label: 'Verificación de identidad y antecedentes de los profesionales', why: 'Cédula, selfie y documentos ya se piden en el registro; documentar el criterio de aprobación.' },
  { key: 'objeto_social', label: 'Objeto social reformado (intermediación por plataforma y recaudación por cuenta de terceros)', why: 'Escritura y actualización del RUC de Corporación Coffeeport.' },
  { key: 'catastro_sri', label: 'Registro como mercado en línea en el SRI', why: 'Régimen de mercados en línea (valores de terceros no son ingreso de HULUL).' },
  { key: 'marca_senadi', label: 'Marca HULUL registrada en el SENADI', why: 'Clases 9, 35 y 42 a nombre de Coffeeport.' },
  { key: 'pasarela', label: 'Pasarela de pagos autorizada y contrato firmado', why: 'Que confirme por escrito que califica para mercado en línea.' },
  { key: 'firma_empresa', label: 'Firma electrónica de la compañía', why: 'Para facturar, firmar contratos y responder trámites.' },
];

export function LegalPanel() {
  const { can, now } = useAdmin();
  const [tab, setTab] = useState<Tab>('aceptaciones');
  const canCases = can('reclamos');
  const tabs: [Tab, string][] = [['aceptaciones', 'Aceptaciones'], ...(canCases ? [['casos', 'Casos legales'], ['blindaje', 'Blindaje']] as [Tab, string][] : [])];
  return (
    <>
      <PageHead title="Legal y blindaje" lead="La prueba de que cada cliente y profesional aceptó los términos, los casos legales y lo que protege a la compañía." />
      <div className="adm-tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} type="button" role="tab" className="adm-tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'aceptaciones' && <AcceptancesTab />}
      {tab === 'casos' && canCases && <CasesTab now={now} />}
      {tab === 'blindaje' && canCases && <ShieldTab />}
    </>
  );
}

/* ---------------------------------- Aceptaciones ---------------------------------- */

const SAMPLE_ACC: AcceptanceRecord[] = [
  { id: 'A8f3k2LmQ0pX1z', uid: 'cli1', email: 'andrea.torres@gmail.com', nombre: 'Andrea Torres', tipo: 'cliente', docs: [{ doc: 'terminos', version: '2026-10-25', textoHash: null }, { doc: 'privacidad', version: '2026-10-25', textoHash: null }], canal: 'web', momento: 'registro', ip: '190.152.10.24', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)', atIso: '2026-10-26T15:12:00.000Z', huella: 'a'.repeat(64) },
  { id: 'B2k9dPq7Rr3Ts1', uid: 'pro1', email: 'juan@correo.com', nombre: 'Juan Vargas', tipo: 'profesional', docs: [{ doc: 'terminos', version: '2026-10-25', textoHash: null }, { doc: 'privacidad', version: '2026-10-25', textoHash: null }, { doc: 'mandato', version: '2026-10-25', textoHash: null }], canal: 'web', momento: 'registro', ip: '181.199.40.7', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141', atIso: '2026-10-25T20:40:00.000Z', huella: 'b'.repeat(64) },
];

function device(ua: string) {
  if (/iPhone|iPad/i.test(ua)) return 'iPhone / iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS/i.test(ua)) return 'Mac';
  return ua.slice(0, 30) || '—';
}

function AcceptancesTab() {
  const [data, setData] = useState<{ list: AcceptanceRecord[]; stats: { clientes: number; clientesAlDia: number; profesionales: number; profesionalesAlDia: number } } | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState<'todos' | 'cliente' | 'profesional'>('todos');
  const [open, setOpen] = useState<AcceptanceRecord | null>(null);
  const [busy, setBusy] = useState('');
  useEffect(() => {
    (async () => {
      try { setData(MUESTRA ? { list: SAMPLE_ACC, stats: { clientes: 14, clientesAlDia: 1, profesionales: 8, profesionalesAlDia: 1 } } : await (await fb()).adminAcceptances()); }
      catch (e) { setErr(errMsg(e)); }
    })();
  }, []);
  const rows = useMemo(() => (data?.list ?? []).filter((r) => (tipo === 'todos' || r.tipo === tipo) && (!q || `${r.nombre} ${r.email} ${r.ip} ${r.id}`.toLowerCase().includes(q.toLowerCase()))), [data, q, tipo]);
  const pdf = async (r: AcceptanceRecord) => {
    setBusy(r.id); setErr('');
    try {
      if (MUESTRA) throw new Error('En la muestra no se generan constancias.');
      const f = await (await fb()).adminAcceptancePdf(r.id);
      if (!f.integro) setErr('Atención: la huella del registro no coincide; revisa con soporte antes de usar esta constancia.');
      downloadPdf(f.fileName, f.content);
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(''); }
  };
  const excel = async () => {
    const { downloadXlsx } = await import('../excel');
    await downloadXlsx(`hulul-aceptaciones-${ecDate(Date.now())}.xlsx`, [{
      name: 'Aceptaciones', title: ['CORPORACIÓN COFFEEPORT CÍA. LTDA. — HULUL', 'Registro de aceptaciones de términos, privacidad y mandato de cobro'],
      columns: [{ key: 'fecha', header: 'Fecha y hora (Ecuador)', width: 20 }, { key: 'tipo', header: 'Tipo' }, { key: 'nombre', header: 'Nombre', width: 26 }, { key: 'email', header: 'Correo', width: 28 }, { key: 'docs', header: 'Documentos y versión', width: 46 }, { key: 'momento', header: 'Momento' }, { key: 'canal', header: 'Canal' }, { key: 'ip', header: 'IP', width: 16 }, { key: 'dispositivo', header: 'Dispositivo', width: 20 }, { key: 'id', header: 'Registro', width: 22 }, { key: 'huella', header: 'Huella SHA-256', width: 66 }],
      rows: rows.map((r) => ({ fecha: new Date(r.atIso).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' }), tipo: r.tipo, nombre: r.nombre, email: r.email, docs: r.docs.map((d) => `${DOC_LABEL[d.doc] ?? d.doc} ${d.version}`).join(' · '), momento: MOMENTO[r.momento] ?? r.momento, canal: r.canal, ip: r.ip, dispositivo: device(r.userAgent), id: r.id, huella: r.huella })),
    }]);
  };
  if (err && !data) return <div className="adm-err" role="alert">{err}</div>;
  if (!data) return <Loading />;
  const st = data.stats;
  return (
    <div className="adm-grid" style={{ gap: 12 }}>
      <div className="adm-kpis">
        <Kpi accent label="Aceptaciones registradas" value={data.list.length} hint="Últimas 1.000, con IP, dispositivo y huella" />
        <Kpi label="Clientes con la versión vigente" value={`${st.clientesAlDia} de ${st.clientes}`} hint="Los demás la aceptan al volver a entrar" onClick={() => setTipo('cliente')} />
        <Kpi label="Profesionales con el mandato vigente" value={`${st.profesionalesAlDia} de ${st.profesionales}`} hint="Registros anteriores a esta función no tienen prueba" onClick={() => setTipo('profesional')} />
      </div>
      <div className="adm-note">Cada aceptación queda en un registro que nadie puede cambiar desde la app: quién, qué versión de cada documento, fecha y hora, IP y dispositivo, con una huella SHA-256. El usuario recibe copia por correo. Si cambian los términos (nueva versión en el código), cada cliente debe aceptarlos de nuevo antes de reservar. La <b>constancia en PDF</b> sirve como respaldo ante un juez, la Defensoría o el propio usuario.</div>
      {err && <div className="adm-err" role="alert">{err}</div>}
      <div className="adm-bar">
        {(['todos', 'cliente', 'profesional'] as const).map((t) => <button key={t} type="button" className="adm-chip" aria-pressed={tipo === t} onClick={() => setTipo(t)}>{t === 'todos' ? 'Todos' : t === 'cliente' ? 'Clientes' : 'Profesionales'}</button>)}
        <input className="adm-input" placeholder="Buscar por nombre, correo, IP o registro" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }} />
        <button type="button" className="adm-btn" onClick={excel} disabled={!rows.length}>Descargar Excel</button>
      </div>
      {!rows.length ? <div className="adm-empty">Aún no hay aceptaciones registradas. Empiezan a guardarse cuando se publique esta versión.</div> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Fecha</th><th>Usuario</th><th>Documentos</th><th>Desde</th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="click" onClick={() => setOpen(r)}>
                <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.atIso).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td><b>{r.nombre || '—'}</b> <Badge tone={r.tipo === 'profesional' ? 't-violet' : 't-info'}>{r.tipo}</Badge><div className="muted" style={{ fontSize: 12.5 }}>{r.email}</div></td>
                <td style={{ fontSize: 13 }}>{r.docs.map((d) => `${DOC_LABEL[d.doc] ?? d.doc} ${d.version}`).join(' · ')}<div className="muted" style={{ fontSize: 12 }}>{MOMENTO[r.momento] ?? r.momento}</div></td>
                <td style={{ fontSize: 13 }}>{device(r.userAgent)} · {r.canal === 'app' ? 'App' : 'Web'}<div className="muted" style={{ fontSize: 12 }}>IP {r.ip || '—'}</div></td>
                <td onClick={(e) => e.stopPropagation()}><button type="button" className="adm-btn" disabled={busy === r.id} onClick={() => pdf(r)}>{busy === r.id ? '…' : 'Constancia PDF'}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {open && (
        <Drawer title={`Aceptación de ${open.nombre || open.email}`} sub={`Registro ${open.id}`} onClose={() => setOpen(null)}>
          <dl className="adm-kv">
            <dt>Fecha y hora</dt><dd>{new Date(open.atIso).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}</dd>
            <dt>Correo</dt><dd>{open.email || '—'}</dd>
            <dt>Cuenta</dt><dd style={{ fontWeight: 400 }}>{open.uid}</dd>
            {open.docs.map((d) => <Fragment key={d.doc}><dt>{DOC_LABEL[d.doc] ?? d.doc}</dt><dd>versión {d.version}</dd></Fragment>)}
            <dt>Momento</dt><dd>{MOMENTO[open.momento] ?? open.momento}</dd>
            <dt>Canal</dt><dd>{open.canal === 'app' ? 'Aplicación' : 'Web'}</dd>
            <dt>IP</dt><dd>{open.ip || '—'}</dd>
          </dl>
          <p className="muted" style={{ fontSize: 12.5, wordBreak: 'break-all' }}>Dispositivo: {open.userAgent}</p>
          <p className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>Huella SHA-256: {open.huella}</p>
          <button type="button" className="adm-btn solid" onClick={() => pdf(open)}>Descargar constancia en PDF</button>
        </Drawer>
      )}
    </div>
  );
}

/* ---------------------------------- Casos legales ---------------------------------- */

const emptyCase = (today: string): LegalCaseInput => ({ tipo: 'defensoria', titulo: '', notificado: today, contraparteTipo: 'cliente', contraparte: '', contraparteId: '', reserva: '', autoridad: '', proceso: '', abogado: '', estado: 'abierto', proxima: null, proximaQue: '', monto: 0, notas: '' });

function CasesTab({ now }: { now: number }) {
  const today = ecDate(now);
  const [casos, setCasos] = useState<LegalCase[] | null>(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<LegalCaseInput | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setCasos(MUESTRA ? [] : (await (await fb()).adminLegalCases()).casos); } catch (e) { setErr(errMsg(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const set = <K extends keyof LegalCaseInput>(k: K, v: LegalCaseInput[K]) => setOpen((x) => (x ? { ...x, [k]: v } : x));
  const save = async () => {
    if (!open) return;
    setBusy(true); setErr('');
    try {
      if (MUESTRA) throw new Error('En la muestra no se guardan cambios.');
      let archivo = null;
      if (file) { const buf = new Uint8Array(await file.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000)); archivo = { fileName: file.name, contentType: file.type || 'application/pdf', content: btoa(bin) }; }
      await (await fb()).adminSaveLegalCase({ ...open, archivo });
      setOpen(null); setFile(null); await load();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const viewFile = async (id: string, i: number) => {
    try { const f = await (await fb()).adminLegalCaseFile(id, i); const bin = atob(f.content); const bytes = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k); window.open(URL.createObjectURL(new Blob([bytes], { type: f.contentType })), '_blank'); }
    catch (e) { setErr(errMsg(e)); }
  };
  if (!casos) return err ? <div className="adm-err">{err}</div> : <Loading />;
  const abiertos = casos.filter((c) => !c.estado.startsWith('cerrado'));
  const proximos = abiertos.filter((c) => c.proxima && c.proxima <= ecDate(now + 7 * 86_400_000));
  const current = open && 'id' in open && open.id ? casos.find((c) => c.id === open.id) : null;
  return (
    <div className="adm-grid" style={{ gap: 12 }}>
      <div className="adm-kpis">
        <Kpi accent label="Casos abiertos" value={abiertos.length} hint={`${casos.length} en total`} />
        <Kpi label="Diligencias en 7 días" value={proximos.length} hint={proximos[0] ? `${proximos[0].proximaQue || 'Próxima diligencia'} · ${fmtDay(proximos[0].proxima!)}` : 'Nada próximo'} />
        <Kpi label="Monto reclamado (abiertos)" value={money(abiertos.reduce((t, c) => t + (c.monto || 0), 0))} hint="Lo que piden las contrapartes" />
      </div>
      <div className="adm-bar"><button type="button" className="adm-btn solid" onClick={() => { setErr(''); setFile(null); setOpen(emptyCase(today)); }}>+ Registrar caso</button>
        <span className="muted" style={{ fontSize: 13 }}>Demandas, denuncias, reclamos ante la Defensoría del Pueblo, el Ministerio del Trabajo, la LOPDP o el SRI. Las diligencias próximas salen en Novedades.</span></div>
      {err && <div className="adm-err" role="alert">{err}</div>}
      {!casos.length ? <div className="adm-empty">No hay casos legales registrados.</div> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Caso</th><th>Contraparte</th><th>Estado</th><th>Próxima diligencia</th><th className="num">Monto</th></tr></thead>
            <tbody>{[...casos].sort((a, z) => (a.proxima ?? '9').localeCompare(z.proxima ?? '9')).map((c) => (
              <tr key={c.id} className="click" onClick={() => { setErr(''); setFile(null); setOpen({ ...c }); }}>
                <td><b>{c.titulo}</b><div className="muted" style={{ fontSize: 12.5 }}>{CASE_TYPES[c.tipo] ?? c.tipo}{c.proceso ? ` · ${c.proceso}` : ''} · notificado {fmtDay(c.notificado)}</div></td>
                <td style={{ fontSize: 13 }}>{c.contraparte || '—'}<div className="muted" style={{ fontSize: 12 }}>{c.contraparteTipo}{c.reserva ? ` · reserva ${c.reserva}` : ''}</div></td>
                <td><Badge tone={CASE_STATUS[c.estado]?.tone ?? 't-mute'}>{CASE_STATUS[c.estado]?.label ?? c.estado}</Badge></td>
                <td style={{ fontSize: 13 }}>{c.proxima ? <><b style={{ color: c.proxima < today ? 'var(--bad)' : undefined }}>{fmtDay(c.proxima)}</b><div className="muted" style={{ fontSize: 12 }}>{c.proximaQue}</div></> : '—'}</td>
                <td className="num">{c.monto ? money(c.monto) : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {open && (
        <Drawer title={current ? current.titulo : 'Registrar caso legal'} sub="Todo lo del caso en un solo lugar: autoridad, número de proceso, abogado, diligencias y documentos." onClose={() => setOpen(null)}>
          <form className="adm-grid" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div className="adm-grid g-2" style={{ gap: 10 }}>
              <label className="adm-field">Tipo<select className="adm-select" value={open.tipo} onChange={(e) => set('tipo', e.target.value)}>{Object.entries(CASE_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label className="adm-field">Estado<select className="adm-select" value={open.estado} onChange={(e) => set('estado', e.target.value)}>{Object.entries(CASE_STATUS).map(([k, l]) => <option key={k} value={k}>{l.label}</option>)}</select></label>
            </div>
            <label className="adm-field">Título<input className="adm-input" required value={open.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Ej.: Cliente reclama daño en lavadora" /></label>
            <div className="adm-grid g-2" style={{ gap: 10 }}>
              <label className="adm-field">Notificado el<input className="adm-input" type="date" required value={open.notificado} onChange={(e) => set('notificado', e.target.value)} /></label>
              <label className="adm-field">Contraparte es<select className="adm-select" value={open.contraparteTipo} onChange={(e) => set('contraparteTipo', e.target.value)}><option value="cliente">Cliente</option><option value="profesional">Profesional</option><option value="trabajador">Trabajador de HULUL</option><option value="autoridad">Autoridad</option><option value="otro">Otro</option></select></label>
              <label className="adm-field">Nombre de la contraparte<input className="adm-input" value={open.contraparte} onChange={(e) => set('contraparte', e.target.value)} /></label>
              <label className="adm-field">Correo o cédula (para buscar su aceptación)<input className="adm-input" value={open.contraparteId} onChange={(e) => set('contraparteId', e.target.value)} /></label>
              <label className="adm-field">Reserva relacionada (código)<input className="adm-input" value={open.reserva} onChange={(e) => set('reserva', e.target.value)} /></label>
              <label className="adm-field">Autoridad / juzgado<input className="adm-input" value={open.autoridad} onChange={(e) => set('autoridad', e.target.value)} /></label>
              <label className="adm-field">Nº de proceso<input className="adm-input" value={open.proceso} onChange={(e) => set('proceso', e.target.value)} /></label>
              <label className="adm-field">Abogado a cargo<input className="adm-input" value={open.abogado} onChange={(e) => set('abogado', e.target.value)} /></label>
              <label className="adm-field">Próxima diligencia<input className="adm-input" type="date" value={open.proxima ?? ''} onChange={(e) => set('proxima', e.target.value || null)} /></label>
              <label className="adm-field">¿Qué hay que hacer?<input className="adm-input" value={open.proximaQue} onChange={(e) => set('proximaQue', e.target.value)} placeholder="Audiencia, contestar, presentar pruebas…" /></label>
              <label className="adm-field">Monto reclamado (USD)<input className="adm-input" inputMode="decimal" value={open.monto || ''} onChange={(e) => set('monto', Number(e.target.value.replace(',', '.')) || 0)} /></label>
              <label className="adm-field">Agregar documento (PDF o foto)<input className="adm-input" type="file" accept=".pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
            </div>
            <label className="adm-field">Notas<textarea className="adm-input" rows={5} value={open.notas} onChange={(e) => set('notas', e.target.value)} placeholder="Hechos, estrategia, acuerdos…" /></label>
            {current?.archivos?.length ? <div className="adm-grid" style={{ gap: 6 }}><b style={{ fontSize: 13.5 }}>Documentos</b>{current.archivos.map((a, i) => <button key={a.path} type="button" className="adm-btn" style={{ justifySelf: 'start' }} onClick={() => viewFile(current.id, i)}>{a.name} · {fmtDay(a.at.slice(0, 10))}</button>)}</div> : null}
            {current?.historial?.length ? <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Historial: {current.historial.map((h) => `${CASE_STATUS[h.estado]?.label ?? h.estado} (${fmtDay(h.at.slice(0, 10))}, ${h.por})`).join(' → ')}</p> : null}
            <div className="adm-note">Evidencia disponible en la plataforma: la constancia de aceptación de la contraparte (pestaña Aceptaciones), la reserva con su chat, fotos y llegada por GPS (Reservas), y el expediente del reclamo si lo hubo (Reclamos).</div>
            {err && <div className="adm-err" role="alert">{err}</div>}
            <div className="adm-bar"><button type="submit" className="adm-btn solid" disabled={busy}>{busy ? 'Guardando…' : 'Guardar caso'}</button><button type="button" className="adm-btn" onClick={() => setOpen(null)}>Cancelar</button></div>
          </form>
        </Drawer>
      )}
    </div>
  );
}

/* ---------------------------------- Blindaje ---------------------------------- */

function ShieldTab() {
  const [items, setItems] = useState<Record<string, ShieldItem> | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { (async () => { try { setItems(MUESTRA ? { aceptacion_probada: { hecho: true, fecha: '2026-10-27', nota: '' } } : (await (await fb()).adminLegalCases()).blindaje); } catch (e) { setErr(errMsg(e)); } })(); }, []);
  const toggle = async (key: string, hecho: boolean, nota: string) => {
    try {
      if (MUESTRA) throw new Error('En la muestra no se guardan cambios.');
      const it = await (await fb()).adminSaveShield(key, { hecho, fecha: hecho ? ecDate(Date.now()) : null, nota });
      setItems((x) => ({ ...(x ?? {}), [key]: it }));
    } catch (e) { setErr(errMsg(e)); }
  };
  if (!items) return err ? <div className="adm-err">{err}</div> : <Loading />;
  const done = SHIELD.filter((s) => items[s.key]?.hecho).length;
  return (
    <div className="adm-grid" style={{ gap: 12 }}>
      <div className="adm-kpis"><Kpi accent label="Blindaje completado" value={`${done} de ${SHIELD.length}`} hint="Lo que protege a la compañía ante clientes, profesionales y autoridades" /></div>
      <div className="adm-note">La aceptación en la app es válida (Ley de Comercio Electrónico: los mensajes de datos valen como documentos escritos), pero el blindaje real lo dan las cláusulas correctas, el contrato con los profesionales, el seguro y el cumplimiento de la LOPDP. Esta lista la debe revisar el abogado.</div>
      {err && <div className="adm-err" role="alert">{err}</div>}
      <ul className="adm-labor-list">
        {SHIELD.map((s) => <ShieldRow key={s.key} def={s} item={items[s.key]} onToggle={toggle} />)}
      </ul>
    </div>
  );
}

function ShieldRow({ def, item, onToggle }: { def: { key: string; label: string; why: string }; item?: ShieldItem; onToggle: (key: string, hecho: boolean, nota: string) => Promise<void> }) {
  const [nota, setNota] = useState(item?.nota ?? '');
  return (
    <li className="adm-labor-row">
      <div>
        <b>{def.label}</b> {item?.hecho ? <Badge tone="t-ok">Listo{item.fecha ? ` · ${fmtDay(item.fecha)}` : ''}</Badge> : <Badge tone="t-warn">Pendiente</Badge>}
        <small>{def.why}</small>
        <input className="adm-input" style={{ marginTop: 6, width: '100%' }} placeholder="Nota (quién lo lleva, número de póliza, abogado…)" value={nota} onChange={(e) => setNota(e.target.value)} onBlur={() => nota !== (item?.nota ?? '') && onToggle(def.key, !!item?.hecho, nota)} />
      </div>
      <button type="button" className="adm-btn" onClick={() => onToggle(def.key, !item?.hecho, nota)}>{item?.hecho ? 'Marcar pendiente' : 'Marcar listo'}</button>
    </li>
  );
}
