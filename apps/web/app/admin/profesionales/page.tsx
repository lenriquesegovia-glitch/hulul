import type { Metadata } from 'next';
import { ProsPanel } from './ProsPanel';

export const metadata: Metadata = { title: 'Profesionales · HULUL', robots: { index: false, follow: false } };

export default function ProsAdminPage() {
  return (
    <section className="section-sm">
      <div className="container stack gap-24" style={{ maxWidth: 1080 }}>
        <ProsPanel />
      </div>
    </section>
  );
}
