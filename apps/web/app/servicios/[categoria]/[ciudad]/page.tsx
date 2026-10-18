import type { Metadata } from 'next';
import Link from 'next/link';
import { Notice } from '@/components/Notice';
import { notFound } from 'next/navigation';
import { categories, cities, getCategory, getCity } from '@hulul/shared';
import { ServicePicker } from '@/components/ServicePicker';
import { DownloadBand } from '@/components/DownloadBand';
import { Faq } from '@/components/Faq';
import { SITE_URL } from '@/lib/site';

type Params = { categoria: string; ciudad: string };

export function generateStaticParams(): Params[] {
  return categories.flatMap((cat) => cities.map((city) => ({ categoria: cat.slug, ciudad: city.slug })));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { categoria, ciudad } = await params;
  const cat = getCategory(categoria);
  const city = getCity(ciudad);
  if (!cat || !city) return {};
  return {
    title: `${cat.seoName} en ${city.name}`,
    description: `Contrata ${cat.name.toLowerCase()} a domicilio en ${city.name}: ${cat.servicios.slice(0, 3).join(', ').toLowerCase()}. Precio por visita visible, profesionales verificados y pago protegido con HULUL.`,
    alternates: { canonical: `/servicios/${cat.slug}/${city.slug}` },
  };
}

export default async function CategoryCityPage({ params }: { params: Promise<Params> }) {
  const { categoria, ciudad } = await params;
  const cat = getCategory(categoria);
  const city = getCity(ciudad);
  if (!cat || !city) notFound();
  const otherCities = cities.filter((c) => c.slug !== city.slug);
  const otherCats = categories.filter((c) => c.slug !== cat.slug);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${cat.seoName} en ${city.name}`,
    serviceType: cat.name,
    areaServed: { '@type': 'City', name: city.name, containedInPlace: { '@type': 'AdministrativeArea', name: city.province } },
    provider: { '@type': 'Organization', name: 'HULUL', url: SITE_URL },
    url: `${SITE_URL}/servicios/${cat.slug}/${city.slug}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="section-sm">
        <div className="container stack gap-16">
          <nav className="breadcrumbs" aria-label="Migas de pan">
            <Link href="/">Inicio</Link><span>/</span>
            <Link href={`/servicios/${cat.slug}`}>{cat.name}</Link><span>/</span>
            <span>{city.name}</span>
          </nav>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', maxWidth: 820 }}>{cat.seoName} en {city.name}</h1>
          <p style={{ fontSize: 17, color: 'var(--text-2)', maxWidth: 700 }}>
            {cat.sub} en {city.zonas.slice(0, 4).join(', ')} y el resto de {city.name}. Reserva al instante, sin presupuestos, y paga solo cuando el trabajo esté bien hecho.
          </p>
          <Notice text={cat.aviso} />
        </div>
      </section>

      <section className="section-sm">
        <div className="container stack gap-24">
          {city.activa ? (
            <ServicePicker cat={cat} city={city.slug} cityName={city.name} />
          ) : (
            <div className="card stack gap-12">
              <h2 style={{ fontSize: 22 }}>
                {city.activa ? `Estamos sumando profesionales de ${cat.name.toLowerCase()} en ${city.name}` : `HULUL llega pronto a ${city.name}`}
              </h2>
              <p className="muted">
                Descarga la app y te avisamos cuando haya profesionales disponibles en tu zona.
              </p>
              <div className="row gap-12" style={{ flexWrap: 'wrap' }}>
                <a href="#descargar" className="btn btn-primary">Avisarme</a>
                <Link href="/profesionales" className="btn btn-ghost">¿Eres profesional en {city.name}?</Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section-sm">
        <div className="container grid-2">
          <div className="card stack gap-12">
            <h2 style={{ fontSize: 20 }}>Siempre incluido en el servicio</h2>
            <ul className="stack gap-8" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {cat.incluye.map((i) => <li key={i} style={{ color: 'var(--text-2)' }}>✓ {i}</li>)}
            </ul>
          </div>
          <div className="card stack gap-12">
            <h2 style={{ fontSize: 20 }}>Zonas que atendemos en {city.name}</h2>
            <div className="link-cloud">
              {city.zonas.map((z) => <span key={z} className="pill pill-warm">{z}</span>)}
            </div>
          </div>
        </div>
      </section>

      <DownloadBand title={`Reserva ${cat.name.toLowerCase()} en ${city.name} sin salir de casa`} />

      <section className="section-sm">
        <div className="container stack gap-24">
          <div className="stack gap-12">
            <h2 style={{ fontSize: 20 }}>{cat.name} en otras ciudades</h2>
            <div className="link-cloud">
              {otherCities.map((c) => <Link key={c.slug} href={`/servicios/${cat.slug}/${c.slug}`}>{cat.name} en {c.name}</Link>)}
            </div>
          </div>
          <div className="stack gap-12">
            <h2 style={{ fontSize: 20 }}>Otros servicios en {city.name}</h2>
            <div className="link-cloud">
              {otherCats.map((c) => <Link key={c.slug} href={`/servicios/${c.slug}/${city.slug}`}>{c.name} en {city.name}</Link>)}
            </div>
          </div>
        </div>
      </section>

      <section className="section-sm">
        <div className="container stack gap-16" style={{ maxWidth: 820 }}>
          <h2 style={{ fontSize: 24 }}>Preguntas frecuentes</h2>
          <Faq />
        </div>
      </section>
    </>
  );
}
