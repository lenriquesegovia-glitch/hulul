import { OUTCOME_LABEL, type JobOutcome } from '@hulul/shared';

/** Resultado y diagnóstico de una visita, con sus fotos. */
export function VisitReport({ outcome, diagnosis, photos, title = 'Diagnóstico del profesional' }: {
  outcome?: JobOutcome; diagnosis?: string; photos?: string[]; title?: string;
}) {
  if (!outcome) return null;
  const tone = outcome === 'resuelto' ? 'pill-success' : 'pill-warm';
  return (
    <div className="card stack gap-12">
      <div className="row gap-12" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 17 }}>{title}</strong>
        <span className={`pill ${tone}`}>{OUTCOME_LABEL[outcome]}</span>
      </div>
      {diagnosis && <p style={{ color: 'var(--text-2)', whiteSpace: 'pre-line', margin: 0 }}>{diagnosis}</p>}
      {!!photos?.length && (
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          {photos.map((u, i) => (
            <a key={u} href={u} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt={`Foto ${i + 1} del diagnóstico`} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** Aviso de seguridad en el hogar (antes y durante el servicio). */
export function SafetyNotice({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="notice stack gap-8">
      <strong>{title}</strong>
      <ul className="stack gap-4" style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
        {items.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </div>
  );
}
