'use client';

import './admin.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { canDo, complianceAlerts, periodRange, ROLE_INFO, type AdminPerm, type AdminRole, type DashData, type DateRange, type PeriodKey } from '@hulul/shared/dashboard';
import { SignIn } from '@/components/SignIn';
import { logout, useUser } from '@/lib/auth';

/**
 * Marco del panel de administración: menú lateral, acceso (solo correos en
 * ADMIN_EMAILS, lo valida el servidor) y los datos del tablero, que se cargan
 * una vez y se comparten entre Resumen, Reservas, Clientes, Contabilidad y Proveedores.
 */

interface AdminCtx {
  data: DashData | null;
  /** Datos sin reservas de prueba (demo o profesionales de prueba), salvo que se pidan. */
  view: DashData | null;
  loading: boolean;
  error: string;
  reload: () => void;
  now: number;
  period: PeriodKey;
  setPeriod: (p: PeriodKey) => void;
  custom: DateRange;
  setCustom: (r: DateRange) => void;
  range: DateRange;
  includeTests: boolean;
  setIncludeTests: (v: boolean) => void;
  /** Rol de quien mira (lo decide el servidor en adminTablero). */
  role: AdminRole | null;
  can: (perm: AdminPerm) => boolean;
}

const Ctx = createContext<AdminCtx | null>(null);
export function useAdmin(): AdminCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAdmin fuera del panel');
  return c;
}

const errMsg = (e: unknown) => ((e as { message?: string }).message || 'No se pudo cargar.').replace(/\s*\[\d{3}\]\s*$/, '');

const I = {
  resumen: 'M3 12h4l3-8 4 16 3-8h4',
  reservas: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3 7h3v3H8z',
  clientes: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
  contabilidad: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h5',
  proveedores: 'M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6',
  reclamos: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  profesionales: 'M9 12l2 2 4-4M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3Z',
  cumplimiento: 'M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3ZM9 12h6M12 9v6',
  equipo: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
};
function Ico({ d }: { d: string }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
}

const NAV: { group: string; items: { href: string; label: string; icon: keyof typeof I; perm: AdminPerm; count?: 'claims' | 'pros' | 'alerts' }[] }[] = [
  { group: 'Gestión', items: [
    { href: '/admin', label: 'Resumen ejecutivo', icon: 'resumen', perm: 'tablero' },
    { href: '/admin/reservas', label: 'Reservas (CRM)', icon: 'reservas', perm: 'reservas' },
    { href: '/admin/clientes', label: 'Clientes', icon: 'clientes', perm: 'clientes' },
  ] },
  { group: 'Finanzas', items: [
    { href: '/admin/contabilidad', label: 'Contabilidad', icon: 'contabilidad', perm: 'contabilidad' },
    { href: '/admin/proveedores', label: 'Proveedores', icon: 'proveedores', perm: 'proveedores' },
  ] },
  { group: 'Control', items: [
    { href: '/admin/cumplimiento', label: 'Cumplimiento (UAFE)', icon: 'cumplimiento', perm: 'cumplimiento', count: 'alerts' },
    { href: '/admin/reclamos', label: 'Reclamos', icon: 'reclamos', perm: 'reclamos', count: 'claims' },
    { href: '/admin/profesionales', label: 'Aprobar profesionales', icon: 'profesionales', perm: 'profesionales', count: 'pros' },
    { href: '/admin/equipo', label: 'Equipo y roles', icon: 'equipo', perm: 'equipo' },
  ] },
];

/** Permiso que exige cada ruta del panel. */
const permOfPath = (path: string): AdminPerm => {
  const item = NAV.flatMap((g) => g.items).filter((i) => i.href !== '/admin').find((i) => path.startsWith(i.href));
  return item?.perm ?? 'tablero';
};

/** Solo en `next dev` con NEXT_PUBLIC_ADMIN_MUESTRA=1: datos de muestra sin iniciar sesión (no existe en producción). */
const MUESTRA = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ADMIN_MUESTRA === '1';

const MUESTRA_USER = { email: 'muestra@hululec.com' };
const MUESTRA_ROL = (process.env.NEXT_PUBLIC_ADMIN_ROL || 'dueno') as AdminRole;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const realUser = useUser();
  const user = MUESTRA ? (MUESTRA_USER as unknown as typeof realUser) : realUser;
  const path = usePathname() ?? '/admin';
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [period, setPeriodState] = useState<PeriodKey>('mes');
  const [custom, setCustom] = useState<DateRange>({ from: '', to: '' });
  const [includeTests, setIncludeTests] = useState(false);
  const [menu, setMenu] = useState(false);
  const asked = useRef('');

  useEffect(() => {
    try {
      const p = localStorage.getItem('hulul-admin-period') as PeriodKey | null;
      if (p && p !== 'personalizado') setPeriodState(p);
    } catch { /* sin almacenamiento */ }
  }, []);
  const setPeriod = useCallback((p: PeriodKey) => {
    setPeriodState(p);
    try { localStorage.setItem('hulul-admin-period', p); } catch { /* sin almacenamiento */ }
  }, []);

  // «Todo» = lo cargado del servidor (para que los archivos digan fechas reales).
  const range = useMemo(() => (period === 'todo' && data ? data.range : periodRange(period, now, custom)), [period, now, custom, data]);

  const load = useCallback(async (want?: DateRange) => {
    setLoading(true); setError('');
    try {
      const d: DashData = MUESTRA
        ? { ...(await (await fetch('/muestra-tablero.json')).json()), viewer: { email: 'muestra@hululec.com', role: MUESTRA_ROL } }
        : await (await import('@hulul/shared/firebase')).adminDashboard(want ? { desde: want.from, hasta: want.to } : undefined);
      setData(d);
      setNow(MUESTRA ? d.generatedAt : Date.now());
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);
  useEffect(() => { setMenu(false); }, [path]);

  // Si el periodo pedido sale de lo cargado (p. ej. fechas antiguas), se vuelve a pedir.
  useEffect(() => {
    if (!data || loading || period === 'todo') return;
    if (range.from < data.range.from || range.to > data.range.to) {
      const key = `${range.from}_${range.to}`;
      if (asked.current === key) return; // el servidor limita el rango: no insistir
      asked.current = key;
      load({ from: range.from < data.range.from ? range.from : data.range.from, to: range.to > data.range.to ? range.to : data.range.to });
    }
  }, [range, data, loading, period, load]);

  const view = useMemo<DashData | null>(() => {
    if (!data) return null;
    if (includeTests) return data;
    const testers = new Set(data.providers.filter((p) => p.tester).map((p) => p.uid));
    const bookings = data.bookings.filter((b) => !b.demo && !testers.has(b.proId));
    return {
      ...data,
      bookings,
      ledger: data.ledger.filter((e) => !testers.has(e.proId)),
      payouts: data.payouts.filter((p) => !testers.has(p.proId)),
      providers: data.providers.filter((p) => !p.tester),
      claims: data.claims.filter((c) => !testers.has(c.proId)),
    };
  }, [data, includeTests]);

  const counts = useMemo(() => ({
    claims: data?.claims.filter((c) => c.status !== 'resuelto').length ?? 0,
    pros: data?.providers.filter((p) => p.status === 'en_revision').length ?? 0,
    alerts: data && canDo(data.viewer?.role, 'cumplimiento') ? complianceAlerts(data, periodRange('ultimos_30', now)).filter((a) => a.level === 'alta').length : 0,
  }), [data, now]);

  const role = data?.viewer?.role ?? null;
  const can = useCallback((perm: AdminPerm) => canDo(role, perm), [role]);
  const ctx: AdminCtx = { data, view, loading, error, reload: () => load(data?.range ? { from: data.range.from, to: data.range.to } : undefined), now, period, setPeriod, custom, setCustom, range, includeTests, setIncludeTests, role, can };

  if (user === undefined) return <div className="adm"><div /><main className="adm-main"><div className="adm-skel" /></main></div>;
  if (!user) {
    return (
      <div className="adm" style={{ gridTemplateColumns: '1fr' }}>
        <main className="adm-main" style={{ maxWidth: 520, margin: '40px auto' }}>
          <SignIn title="Panel de administración" lead="Entra con la cuenta de HULUL autorizada." />
        </main>
      </div>
    );
  }

  // Sin rol: el servidor rechazó el acceso.
  if (!data && error && /acceso|rol|autorizad|verificado/i.test(error)) {
    return (
      <div className="adm" style={{ gridTemplateColumns: '1fr' }}>
        <main className="adm-main" style={{ maxWidth: 520, margin: '40px auto' }}>
          <div className="adm-card adm-grid" style={{ gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 22 }}>Sin acceso al panel</h1>
            <p style={{ margin: 0 }}>{error}</p>
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Entraste como <b>{user.email}</b>. Si te dieron acceso con otro correo, sal y entra con ese.</p>
            <button type="button" className="adm-btn solid" style={{ justifySelf: 'start' }} onClick={() => logout()}>Salir</button>
          </div>
        </main>
      </div>
    );
  }

  const allowed = !role || can(permOfPath(path));
  const active = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href));

  return (
    <Ctx.Provider value={ctx}>
      <div className="adm">
        <div className="adm-mobilebar">
          <button type="button" aria-label="Abrir el menú" onClick={() => setMenu(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <b>HULUL</b><span style={{ opacity: .7, fontSize: 13 }}>Administración</span>
        </div>
        {menu && <div className="adm-drawer-bg" style={{ zIndex: 55 }} onClick={() => setMenu(false)} />}
        <aside className={`adm-side${menu ? ' open' : ''}`} aria-label="Menú del panel">
          <Link href="/admin" className="adm-brand">
            <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#fff" /><path d="M9 23V12m14 11V12M9 17.5h14M7 12l9-6 9 6" stroke="#0B2F33" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span><b>HULUL</b><small>Administración</small></span>
          </Link>
          {NAV.map((g) => ({ ...g, items: g.items.filter((it) => !role || can(it.perm)) })).filter((g) => g.items.length > 0).map((g) => (
            <nav key={g.group} aria-label={g.group} style={{ display: 'grid', gap: 2 }}>
              <div className="adm-group">{g.group}</div>
              {g.items.map((it) => (
                <Link key={it.href} href={it.href} className="adm-link" aria-current={active(it.href) ? 'page' : undefined}>
                  <Ico d={I[it.icon]} />{it.label}
                  {it.count && counts[it.count] > 0 && <span className="adm-count">{counts[it.count]}</span>}
                </Link>
              ))}
            </nav>
          ))}
          <div className="adm-side-foot">
            <span>{user.email}</span>
            {role && <span className="adm-role">{ROLE_INFO[role].label}</span>}
            <Link href="/" style={{ color: '#fff', fontWeight: 700, textDecoration: 'none' }}>Ver hululec.com</Link>
            <button type="button" onClick={() => logout()}>Salir</button>
          </div>
        </aside>
        <main className="adm-main">
          {allowed ? children : (
            <div className="adm-card adm-grid" style={{ gap: 10, maxWidth: 560 }}>
              <h1 style={{ margin: 0, fontSize: 22 }}>Esta sección no es para tu rol</h1>
              <p style={{ margin: 0 }}>Tu rol es <b>{role ? ROLE_INFO[role].label : '—'}</b>: {role ? ROLE_INFO[role].help : ''}</p>
              <Link className="adm-btn" style={{ justifySelf: 'start' }} href="/admin">Ir al resumen</Link>
            </div>
          )}
        </main>
      </div>
    </Ctx.Provider>
  );
}
