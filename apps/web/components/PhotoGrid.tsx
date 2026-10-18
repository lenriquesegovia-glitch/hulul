import Link from 'next/link';
import { categories, categoryImage } from '@hulul/shared';

/** Categorías con foto, para el inicio: más visual que los íconos. */
export function PhotoGrid({ city }: { city?: string }) {
  return (
    <div className="photo-grid">
      {categories.map((c, i) => (
        <Link key={c.slug} href={city ? `/servicios/${c.slug}/${city}` : `/servicios/${c.slug}`} className="photo-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={categoryImage(c.slug, 600)} alt="" loading={i < 4 ? 'eager' : 'lazy'} decoding="async" />
          <span className="photo-shade" />
          <span className="photo-text">
            <strong>{c.name}</strong>
            <span>{c.servicios.slice(0, 2).join(' · ')}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
