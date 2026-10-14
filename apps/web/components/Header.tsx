import Link from 'next/link';
import { Logo } from './Logo';

export function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <Logo />
        <nav className="nav" aria-label="Principal">
          <Link href="/#servicios">Servicios</Link>
          <Link href="/#como-funciona">Cómo funciona</Link>
          <Link href="/profesionales">Soy profesional</Link>
          <Link href="/#descargar" className="btn btn-primary" style={{ minHeight: 44 }}>
            Descargar app
          </Link>
        </nav>
      </div>
    </header>
  );
}
