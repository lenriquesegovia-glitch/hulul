import Link from 'next/link';
import { Logo } from './Logo';

export function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <Logo />
        <nav className="nav" aria-label="Principal">
          <Link href="/#servicios" className="nav-secondary">Servicios</Link>
          <Link href="/#como-funciona" className="nav-secondary">Cómo funciona</Link>
          <Link href="/profesionales" className="nav-pro">Soy profesional</Link>
          <Link href="/#descargar" className="nav-secondary">Descargar app</Link>
          <Link href="/#servicios" className="btn btn-primary" style={{ minHeight: 44 }}>
            Reservar
          </Link>
        </nav>
      </div>
    </header>
  );
}
