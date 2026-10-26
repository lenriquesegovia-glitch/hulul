import type { Metadata } from 'next';
import { EnterWithPass } from './EnterWithPass';

export const metadata: Metadata = { title: 'Entrando · HULUL', robots: { index: false, follow: false } };

export default function EnterPage() {
  return (
    <section className="section-sm">
      <div className="container" style={{ maxWidth: 520 }}>
        <div className="card" style={{ padding: 24 }}>
          <EnterWithPass />
        </div>
      </div>
    </section>
  );
}
