import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

const docs = {
  terminos: {
    title: 'Términos y condiciones',
    body: 'Documento en preparación. Debe redactarlo un abogado y cubrir: rol de HULUL como intermediario, reservas y cancelaciones, retención y liberación del pago, reembolsos, comisión al profesional, responsabilidades de cada parte y resolución de disputas.',
  },
  privacidad: {
    title: 'Política de privacidad',
    body: 'Documento en preparación. Debe cumplir la Ley Orgánica de Protección de Datos Personales del Ecuador: qué datos se recogen (identidad, ubicación, pagos), para qué, con quién se comparten (pasarela de pago, profesionales), cuánto tiempo se guardan y cómo ejercer los derechos de acceso, rectificación y eliminación.',
  },
} as const;

type Params = { doc: string };

export function generateStaticParams(): Params[] {
  return Object.keys(docs).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { doc } = await params;
  const d = docs[doc as keyof typeof docs];
  return d ? { title: d.title, robots: { index: false } } : {};
}

export default async function LegalPage({ params }: { params: Promise<Params> }) {
  const { doc } = await params;
  const d = docs[doc as keyof typeof docs];
  if (!d) notFound();
  return (
    <section className="section">
      <div className="container stack gap-16" style={{ maxWidth: 760 }}>
        <h1 style={{ fontSize: 34 }}>{d.title}</h1>
        <p style={{ color: 'var(--text-2)' }}>{d.body}</p>
      </div>
    </section>
  );
}
