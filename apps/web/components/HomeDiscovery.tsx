'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { categoryImage, getCategory, discoveryTitle, featuredHomeServices } from '@hulul/shared';

export function HomeDiscovery() {
  const [discovery, setDiscovery] = useState(featuredHomeServices);
  useEffect(() => {
    let active = true;
    import('@hulul/shared/firebase').then(m => m.loadHomeDiscovery()).then(result => { if (active) setDiscovery(result); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return <section className="hh-discovery" aria-labelledby="hh-discovery-title">
    <h2 id="hh-discovery-title">{discoveryTitle(discovery.mode)}</h2>
    <ul>{discovery.items.map(service => {
      const category = getCategory(service.categoryId);
      if (!category) return null;
      return <li key={service.id}>
        <Link href={`/servicios/${service.categoryId}/profesionales?trabajo=${encodeURIComponent(service.label)}`} className="hh-featured-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={categoryImage(category.slug, 600)} alt="" loading="lazy" decoding="async" width="600" height="400" />
          <span><strong>{service.label}</strong><span aria-hidden="true">→</span></span>
        </Link>
      </li>;
    })}</ul>
    {discovery.mode !== 'popular' && <p className="hh-photo-note">Estamos reuniendo solicitudes de esta semana. Mientras tanto, explora esta selección.</p>}
    <p className="hh-photo-note">Fotos de referencia</p>
  </section>;
}
