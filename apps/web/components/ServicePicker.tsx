'use client';

import { useRef, useState } from 'react';
import { categoryPricing, formatPrice, type Category, type Professional } from '@hulul/shared';
import { Icon } from './Icon';
import { ProCard } from './ProCard';

export const OTHER_JOB = 'Otro trabajo';

/**
 * Página de categoría: primero "¿Qué necesitas?" con los subservicios más
 * pedidos como guía (y "Otro trabajo"), luego los profesionales. El trabajo
 * elegido viaja a la reserva (?trabajo=…).
 */
export function ServicePicker({ cat, pros }: { cat: Category; pros: Professional[] }) {
  const [job, setJob] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const price = categoryPricing(cat.slug);

  const pick = (j: string) => {
    setJob(j);
    setTimeout(() => list.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  return (
    <div className="stack gap-32">
      <div className="stack gap-12">
        <h2 style={{ fontSize: 24 }}>¿Qué necesitas?</h2>
        <div className="job-grid">
          {[...cat.servicios, OTHER_JOB].map((s) => (
            <button key={s} type="button" aria-pressed={job === s} className={`job-card ${job === s ? 'on' : ''}`} onClick={() => pick(s)}>
              <span className="job-icon"><Icon name={s === OTHER_JOB ? 'chat' : cat.icon} size={22} color={job === s ? '#fff' : '#9A5B34'} /></span>
              <span className="stack" style={{ minWidth: 0, flex: 1 }}>
                <strong>{s}</strong>
                <span className="muted" style={{ fontSize: 13 }}>
                  {s === OTHER_JOB ? 'Descríbelo al reservar' : `${price.visit > 0 ? `Visita ${formatPrice(price.visit)} + ` : ''}desde ${formatPrice(price.rate)}/h`}
                </span>
              </span>
              <Icon name="chevronRight" size={18} color={job === s ? '#fff' : 'var(--muted)'} />
            </button>
          ))}
        </div>
      </div>

      <div className="stack gap-16" ref={list} style={{ scrollMarginTop: 90 }}>
        <h2 style={{ fontSize: 24 }}>{job ? `Profesionales para: ${job}` : 'Profesionales destacados'}</h2>
        {!job && <p className="muted" style={{ fontSize: 14.5, marginTop: -8 }}>Elige arriba qué necesitas, o reserva directo con un profesional.</p>}
        <div className="grid-2">
          {pros.map((p) => <ProCard key={p.id} pro={p} job={job} />)}
        </div>
      </div>
    </div>
  );
}
