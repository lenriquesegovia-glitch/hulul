'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cookieCategories } from '@hulul/shared';
import { globalPrivacyControl, OPEN_EVENT, readConsent, saveConsent } from '@/lib/consent';

/**
 * Aviso "Cuidamos tu privacidad". Aparece en la primera visita (o cuando
 * cambia la política) y se puede reabrir desde "Configurar cookies".
 */
export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [gpc, setGpc] = useState(false);
  const [choice, setChoice] = useState({ analitica: false, publicidad: false });

  useEffect(() => {
    setGpc(globalPrivacyControl());
    const current = readConsent();
    if (!current) setOpen(true);
    else setChoice({ analitica: current.analitica, publicidad: current.publicidad });

    const reopen = () => {
      const c = readConsent();
      if (c) setChoice({ analitica: c.analitica, publicidad: c.publicidad });
      setDetails(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  if (!open) return null;

  const finish = (c: { analitica: boolean; publicidad: boolean }) => {
    saveConsent(c);
    setChoice(c);
    setOpen(false);
    setDetails(false);
  };

  return (
    <section aria-labelledby="cookie-title" className="cookie-banner">
      <div className="stack gap-12">
        <h2 id="cookie-title" style={{ fontSize: 19 }}>Cuidamos tu privacidad</h2>
        <p style={{ fontSize: 14.5, color: 'var(--text-2)' }}>
          Usamos cookies necesarias para que el sitio funcione. Con tu permiso, también usamos cookies de analítica para mejorar HULUL y de publicidad para medir nuestras campañas. Puedes cambiar tu elección cuando quieras.{' '}
          <Link href="/legal/cookies">Política de cookies</Link> · <Link href="/legal/privacidad">Política de privacidad</Link>
        </p>
        {gpc && (
          <p style={{ fontSize: 13.5, color: 'var(--success)', fontWeight: 600 }}>
            Tu navegador pide no ser rastreado (Global Privacy Control): dejamos desactivadas la analítica y la publicidad.
          </p>
        )}

        {details && (
          <fieldset className="stack gap-8" style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="muted" style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Elige qué cookies aceptas</legend>
            {cookieCategories.map((cat) => {
              const checked = cat.required ? true : choice[cat.id as 'analitica' | 'publicidad'];
              return (
                <label key={cat.id} className="cookie-option">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={cat.required}
                    onChange={(e) => !cat.required && setChoice((c) => ({ ...c, [cat.id]: e.target.checked }))}
                  />
                  <span className="stack gap-4">
                    <strong style={{ fontSize: 14.5 }}>{cat.name}{cat.required ? ' (siempre activas)' : ''}</strong>
                    <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>{cat.description}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        )}

        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          {details ? (
            <button type="button" className="btn btn-primary" onClick={() => finish(choice)}>Guardar mi elección</button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setDetails(true)}>Configurar</button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => finish({ analitica: false, publicidad: false })}>Rechazar opcionales</button>
          <button type="button" className="btn btn-primary" onClick={() => finish({ analitica: true, publicidad: true })}>Aceptar todas</button>
        </div>
      </div>
    </section>
  );
}

/** Botón para reabrir el aviso, para el pie de página y la política de cookies. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className ?? 'link-button'} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      Configurar cookies
    </button>
  );
}
