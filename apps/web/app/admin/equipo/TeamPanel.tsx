'use client';

import { useCallback, useEffect, useState } from 'react';
import { ROLE_INFO, type AdminRole } from '@hulul/shared/dashboard';
import type { AdminTeam } from '@hulul/shared/firebase';
import { useAdmin } from '../AdminShell';
import { Badge, fmtWhen, PageHead } from '../ui';

type Assignable = 'socio' | 'contabilidad' | 'cumplimiento';
const ASSIGNABLE: Assignable[] = ['socio', 'contabilidad', 'cumplimiento'];
const ROLE_TONE: Record<AdminRole, string> = { dueno: 't-ok', socio: 't-info', contabilidad: 't-warm', cumplimiento: 't-violet' };
const errMsg = (e: unknown) => ((e as { message?: string }).message || 'No se pudo guardar.').replace(/\s*\[\d{3}\]\s*$/, '');

/** Equipo y roles: solo el dueño da, cambia o quita accesos. */
export function TeamPanel() {
  const { data } = useAdmin();
  const [team, setTeam] = useState<AdminTeam | null>(null);
  const [form, setForm] = useState<{ name: string; email: string; role: Assignable }>({ name: '', email: '', role: 'contabilidad' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const muestra = !!data && data.viewer?.email === 'muestra@hululec.com';

  const load = useCallback(async () => {
    if (muestra) {
      setTeam({ members: [
        { email: 'lenriquesegovia@gmail.com', name: '', role: 'dueno', active: true, addedBy: 'ADMIN_EMAILS', addedAt: null, lastSeen: null },
        { email: 'socio@correo.com', name: 'Socio (muestra)', role: 'socio', active: true, addedBy: 'lenriquesegovia@gmail.com', addedAt: Date.now() - 864e5, lastSeen: Date.now() - 3600e3 },
        { email: 'contadora@correo.com', name: 'Contadora (muestra)', role: 'contabilidad', active: true, addedBy: 'lenriquesegovia@gmail.com', addedAt: Date.now() - 2 * 864e5, lastSeen: null },
      ], log: [] });
      return;
    }
    try {
      const { adminTeam } = await import('@hulul/shared/firebase');
      setTeam(await adminTeam());
    } catch (e) { setMsg({ ok: false, text: errMsg(e) }); }
  }, [muestra]);
  useEffect(() => { if (data) load(); }, [data, load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const { adminSetRole } = await import('@hulul/shared/firebase');
      await adminSetRole({ name: form.name.trim(), email: form.email.trim(), role: form.role });
      setMsg({ ok: true, text: `Listo: ${form.email.trim()} entra como ${ROLE_INFO[form.role].label}. Le enviamos un correo con el enlace.` });
      setForm({ name: '', email: '', role: form.role });
      load();
    } catch (err) { setMsg({ ok: false, text: errMsg(err) }); } finally { setBusy(false); }
  };

  const remove = async (email: string) => {
    if (!window.confirm(`¿Quitar el acceso de ${email}? Deja de entrar al panel desde ahora.`)) return;
    setBusy(true); setMsg(null);
    try {
      const { adminRemoveRole } = await import('@hulul/shared/firebase');
      await adminRemoveRole(email);
      setMsg({ ok: true, text: `Se quitó el acceso de ${email}.` });
      load();
    } catch (err) { setMsg({ ok: false, text: errMsg(err) }); } finally { setBusy(false); }
  };

  const changeRole = async (email: string, name: string, role: Assignable) => {
    setBusy(true); setMsg(null);
    try {
      const { adminSetRole } = await import('@hulul/shared/firebase');
      await adminSetRole({ email, name: name || email.split('@')[0], role });
      setMsg({ ok: true, text: `${email} ahora es ${ROLE_INFO[role].label}.` });
      load();
    } catch (err) { setMsg({ ok: false, text: errMsg(err) }); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead title="Equipo y roles" lead="Quién entra al panel y qué puede ver o hacer. Solo tú das o quitas accesos." />
      {msg && <div className={msg.ok ? 'adm-note' : 'adm-err'} role="status">{msg.text}</div>}

      <div className="adm-grid g-2">
        <form className="adm-card adm-grid" style={{ gap: 12 }} onSubmit={save}>
          <h2 style={{ margin: 0 }}>Dar acceso</h2>
          <label className="adm-field"><span>Nombre</span><input className="adm-input" required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej.: María Pérez" /></label>
          <label className="adm-field"><span>Correo con el que entrará (Google u Outlook)</span><input className="adm-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nombre@correo.com" /></label>
          <fieldset className="adm-grid" style={{ gap: 8, border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 6 }}>Rol</legend>
            {ASSIGNABLE.map((r) => (
              <label key={r} className="adm-roleopt" data-on={form.role === r}>
                <input type="radio" name="role" checked={form.role === r} onChange={() => setForm({ ...form, role: r })} />
                <span><b>{ROLE_INFO[r].label}</b><small>{ROLE_INFO[r].help}</small></span>
              </label>
            ))}
          </fieldset>
          <button type="submit" className="adm-btn solid" disabled={busy || muestra}>{busy ? 'Guardando…' : 'Dar acceso'}</button>
          <small className="muted">Rige al instante. La persona recibe un correo con el enlace a hululec.com/admin. Debe entrar con ese mismo correo.</small>
        </form>

        <section className="adm-card">
          <h2>Qué ve cada rol</h2>
          <div className="adm-table-wrap" style={{ border: 'none' }}>
            <table className="adm-table">
              <thead><tr><th>Sección</th><th>Dueño</th><th>Socio</th><th>Contab.</th><th>UAFE</th></tr></thead>
              <tbody>
                {[
                  ['Resumen ejecutivo', 'sí', 'sí', 'sí', 'ver'],
                  ['Reservas (CRM) y Clientes', 'sí', 'sí', '—', 'ver'],
                  ['Contabilidad y Proveedores', 'sí', 'sí', 'sí', 'ver'],
                  ['Marcar liquidaciones pagadas', 'sí', 'sí', 'sí', '—'],
                  ['Cumplimiento (UAFE)', 'sí', 'sí', '—', 'ver'],
                  ['Reclamos y chats', 'sí', 'sí', '—', '—'],
                  ['Aprobar profesionales', 'sí', 'sí', '—', '—'],
                  ['Equipo y roles', 'sí', '—', '—', '—'],
                ].map(([s, ...v]) => <tr key={s}><td>{s}</td>{v.map((x, i) => <td key={i} style={{ color: x === '—' ? 'var(--muted)' : undefined, fontWeight: x === '—' ? 400 : 700 }}>{x}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="adm-card">
        <h2>Personas con acceso</h2>
        <div className="adm-table-wrap" style={{ border: 'none' }}>
          <table className="adm-table">
            <thead><tr><th>Persona</th><th>Rol</th><th>Desde</th><th>Último ingreso</th><th /></tr></thead>
            <tbody>
              {!team ? <tr><td colSpan={5} className="adm-empty">Cargando…</td></tr> : team.members.map((m) => (
                <tr key={m.email}>
                  <td><b>{m.name || (m.role === 'dueno' ? 'Dueño' : '—')}</b><div className="muted" style={{ fontSize: 12.5 }}>{m.email}</div></td>
                  <td>
                    {m.role === 'dueno' ? <Badge tone={ROLE_TONE.dueno}>{ROLE_INFO.dueno.label}</Badge> : (
                      <select className="adm-select" value={m.role} disabled={busy || muestra} aria-label={`Rol de ${m.email}`} onChange={(e) => changeRole(m.email, m.name, e.target.value as Assignable)}>
                        {ASSIGNABLE.map((r) => <option key={r} value={r}>{ROLE_INFO[r].label}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>{m.role === 'dueno' ? 'Configuración' : fmtWhen(m.addedAt)}</td>
                  <td style={{ fontSize: 13 }}>{m.lastSeen ? fmtWhen(m.lastSeen) : '—'}</td>
                  <td>{m.role !== 'dueno' && <button type="button" className="adm-btn danger" disabled={busy || muestra} onClick={() => remove(m.email)}>Quitar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {team && team.log.length > 0 && (
          <>
            <h3 style={{ margin: '16px 0 8px' }}>Cambios recientes</h3>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4, fontSize: 13 }}>
              {team.log.map((l, i) => <li key={i}>{fmtWhen(l.at)} · {l.by} {l.action === 'rol_asignado' ? `dio a ${l.target} el rol ${ROLE_INFO[l.role as AdminRole]?.label ?? l.role}` : `quitó el acceso de ${l.target}`}</li>)}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
