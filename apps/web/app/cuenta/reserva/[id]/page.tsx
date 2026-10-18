import type { Metadata } from 'next';
import { BookingDetail } from './BookingDetail';

export const metadata: Metadata = { title: 'Mi reserva', robots: { index: false } };

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <section className="section-sm">
      <div className="container stack gap-24" style={{ maxWidth: 720 }}>
        <BookingDetail id={id} />
      </div>
    </section>
  );
}
