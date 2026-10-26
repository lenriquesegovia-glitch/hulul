'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logout, signInWithAppPass } from '@/lib/auth';

/** Páginas a las que la app puede mandar con la sesión iniciada. */
const ALLOWED = ['/profesionales/registro', '/profesionales/agenda', '/cuenta'];

/**
 * hululec.com/entrar?next=/profesionales/registro#token=…
 * La app manda un pase de un solo uso (en el # para que no llegue al servidor);
 * se entra con esa cuenta, se borra el pase de la dirección y se sigue.
 */
export function EnterWithPass() {
  const router = useRouter();
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get('next') ?? '';
    const dest = ALLOWED.includes(next) ? next : '/profesionales/registro';
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    window.history.replaceState(null, '', `/entrar?next=${encodeURIComponent(dest)}`);
    if (!token) { router.replace(dest); return; }
    (async () => {
      try {
        await logout().catch(() => {});
        await signInWithAppPass(token);
        router.replace(dest);
      } catch {
        setMsg('El enlace venció. Entra con tu cuenta para continuar.');
        setTimeout(() => router.replace(dest), 2500);
      }
    })();
  }, [router]);

  return (
    <div className="stack gap-12">
      <h1 style={{ fontSize: 22, margin: 0 }}>{msg ? 'No pudimos abrir tu sesión' : 'Abriendo tu cuenta…'}</h1>
      <p className="muted" style={{ margin: 0 }}>{msg || 'Un momento, te llevamos a tu registro con la misma cuenta de la app.'}</p>
    </div>
  );
}
