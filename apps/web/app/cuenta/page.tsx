import type { Metadata } from 'next';
import { Account } from './Account';

export const metadata: Metadata = { title: 'Mi cuenta', robots: { index: false } };

export default function AccountPage() {
  return (
    <section className="section-sm">
      <div className="container stack gap-24" style={{ maxWidth: 720 }}>
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 36px)' }}>Mi cuenta</h1>
        <Account />
      </div>
    </section>
  );
}
