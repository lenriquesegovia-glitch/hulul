import {CitySelector} from './CitySelector';
import {Inbox} from './Inbox';
import Link from 'next/link';
import { Logo } from './Logo';
import { AccountLink } from './AccountLink';

export function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <div className="header-brand"><Logo /><CitySelector /></div>
        <nav className="nav" aria-label="Principal">
          <Link href="/servicios" className="nav-secondary">Servicios</Link>
          <Link href="/#como-funciona" className="nav-secondary">Cómo funciona</Link>
          <Link href="/profesionales" className="nav-pro"><span className="np-full">Soy profesional</span><span className="np-short">Soy pro</span></Link>
          <Link href="/#descargar" className="nav-secondary">Descargar app</Link>
          <Inbox /><AccountLink />
          <Link href="/servicios" className="btn btn-primary nav-reserve">
            Reservar
          </Link>
        </nav>
      </div>
    </header>
  );
}
