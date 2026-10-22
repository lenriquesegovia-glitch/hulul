import Link from 'next/link';
import { categoryImage, COMMISSION_RATE } from '@hulul/shared';

/** Bloque para profesionales y técnicos en el inicio. */
export function ProBand() {
  return (
    <section className="section-sm">
      <div className="container">
        <div className="pro-band">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={categoryImage('electricidad', 900)} alt="" loading="lazy" />
          <div className="pro-band-text">
            <span className="eyebrow" style={{ color: '#E8DFCF' }}>Para técnicos y profesionales</span>
            <h2>¿Eres técnico o profesional? Gana más con HULUL</h2>
            <ul>
              <li>Registro gratis: solo pagas {Math.round(COMMISSION_RATE * 100)} % cuando haces un trabajo.</li>
              <li>Tú pones tu tarifa por visita, tus zonas y tu horario.</li>
              <li>Clientes de Guayaquil, Samborondón y Daule, con pago garantizado.</li>
            </ul>
            <div className="row gap-12" style={{ flexWrap: 'wrap' }}>
              <Link href="/profesionales/registro" className="btn btn-primary" style={{ background: '#fff', color: 'var(--primary)' }}>Regístrate gratis</Link>
              <Link href="/profesionales" className="btn" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.4)' }}>Cómo funciona</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
