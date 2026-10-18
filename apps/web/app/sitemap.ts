import type { MetadataRoute } from 'next';
import { categories, cities } from '@hulul/shared';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const url = (path: string) => `${SITE_URL}${path}`;
  return [
    { url: url('/'), lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: url('/profesionales'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    ...categories.map((c) => ({ url: url(`/servicios/${c.slug}`), lastModified: now, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...categories.flatMap((c) =>
      cities.map((city) => ({
        url: url(`/servicios/${c.slug}/${city.slug}`),
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: city.activa ? 0.9 : 0.5,
      })),
    ),
  ];
}
