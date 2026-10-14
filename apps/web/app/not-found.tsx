import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="section">
      <div className="container stack gap-16" style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: 36 }}>No encontramos esa página</h1>
        <p className="muted">La dirección puede estar mal escrita o la página ya no existe.</p>
        <Link href="/" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Volver al inicio</Link>
      </div>
    </section>
  );
}
