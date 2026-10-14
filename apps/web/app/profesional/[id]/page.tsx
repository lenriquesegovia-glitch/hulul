import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { demoProfessionals, demoReviews, formatRating, getCategory, getProfessional } from '@hulul/shared';
import { DownloadBand } from '@/components/DownloadBand';
import { Icon } from '@/components/Icon';

type Params = { id: string };

export function generateStaticParams(): Params[] {
  return demoProfessionals.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const pro = getProfessional(id);
  if (!pro) return {};
  const cat = getCategory(pro.category);
  return {
    title: `${pro.name} · ${cat?.name ?? ''} a domicilio`,
    description: pro.bio,
    alternates: { canonical: `/profesional/${pro.id}` },
  };
}

export default async function ProfessionalPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const pro = getProfessional(id);
  if (!pro) notFound();
  const cat = getCategory(pro.category)!;

  return (
    <>
      <section className="section-sm">
        <div className="container stack gap-24" style={{ maxWidth: 880 }}>
          <nav className="breadcrumbs" aria-label="Migas de pan">
            <Link href="/">Inicio</Link><span>/</span>
            <Link href={`/servicios/${cat.slug}`}>{cat.name}</Link><span>/</span>
            <span>{pro.name}</span>
          </nav>

          <div className="row gap-24" style={{ flexWrap: 'wrap' }}>
            <span className="avatar" style={{ width: 96, height: 96, fontSize: 30 }}>{pro.initials}</span>
            <div className="stack gap-8">
              <h1 className="row gap-8" style={{ fontSize: 32 }}>
                {pro.name}
                {pro.verified && <Icon name="shield" size={24} color="#9A5B34" label="Verificado" />}
              </h1>
              <p className="muted">{cat.name} · {pro.zone}{pro.isCompany ? ' · Perfil empresa' : ''}</p>
              {pro.availableToday && <span className="pill pill-success" style={{ alignSelf: 'flex-start' }}>Disponible hoy</span>}
            </div>
          </div>

          <Link href={`/reservar/${pro.id}`} className="btn btn-primary" style={{ alignSelf: 'flex-start', minHeight: 52, fontSize: 16 }}>
            Reservar ahora · ${pro.hourlyRate}/hora
          </Link>

          <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div className="card" style={{ textAlign: 'center' }}><div className="price">★ {formatRating(pro.rating)}</div><div className="muted">{pro.reviewCount} reseñas</div></div>
            <div className="card" style={{ textAlign: 'center' }}><div className="price">{pro.jobsDone}</div><div className="muted">servicios</div></div>
            <div className="card" style={{ textAlign: 'center' }}><div className="price">{pro.years}</div><div className="muted">años de experiencia</div></div>
            <div className="card" style={{ textAlign: 'center' }}><div className="price">${pro.hourlyRate}/h</div><div className="muted">Reserva mín. ${pro.minimumBooking}</div></div>
          </div>

          <div className="stack gap-8">
            <h2 style={{ fontSize: 22 }}>Sobre {pro.isCompany ? 'nosotros' : 'mí'}</h2>
            <p style={{ color: 'var(--text-2)' }}>{pro.bio}</p>
          </div>

          <div className="stack gap-8">
            <h2 style={{ fontSize: 22 }}>Qué incluye</h2>
            <ul className="stack gap-8" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {cat.incluye.map((i) => <li key={i} style={{ color: 'var(--text-2)' }}>✓ {i}</li>)}
            </ul>
          </div>

          <div className="stack gap-12">
            <h2 style={{ fontSize: 22 }}>Reseñas</h2>
            {/* Reseñas de ejemplo: se reemplazan por las reales de Firestore. */}
            {demoReviews.map((r) => (
              <div key={r.clientName} className="card stack gap-8">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{r.clientName} · {r.zone}</strong>
                  <span>{'★'.repeat(r.rating)}</span>
                </div>
                <p style={{ color: 'var(--text-2)' }}>{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="section-sm">
        <div className="container" style={{ maxWidth: 880 }}>
          <Link href={`/reservar/${pro.id}`} className="btn btn-primary" style={{ width: '100%', minHeight: 54, fontSize: 16 }}>
            Reservar a {pro.name}
          </Link>
        </div>
      </section>
      <DownloadBand />
    </>
  );
}
