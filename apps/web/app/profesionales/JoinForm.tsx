'use client';

import { useState } from 'react';
import Link from 'next/link';
import { categories, cities } from '@hulul/shared';

/**
 * Formulario de registro de profesionales.
 * Pendiente: guardar la solicitud en Firestore (colección `applications`)
 * cuando se conecte Firebase. Por ahora solo confirma en pantalla.
 * Al guardarla, registrar también la aceptación como prueba del
 * consentimiento: fecha, PRIVACY_VERSION y si aceptó promociones.
 */
export function JoinForm() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="stack gap-8" role="status">
        <strong style={{ fontSize: 18 }}>¡Gracias! Recibimos tus datos.</strong>
        <p className="muted">Te contactaremos por WhatsApp para verificar tu perfil.</p>
      </div>
    );
  }

  return (
    <form
      className="stack gap-16"
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
    >
      <div className="field">
        <label htmlFor="nombre">Nombre completo o de tu empresa</label>
        <input id="nombre" name="nombre" required autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="celular">Celular (WhatsApp)</label>
        <input id="celular" name="celular" type="tel" inputMode="tel" placeholder="09XXXXXXXX" required pattern="0?9[0-9]{8}" autoComplete="tel" />
      </div>
      <div className="field">
        <label htmlFor="servicio">Servicio que ofreces</label>
        <select id="servicio" name="servicio" required defaultValue="">
          <option value="" disabled>Elige una categoría</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="ciudad">Ciudad</label>
        <select id="ciudad" name="ciudad" required defaultValue="">
          <option value="" disabled>Elige tu ciudad</option>
          {cities.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="experiencia">Cuéntanos tu experiencia</label>
        <textarea id="experiencia" name="experiencia" rows={4} />
      </div>

      <div className="stack gap-12" style={{ paddingTop: 4 }}>
        <label className="check">
          <input type="checkbox" name="acepta_privacidad" required />
          <span>
            He leído y acepto la <Link href="/legal/privacidad" target="_blank">Política de privacidad</Link> y los{' '}
            <Link href="/legal/terminos" target="_blank">Términos y condiciones</Link>. Autorizo a HULUL a tratar mis datos para revisar mi solicitud y verificar mi perfil.
          </span>
        </label>
        <label className="check">
          <input type="checkbox" name="acepta_promociones" />
          <span>Quiero recibir novedades y promociones de HULUL (opcional).</span>
        </label>
      </div>

      <button type="submit" className="btn btn-primary">Quiero ser profesional HULUL</button>
    </form>
  );
}
