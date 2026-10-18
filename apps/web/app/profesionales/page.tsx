import type { Metadata } from 'next';
import { categories, CATEGORY_FLOORS, COMMISSION_RATE } from '@hulul/shared';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Ofrece tus servicios como profesional',
  description:
    'Únete a HULUL y recibe clientes en Guayaquil, Samborondón y Daule. Registro gratuito, tú pones tu precio por hora y cobras directo a tu cuenta.',
  alternates: { canonical: '/profesionales' },
};

const benefits = [
  { t: 'Registro gratis', d: 'Crear tu perfil no cuesta nada. Solo pagas una comisión cuando haces un trabajo.' },
  { t: 'Tú pones tu precio', d: 'Defines tu tarifa por hora y tus horas mínimas (respetando el mínimo de cada oficio), tus zonas y tu horario.' },
  { t: 'Cobro garantizado', d: 'Con tarjeta, el pago queda retenido al reservar y se te transfiere cada semana. También puedes aceptar efectivo.' },
  { t: 'Tu agenda en el celular', d: 'Acepta o rechaza solicitudes y activa tu disponibilidad cuando quieras.' },
];

export default function ProfessionalsPage() {
  return (
    <>
      <section className="hero">
        <div className="container stack gap-16">
          <span className="eyebrow">Para profesionales</span>
          <h1>Más clientes para tu oficio, sin intermediarios informales</h1>
          <p className="lead">
            Técnicos, plomeros, electricistas, personal de limpieza, estilistas y profesores: publica tus servicios en HULUL y recibe reservas pagadas.
          </p>
        </div>
      </section>

      <section className="section-sm">
        <div className="container grid-2">
          {benefits.map((b) => (
            <div key={b.t} className="card stack gap-8">
              <h2 style={{ fontSize: 19 }}>{b.t}</h2>
              <p className="muted">{b.d}</p>
            </div>
          ))}
        </div>
        <div className="container stack gap-12" style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 24 }}>Cuánto cobras</h2>
          <p className="muted" style={{ fontSize: 15 }}>
            Tú pones tu tarifa por hora, desde el mínimo de tu oficio. Además, cada trabajo lleva una visita técnica fija por categoría
            (traslado y diagnóstico), que es para ti. HULUL retiene una comisión del {Math.round(COMMISSION_RATE * 100)} % de cada servicio.
          </p>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="price-table">
              <thead><tr><th>Categoría</th><th>Visita técnica</th><th>Tarifa mínima</th><th>Horas mínimas</th></tr></thead>
              <tbody>
                {categories.map((c) => {
                  const f = CATEGORY_FLOORS[c.slug];
                  return (
                    <tr key={c.slug}>
                      <td>{c.name}</td>
                      <td>{f.visit > 0 ? `$${f.visit}` : '—'}</td>
                      <td>${f.rate}/h</td>
                      <td>{f.hours} h</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 680 }}>
          <div className="card stack gap-24">
            <h2 style={{ fontSize: 26 }}>Regístrate en 10 minutos</h2>
            <ol className="stack gap-8" style={{ margin: 0, paddingLeft: 20, color: 'var(--text-2)' }}>
              <li>Crea tu cuenta con Google o tu celular.</li>
              <li>Elige tus servicios, tu tarifa por hora, tus zonas y tu horario.</li>
              <li>Sube tu cédula, una foto de tu rostro y tu certificado de antecedentes penales.</li>
              <li>Te revisamos en 1 a 3 días hábiles y empiezas a recibir trabajos.</li>
            </ol>
            <Link href="/profesionales/registro" className="btn btn-primary" style={{ minHeight: 54, fontSize: 16 }}>Empezar mi registro</Link>
          </div>
        </div>
      </section>
    </>
  );
}
