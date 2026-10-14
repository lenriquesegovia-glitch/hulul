import type { LegalSection } from '@hulul/shared';

export function LegalDoc({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="stack gap-32">
      <nav aria-label="Contenido" className="card stack gap-8" style={{ padding: 20 }}>
        <strong>Contenido</strong>
        <ol className="stack gap-4" style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {sections.map((s) => (
            <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>
          ))}
        </ol>
      </nav>
      {sections.map((s) => (
        <section key={s.id} id={s.id} className="stack gap-12" style={{ scrollMarginTop: 90 }}>
          <h2 style={{ fontSize: 22 }}>{s.title}</h2>
          {s.body.map((b, i) =>
            'p' in b ? (
              <p key={i} style={{ color: 'var(--text-2)' }}>{b.p}</p>
            ) : (
              <ul key={i} className="stack gap-8" style={{ margin: 0, paddingLeft: 22, color: 'var(--text-2)' }}>
                {b.ul.map((li) => <li key={li}>{li}</li>)}
              </ul>
            ),
          )}
        </section>
      ))}
    </div>
  );
}
