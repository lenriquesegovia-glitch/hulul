'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { discoveryTitle, featuredHomeServices } from '@hulul/shared';

export function HomeDiscovery() {
  const [discovery, setDiscovery] = useState(featuredHomeServices);
  useEffect(() => {
    let active = true;
    import('@hulul/shared/firebase').then(m => m.loadHomeDiscovery()).then(result => { if (active) setDiscovery(result); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return <section className="hh-discovery" aria-labelledby="hh-discovery-title">
    <h2 id="hh-discovery-title">{discoveryTitle(discovery.mode)}</h2>
    <ul>{discovery.items.map(service => <li key={service.id}>
      <Link href={`/servicios/${service.categoryId}`}>{service.label} →</Link>
    </li>)}</ul>
  </section>;
}
