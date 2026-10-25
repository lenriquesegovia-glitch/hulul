import type { MetadataRoute } from 'next';
import { DEMO_MODE, SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  if (DEMO_MODE) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/buscar', '/admin'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
