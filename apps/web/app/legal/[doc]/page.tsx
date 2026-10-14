import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookiePolicy, privacyPolicy, PRIVACY_UPDATED, type LegalSection } from '@hulul/shared';
import { LegalDoc } from '@/components/LegalDoc';
import { CookieSettingsButton } from '@/components/CookieConsent';

const docs: Record<string, { title: string; intro: string; sections: LegalSection[] | null }> = {
  privacidad: {
    title: 'Política de privacidad',
    intro: 'Cómo HULUL recoge, usa y protege tus datos personales, y cómo puedes ejercer tus derechos.',
    sections: privacyPolicy,
  },
  cookies: {
    title: 'Política de cookies',
    intro: 'Qué cookies usa el sitio de HULUL y cómo puedes elegir cuáles aceptas.',
    sections: cookiePolicy,
  },
  terminos: {
    title: 'Términos y condiciones',
    intro: 'Documento en preparación. Cubrirá el rol de HULUL como intermediario, reservas y cancelaciones, retención y liberación del pago, reembolsos, comisión al profesional, responsabilidades de cada parte y resolución de disputas.',
    sections: null,
  },
};

type Params = { doc: string };

export function generateStaticParams(): Params[] {
  return Object.keys(docs).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { doc } = await params;
  const d = docs[doc];
  return d ? { title: d.title, description: d.intro, alternates: { canonical: `/legal/${doc}` } } : {};
}

export default async function LegalPage({ params }: { params: Promise<Params> }) {
  const { doc } = await params;
  const d = docs[doc];
  if (!d) notFound();
  return (
    <section className="section-sm">
      <div className="container stack gap-24" style={{ maxWidth: 820 }}>
        <div className="stack gap-12">
          <h1 style={{ fontSize: 'clamp(30px, 4vw, 40px)' }}>{d.title}</h1>
          <p style={{ fontSize: 17, color: 'var(--text-2)' }}>{d.intro}</p>
          {d.sections && <p className="muted" style={{ fontSize: 14 }}>Última actualización: {PRIVACY_UPDATED}</p>}
        </div>
        {d.sections && (
          <div className="card" role="note" style={{ background: 'var(--copper-soft)', borderColor: 'var(--copper-soft)', padding: 16, fontSize: 14 }}>
            Borrador pendiente de revisión legal. Los datos entre corchetes se completarán cuando la empresa esté constituida.
          </div>
        )}
        {doc === 'cookies' && <div><CookieSettingsButton className="btn btn-primary" /></div>}
        {d.sections && <LegalDoc sections={d.sections} />}
      </div>
    </section>
  );
}
