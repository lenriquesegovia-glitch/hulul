import Link from 'next/link';
import { categories } from '@hulul/shared';
import { Icon } from './Icon';

export function CategoryGrid({ city }: { city?: string }) {
  return (
    <div className="cat-grid">
      {categories.map((c) => (
        <Link key={c.slug} href={city ? `/servicios/${c.slug}/${city}` : `/servicios/${c.slug}`} className="cat-tile">
          <span className="cat-icon"><Icon name={c.icon} size={26} color="#9A5B34" /></span>
          <strong>{c.name}</strong>
          <span>{c.sub}</span>
        </Link>
      ))}
    </div>
  );
}
