import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { demoProfessionals, getCategory, getProfessional } from '@hulul/shared';
import { BookingForm } from './BookingForm';

type Params = { id: string };

export function generateStaticParams(): Params[] {
  return demoProfessionals.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const pro = getProfessional(id);
  return pro ? { title: `Reservar a ${pro.name}`, robots: { index: false } } : {};
}

export default async function BookPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const pro = getProfessional(id);
  if (!pro) notFound();
  const cat = getCategory(pro.category)!;

  return (
    <section className="section-sm">
      <div className="container stack gap-24" style={{ maxWidth: 760 }}>
        <nav className="breadcrumbs" aria-label="Migas de pan">
          <Link href="/">Inicio</Link><span>/</span>
          <Link href={`/servicios/${cat.slug}`}>{cat.name}</Link><span>/</span>
          <Link href={`/profesional/${pro.id}`}>{pro.name}</Link><span>/</span>
          <span>Reservar</span>
        </nav>
        <div className="row gap-16">
          <span className="avatar" style={{ width: 56, height: 56, fontSize: 19 }}>{pro.initials}</span>
          <div className="stack gap-4">
            <h1 style={{ fontSize: 'clamp(24px, 3.5vw, 32px)' }}>Reservar a {pro.name}</h1>
            <p className="muted">{cat.name} · ${pro.hourlyRate}/hora · Reserva mínima ${pro.minimumBooking}</p>
          </div>
        </div>
        <BookingForm proId={pro.id} />
      </div>
    </section>
  );
}
