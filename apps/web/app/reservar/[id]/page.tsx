import type { Metadata } from 'next';
import { BookingForm } from './BookingForm';

type Params = { id: string };

export const metadata: Metadata = { title: 'Reservar', robots: { index: false } };

export default async function BookPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  return (
    <section className="section-sm">
      <div className="container stack gap-24" style={{ maxWidth: 760 }}>
        <BookingForm proId={id} />
      </div>
    </section>
  );
}
