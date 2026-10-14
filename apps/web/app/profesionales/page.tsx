import type { Metadata } from 'next';
import { COMMISSION_RATE } from '@hulul/shared';
import { JoinForm } from './JoinForm';

export const metadata: Metadata = {
  title: 'Ofrece tus servicios como profesional',
  description:
    'Únete a HULUL y recibe clientes en Guayaquil, Samborondón y Daule. Registro gratuito, tú pones tu precio por hora y cobras directo a tu cuenta.',
  alternates: { canonical: '/profesionales' },
};

const benefits = [
  { t: 'Registro gratis', d: 'Crear tu perfil no cuesta nada. Solo pagas una comisión cuando haces un trabajo.' },
  { t: 'Tú pones tu precio', d: 'Defines tu tarifa por hora, tu reserva mínima y las zonas donde trabajas.' },
  { t: 'Cobro garantizado', d: 'El cliente paga al reservar. Cuando aprueba el trabajo, el dinero va a tu cuenta bancaria.' },
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
        <p className="container muted" style={{ marginTop: 16, fontSize: 14 }}>
          Comisión por servicio: {Math.round(COMMISSION_RATE * 100)}% (valor provisional).
        </p>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 680 }}>
          <div className="card stack gap-24">
            <h2 style={{ fontSize: 26 }}>Déjanos tus datos</h2>
            <JoinForm />
          </div>
        </div>
      </section>
    </>
  );
}
