import type { Metadata } from 'next';
import Link from 'next/link';
import { Faq, faqJsonLd } from '@/components/Faq';

export const metadata: Metadata = {
  title: 'Preguntas frecuentes',
  description: 'Precio, pago, verificación de profesionales, cancelaciones, retrasos, resumen del servicio y calificaciones en HULUL.',
  alternates: { canonical: '/preguntas-frecuentes' },
};

export default function FaqPage() {
  return (
    <section className="section-sm">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <div className="container stack gap-24" style={{ maxWidth: 820 }}>
        <h1 style={{ fontSize: 'clamp(30px, 4vw, 40px)' }}>Preguntas frecuentes</h1>
        <Faq all />
        <p className="muted">El detalle completo está en los <Link href="/legal/terminos">Términos y condiciones</Link>.</p>
      </div>
    </section>
  );
}
