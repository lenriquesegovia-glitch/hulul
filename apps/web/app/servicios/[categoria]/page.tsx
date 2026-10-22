import type { Metadata } from 'next';
import Link from 'next/link';
import { Notice } from '@/components/Notice';
import { notFound } from 'next/navigation';
import { categories, categoryImage, cities, getCategory } from '@hulul/shared';
import { ServicePicker } from '@/components/ServicePicker';
import { DownloadBand } from '@/components/DownloadBand';
import { Icon } from '@/components/Icon';

type Params = { categoria: string };

export function generateStaticParams(): Params[] {
  return categories.map((c) => ({ categoria: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { categoria } = await params;
  const cat = getCategory(categoria);
  if (!cat) return {};
  return {
    title: `${cat.seoName} en Ecuador`,
    description: `${cat.sub}. Reserva ${cat.name.toLowerCase()} a domicilio en Guayaquil, Samborondón y Daule con precio por visita y pago protegido.`,
    alternates: { canonical: `/servicios/${cat.slug}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { categoria } = await params;
  const cat = getCategory(categoria);
  if (!cat) notFound();

  return (
    <>
      <section className="section-sm">
        <div className="container stack gap-16">
          <nav className="breadcrumbs" aria-label="Migas de pan">
            <Link href="/">Inicio</Link><span>/</span><span>{cat.name}</span>
          </nav>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cat-hero" src={categoryImage(cat.slug, 1200)} alt={cat.seoName} />
          <div className="row gap-16">
            <span className="cat-icon" style={{ width: 60, height: 60 }}><Icon name={cat.icon} size={32} color="#685943" /></span>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>{cat.seoName}</h1>
          </div>
          <p style={{ fontSize: 17, color: 'var(--text-2)', maxWidth: 680 }}>{cat.sub}. Elige tu ciudad para ver a los profesionales disponibles.</p>
          <Notice text={cat.aviso} />
          <div className="link-cloud">
            {cities.filter((c) => c.activa).map((c) => (
              <Link key={c.slug} href={`/servicios/${cat.slug}/${c.slug}`}>{c.name}</Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section-sm" style={{ paddingTop: 0 }}>
        <div className="container">
          <ServicePicker cat={cat} />
        </div>
      </section>

      <DownloadBand />
    </>
  );
}
