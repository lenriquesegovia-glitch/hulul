import Link from 'next/link';
import { categories, cities } from '@hulul/shared';
import { Logo } from './Logo';
import { CookieSettingsButton } from './CookieConsent';

export function Footer() {
  const active = cities.filter((c) => c.activa);
  return (
    <footer className="footer">
      <div className="container stack gap-32">
        <div className="footer-grid">
          <div className="stack gap-12">
            <Logo />
            <p className="muted">Soluciones para tu hogar, a domicilio y con pago protegido.</p>
          </div>
          <div>
            <h3>Servicios</h3>
            <ul className="stack gap-8" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {categories.map((c) => (
                <li key={c.slug}><Link href={`/servicios/${c.slug}`}>{c.name}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Ciudades</h3>
            <ul className="stack gap-8" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {active.map((c) => (
                <li key={c.slug}><Link href={`/servicios/climatizacion/${c.slug}`}>{c.name}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h3>HULUL</h3>
            <ul className="stack gap-8" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li><Link href="/profesionales">Ofrece tus servicios</Link></li>
              <li><Link href="/#preguntas">Preguntas frecuentes</Link></li>
              <li><Link href="/legal/terminos">Términos y condiciones</Link></li>
              <li><Link href="/legal/privacidad">Política de privacidad</Link></li>
              <li><Link href="/legal/cookies">Política de cookies</Link></li>
              <li><CookieSettingsButton /></li>
            </ul>
          </div>
        </div>
        <p className="muted">© {new Date().getFullYear()} HULUL · Ecuador</p>
      </div>
    </footer>
  );
}
