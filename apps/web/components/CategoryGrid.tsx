import Link from 'next/link';
import { categories } from '@hulul/shared';
import { Icon } from './Icon';

/** Categorías con ícono y nombre, igual que en la app. */
export function CategoryGrid({ city }: { city?: string }) {
  return (
    <div className="cat-grid">
      {categories.map((c) => (
        <Link key={c.slug} href={city ? `/servicios/${c.slug}/${city}` : `/servicios/${c.slug}`} className="cat-tile" title={c.sub}>
          <span className="cat-icon"><Icon name={c.icon} size={28} color="#685943" /></span>
          <strong>{c.tileName ?? c.name}</strong>
        </Link>
      ))}
    </div>
  );
}
