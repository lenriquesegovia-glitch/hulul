import type { ReactNode } from 'react';
import { homeCopy } from '@hulul/shared';
import './home-intro.css';
import { HomeDiscovery as LiveDiscovery } from './HomeDiscovery';

interface Props {
  /** Inject the existing search including suggestions, keyboard and submit logic. */
  search: ReactNode;
  activeBooking?: ReactNode;
  roleChoice?: ReactNode;
  categoryCount: number;
  catalog: ReactNode;
  heroSrc?: string;
}

export function HomeIntro({ search, activeBooking, roleChoice, categoryCount, catalog, heroSrc = '/images/hulul-tranquilidad.webp' }: Props) {
  return <div className="hulul-home">
    {activeBooking && <div className="hh-booking">{activeBooking}</div>}
    <section className="hh-hero" aria-labelledby="hh-title">
      <div className="hh-copy">
        <p className="hh-coverage">{homeCopy.coverage}</p>
        <h1 id="hh-title">¿Qué necesitas<br />resolver <span>hoy?</span></h1>
        <p className="hh-description">{homeCopy.description}</p>
        <p className="hh-process">{homeCopy.process}</p>
        <div className="hh-search">{search}</div>
        <a className="hh-explore" href="#servicios">Explorar los {categoryCount} servicios <span aria-hidden="true">→</span></a>
      </div>
      <figure className="hh-visual">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroSrc} alt="Una mujer disfruta un momento tranquilo en casa" width="960" height="1200" fetchPriority="high" />
        <figcaption>Imagen ilustrativa</figcaption>
      </figure>
    </section>
    {roleChoice}
    <LiveDiscovery />
    <section id="servicios" className="hh-catalog" aria-labelledby="hh-catalog-title" tabIndex={-1}>
      <h2 id="hh-catalog-title">Servicios a domicilio</h2>
      <p>Explora las {categoryCount} categorías. Fotos de referencia.</p>
      {catalog}
    </section>
  </div>;
}
