import type { Metadata } from 'next';
import { ClaimsPanel } from './ClaimsPanel';

export const metadata: Metadata = { title: 'Reclamos · HULUL', robots: { index: false, follow: false } };

export default function ClaimsPage() {
  return (
    <section className="section-sm">
      <div className="container stack gap-24" style={{ maxWidth: 1080 }}>
        <ClaimsPanel />
      </div>
    </section>
  );
}
