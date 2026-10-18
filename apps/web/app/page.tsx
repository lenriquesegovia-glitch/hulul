import Link from 'next/link';
import { categories, cities } from '@hulul/shared';
import { PhotoGrid } from '@/components/PhotoGrid';
import { ActiveBooking } from '@/components/ActiveBooking';
import { ProBand } from '@/components/ProBand';
import { RoleChooser } from '@/components/RoleChooser';
import { DownloadBand } from '@/components/DownloadBand';
import { Faq } from '@/components/Faq';
import { Icon } from '@/components/Icon';
import { HeroArt } from '@/components/HeroArt';
import { SearchBox } from '@/components/SearchBox';

const steps = [
  { n: '1', t: 'Elige el servicio', d: 'Busca lo que necesitas y compara profesionales por precio, reseñas y disponibilidad.' },
  { n: '2', t: 'Reserva y paga', d: 'Elige día, hora y cuántas horas. Ves el total antes de pagar con tarjeta, transferencia o DeUna.' },
  { n: '3', t: 'Aprueba el trabajo', d: 'Sigue al profesional en la app. El pago se libera cuando confirmas que todo quedó bien.' },
];

const promises = [
  { icon: 'shield' as const, t: 'Profesionales verificados' },
  { icon: 'clock' as const, t: 'Precio claro, sin presupuestos' },
  { icon: 'card' as const, t: 'Pago protegido' },
];

export default function HomePage() {
  const active = cities.filter((c) => c.activa);
  return (
    <>

      <RoleChooser />
      <ActiveBooking />
      <section className="hero">
        <div className="container hero-grid">
        <div className="stack gap-24">
          <span className="eyebrow">Guayaquil · Samborondón · Daule</span>
          <h1>¿Qué necesitas resolver hoy en tu hogar?</h1>
          <SearchBox />
          <ul className="trust-row" aria-label="Por qué HULUL">
            {promises.map((p) => (
              <li key={p.t}><Icon name={p.icon} size={18} color="#9A5B34" strokeWidth={2} />{p.t}</li>
            ))}
          </ul>
        </div>
        <HeroArt />
        </div>
      </section>

      <section id="servicios" className="section-sm">
        <div className="container stack gap-24">
          <h2 style={{ fontSize: 30 }}>Servicios a domicilio</h2>
          <PhotoGrid />
        </div>
      </section>

      <ProBand />

      <section id="como-funciona" className="section" style={{ background: 'var(--surface-warm)' }}>
        <div className="container stack gap-32">
          <h2 style={{ fontSize: 30 }}>Cómo funciona</h2>
          <div className="grid-3">
            {steps.map((s) => (
              <div key={s.n} className="stack gap-12">
                <span className="avatar" style={{ width: 44, height: 44, background: 'var(--primary)', color: '#fff' }}>{s.n}</span>
                <h3 style={{ fontSize: 19 }}>{s.t}</h3>
                <p style={{ color: 'var(--text-2)' }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DownloadBand />

      <section className="section">
        <div className="container stack gap-16">
          <h2 style={{ fontSize: 24 }}>Servicios populares por ciudad</h2>
          <div className="link-cloud">
            {active.flatMap((city) =>
              categories.slice(0, 5).map((cat) => (
                <Link key={`${cat.slug}-${city.slug}`} href={`/servicios/${cat.slug}/${city.slug}`}>
                  {cat.name} en {city.name}
                </Link>
              )),
            )}
          </div>
        </div>
      </section>

      <section id="preguntas" className="section" style={{ paddingTop: 0 }}>
        <div className="container stack gap-16" style={{ maxWidth: 820 }}>
          <h2 style={{ fontSize: 30 }}>Preguntas frecuentes</h2>
          <Faq />
          <Link href="/preguntas-frecuentes" className="link-btn" style={{ alignSelf: 'flex-start', textDecoration: 'none' }}>Ver todas las preguntas →</Link>
        </div>
      </section>
    </>
  );
}
