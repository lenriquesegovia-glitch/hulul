'use client';

import { useMemo, useState } from 'react';
import {
  EXTRA_ACTIVITIES,
  MAX_PROPOSALS,
  searchActivities,
  type ActivityProposal,
  type CategorySlug,
} from '@hulul/shared';
import { AddOwnJob, Field } from './ServiceBits';

/**
 * "¿Haces algo que no está en la lista?": el profesional busca su oficio en un
 * catálogo amplio o escribe uno nuevo, marca sus trabajos y pone su tarifa.
 * Todo queda en revisión; los clientes no lo ven hasta que HULUL lo apruebe.
 */
export function ProposalsEditor({ value, onChange, chosen, onPickCategory }: {
  value: ActivityProposal[];
  onChange: (v: ActivityProposal[]) => void;
  /** Categorías ya elegidas arriba (para no sugerirlas otra vez). */
  chosen: CategorySlug[];
  /** Si lo que busca ya es una categoría, la marca arriba. */
  onPickCategory: (c: CategorySlug) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const taken = new Set(value.map((p) => p.id));
  const found = useMemo(() => searchActivities(q), [q]);
  const full = value.length >= MAX_PROPOSALS;

  const add = (p: ActivityProposal) => {
    if (taken.has(p.id) || full) return;
    onChange([...value, p]);
    setQ('');
    setOpen(false);
  };
  const addNew = () => {
    const name = q.trim().replace(/\s+/g, ' ').slice(0, 60);
    if (name.length < 3) return;
    const id = `nueva-${name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}`;
    add({ id, name: name.charAt(0).toUpperCase() + name.slice(1), services: [], note: '' });
  };
  const update = (id: string, patch: Partial<ActivityProposal>) => onChange(value.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const exact = EXTRA_ACTIVITIES.some((a) => a.name.toLowerCase() === q.trim().toLowerCase());

  return (
    <div className="stack gap-12">
      {value.map((p) => {
        const base = EXTRA_ACTIVITIES.find((a) => a.id === p.id)?.services ?? [];
        const all = [...base, ...p.services.filter((s) => !base.includes(s))];
        const toggle = (s: string) => update(p.id, { services: p.services.includes(s) ? p.services.filter((x) => x !== s) : [...p.services, s] });
        return (
          <div key={p.id} className="card stack gap-12" style={{ padding: 18 }}>
            <div className="row gap-8" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stack gap-4">
                <strong style={{ fontSize: 17 }}>{p.name}</strong>
                <span className="pill-review">Actividad nueva · en revisión</span>
              </div>
              <button type="button" className="link-btn" onClick={() => onChange(value.filter((x) => x.id !== p.id))}>Quitar</button>
            </div>
            <div className="stack gap-8">
              <span className="muted" style={{ fontSize: 13.5 }}>{all.length ? 'Marca lo que haces:' : 'Escribe los trabajos que haces en esta actividad:'}</span>
              {all.length > 0 && (
                <div className="tag-row">
                  {all.map((s) => {
                    const on = p.services.includes(s);
                    return <button key={s} type="button" aria-pressed={on} className={`tag ${on ? 'on' : ''}`} onClick={() => toggle(s)}>{on && '✓ '}{s}</button>;
                  })}
                </div>
              )}
              <AddOwnJob onAdd={(job) => { if (!p.services.includes(job)) update(p.id, { services: [...p.services, job] }); }} />
            </div>
            <div className="form-2">
              <Field id={`pr-${p.id}`} label="Tu tarifa por visita (USD)" hint="HULUL la revisa al aprobar la actividad.">
                <input id={`pr-${p.id}`} type="text" inputMode="numeric" maxLength={3} placeholder="20" value={p.rate ? String(p.rate) : ''}
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, '').replace(/^0+/, ''); update(p.id, { rate: v ? Number(v) : undefined }); }} />
              </Field>
            </div>
            <Field id={`pn-${p.id}`} label="¿Cómo demuestras que sabes hacerlo?" hint="Certificado, curso, años de experiencia, dónde trabajaste. Te pediremos fotos o documentos al revisar.">
              <input id={`pn-${p.id}`} maxLength={300} value={p.note} placeholder="Ej.: Curso de enfermería en el SECAP y 5 años cuidando pacientes"
                onChange={(e) => update(p.id, { note: e.target.value })} />
            </Field>
          </div>
        );
      })}

      {!open ? (
        <button type="button" className="btn btn-ghost add-activity" disabled={full} onClick={() => setOpen(true)}>
          + {value.length ? 'Agregar otra actividad' : '¿Haces algo que no está en la lista? Agrégalo'}
        </button>
      ) : (
        <div className="card stack gap-12" style={{ padding: 18 }}>
          <div className="row gap-8" style={{ justifyContent: 'space-between' }}>
            <strong style={{ fontSize: 16 }}>Agregar otra actividad</strong>
            <button type="button" className="link-btn" onClick={() => { setOpen(false); setQ(''); }}>Cerrar</button>
          </div>
          <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>Busca tu oficio o escríbelo. Si no está, se crea como actividad nueva. Las actividades nuevas las revisa y aprueba HULUL antes de mostrarlas a los clientes.</p>
          <input className="own-job" style={{ borderStyle: 'solid' }} autoFocus value={q} maxLength={60} placeholder="Ej.: enfermería, vidriería, chef, tapicería…"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (found.activities.length === 1) { const a = found.activities[0]; add({ id: a.id, name: a.name, services: [], note: '' }); } else addNew(); } }} />

          {found.inCategory.filter((x) => !chosen.includes(x.category)).length > 0 && (
            <div className="notice" style={{ fontSize: 13.5 }}>
              <strong>Eso ya está en HULUL:</strong>{' '}
              {found.inCategory.filter((x) => !chosen.includes(x.category)).map((x, i) => (
                <span key={x.category}>
                  {i > 0 && ' · '}
                  <button type="button" className="link-btn" onClick={() => { onPickCategory(x.category); setOpen(false); setQ(''); }}>
                    {x.service ? `${x.service} (en ${x.name})` : x.name}
                  </button>
                </span>
              ))}
              . Tócala para marcar esa categoría.
            </div>
          )}

          <div className="activity-list" role="list">
            {found.activities.map((a) => (
              <button key={a.id} type="button" role="listitem" className="activity-item" disabled={taken.has(a.id)}
                onClick={() => add({ id: a.id, name: a.name, services: [], note: '' })}>
                <strong>{a.name}</strong>
                <span>{taken.has(a.id) ? 'Ya la agregaste' : a.services.slice(0, 3).join(' · ')}</span>
              </button>
            ))}
            {found.activities.length === 0 && q.trim().length >= 2 && <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>No está en la lista.</p>}
          </div>

          {q.trim().length >= 3 && !exact && (
            <button type="button" className={`btn ${found.activities.length ? 'btn-ghost' : 'btn-primary'} add-activity`} onClick={addNew}>
              {found.activities.length ? '¿No es ninguna? ' : ''}Crear «{q.trim().slice(0, 40)}»
            </button>
          )}
        </div>
      )}
      {full && <span className="muted" style={{ fontSize: 13 }}>Puedes proponer hasta {MAX_PROPOSALS} actividades nuevas.</span>}
    </div>
  );
}
