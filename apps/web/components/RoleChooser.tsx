'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { categoryImage } from '@hulul/shared';
import { useUser } from '@/lib/auth';

const KEY = 'hulul-rol';

/**
 * Primera visita: "¿Cómo quieres usar HULUL?" → cliente o profesional, y lleva
 * directo al registro que corresponde. No vuelve a aparecer una vez elegido,
 * ni a quien ya tiene sesión.
 */
export function RoleChooser() {
  const user = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (user === undefined || user) return;
    let seen = false;
    try { seen = !!localStorage.getItem(KEY); } catch { /* sin almacenamiento: se muestra */ }
    if (!seen) setOpen(true);
  }, [user]);

  const choose = (rol: 'cliente' | 'profesional' | 'mirar') => {
    try { localStorage.setItem(KEY, rol); } catch { /* nada */ }
    setOpen(false);
    if (rol === 'cliente') router.push('/cuenta');
    if (rol === 'profesional') router.push('/profesionales/registro');
  };

  if (!open) return null;
  return (
    <div className="role-overlay" role="dialog" aria-modal="true" aria-labelledby="role-title">
      <div className="role-sheet">
        <h2 id="role-title">¿Cómo quieres usar HULUL?</h2>
        <p className="muted">Te llevamos directo a crear tu cuenta.</p>
        <div className="role-options">
          <button type="button" className="role-card" onClick={() => choose('cliente')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={categoryImage('limpieza', 500)} alt="" />
            <span className="role-text"><strong>Necesito un servicio</strong><span>Reserva técnicos y profesionales a domicilio</span></span>
          </button>
          <button type="button" className="role-card" onClick={() => choose('profesional')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={categoryImage('electricidad', 500)} alt="" />
            <span className="role-text"><strong>Quiero ofrecer mis servicios</strong><span>Soy técnico o profesional y quiero recibir trabajos</span></span>
          </button>
        </div>
        <button type="button" className="link-btn" style={{ alignSelf: 'center' }} onClick={() => choose('mirar')}>Solo quiero mirar por ahora</button>
      </div>
    </div>
  );
}
