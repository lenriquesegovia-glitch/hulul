import type { Metadata } from 'next';
import Link from 'next/link';
import { ProviderSignup } from './ProviderSignup';

export const metadata: Metadata = {
  title: 'Registro de profesionales',
  description: 'Crea tu cuenta de profesional en HULUL: elige tus servicios, tu tarifa, tus zonas y horario, y sube tus documentos para la verificación.',
  alternates: { canonical: '/profesionales/registro' },
  robots: { index: false },
};

export default function ProviderSignupPage() {
  return (
    <section className="section-sm">
      <div className="container stack gap-24" style={{ maxWidth: 720 }}>
        <nav className="breadcrumbs" aria-label="Migas de pan">
          <Link href="/">Inicio</Link><span>/</span><Link href="/profesionales">Profesionales</Link><span>/</span><span>Registro</span>
        </nav>
        <div className="card">
          <ProviderSignup />
        </div>
      </div>
    </section>
  );
}
