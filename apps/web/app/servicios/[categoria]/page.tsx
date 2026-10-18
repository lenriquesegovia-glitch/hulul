import type { Metadata } from 'next';
import Link from 'next/link';
import { Notice } from '@/components/Notice';
import { notFound } from 'next/navigation';
import { categories, cities, getCategory, prosByCategory } from '@hulul/shared';
import { ProCard } from '@/components/ProCard';
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
    description: `${cat.sub}. Reserva ${cat.name.toLowerCase()} a domicilio en Guayaquil, Samborondón y Daule con precio por hora y pago protegido.`,
    alternates: { canonical: `/servicios/${cat.slug}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { categoria } = await params;
  const cat = getCategory(categoria);
  if (!cat) notFound();
  const pros = prosByCategory(cat.slug);

  return (
    <>
      <section className="section-sm">
        <div className="container stack gap-16">
          <nav className="breadcrumbs" aria-label="Migas de pan">
            <Link href="/">Inicio</Link><span>/</span><span>{cat.name}</span>
          </nav>
          <div className="row gap-16">
            <span className="cat-icon" style={{ width: 60, height: 60 }}><Icon name={cat.icon} size={32} color="#9A5B34" /></span>
            <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>{cat.seoName}</h1>
          </div>
          <p style={{ fontSize: 17, color: 'var(--text-2)', maxWidth: 680 }}>{cat.sub}. Elige tu ciudad para ver a los profesionales disponibles.</p>
          <Notice text={cat.aviso} />
          <div className="link-cloud">
            {cities.map((c) => (
              <Link key={c.slug} href={`/servicios/${cat.slug}/${c.slug}`}>{c.name}</Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section-sm">
        <div className="container stack gap-24">
          <h2 style={{ fontSize: 24 }}>Profesionales destacados</h2>
          <div className="grid-2">
            {pros.map((p) => <ProCard key={p.id} pro={p} />)}
          </div>
        </div>
      </section>

      <section className="section-sm">
        <div className="container stack gap-12">
          <h2 style={{ fontSize: 22 }}>Lo más solicitado en {cat.name.toLowerCase()}</h2>
          <div className="link-cloud">
            {cat.servicios.map((s) => <span key={s} className="pill pill-warm">{s}</span>)}
          </div>
          <p className="muted" style={{ fontSize: 14.5 }}>
            ¿Necesitas otro trabajo de {cat.name.toLowerCase()}? Descríbelo al reservar y el profesional lo revisa contigo.
          </p>
        </div>
      </section>

      <DownloadBand />
    </>
  );
}
