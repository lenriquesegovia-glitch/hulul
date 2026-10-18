import type { Metadata } from 'next';
import { Agenda } from './Agenda';

export const metadata: Metadata = { title: 'Mi agenda de profesional', robots: { index: false } };

export default function AgendaPage() {
  return (
    <section className="section-sm">
      <div className="container stack gap-24" style={{ maxWidth: 820 }}>
        <Agenda />
      </div>
    </section>
  );
}
