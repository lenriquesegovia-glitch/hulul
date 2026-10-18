import type { Metadata } from 'next';
import Link from 'next/link';
import { categories, searchCategories } from '@hulul/shared';
import { CategoryGrid } from '@/components/CategoryGrid';

export const metadata: Metadata = {
  title: 'Buscar servicios',
  robots: { index: false },
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  // Mismo criterio que las sugerencias del inicio (incluye "gasfitero", "refri"…).
  const slugs = searchCategories(q);
  const results = categories.filter((c) => slugs.includes(c.slug));

  return (
    <section className="section-sm">
      <div className="container stack gap-24">
        <h1 style={{ fontSize: 32 }}>{q ? `Resultados para “${q}”` : 'Buscar servicios'}</h1>
        {results.length > 0 ? (
          <div className="link-cloud">
            {results.map((c) => <Link key={c.slug} href={`/servicios/${c.slug}`}>{c.name}</Link>)}
          </div>
        ) : (
          q && <p className="muted">No encontramos ese servicio. Revisa todas las categorías:</p>
        )}
        <CategoryGrid />
      </div>
    </section>
  );
}
