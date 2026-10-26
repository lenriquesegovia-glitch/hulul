import type { Metadata } from 'next';
import { AppLogin } from './AppLogin';

export const metadata: Metadata = { title: 'Entrar en la app · HULUL', robots: { index: false, follow: false } };

export default function AppLoginPage() {
  return (
    <section className="section-sm">
      <div className="container" style={{ maxWidth: 520 }}>
        <div className="card" style={{ padding: 24 }}>
          <AppLogin />
        </div>
      </div>
    </section>
  );
}
