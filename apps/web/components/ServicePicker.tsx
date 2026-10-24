'use client';

import {useEffect} from 'react';
import {useCity,selectCity} from '@/lib/city';
import {serviceCity} from '@hulul/shared';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { serviceIcon, formatPrice, type Category } from '@hulul/shared';
import { usePros } from '@/lib/pros';
import { Icon } from './Icon';
import { ProCard } from './ProCard';

export const OTHER_JOB = 'Otro';

/**
 * Página de categoría: primero "¿Qué necesitas?" con los subservicios más
 * pedidos como guía (y "Otro trabajo"), luego los profesionales. El trabajo
 * elegido viaja a la reserva (?trabajo=…).
 */
export function ServicePicker({ cat, city, cityName, providersOnly = false, initialJob = '' }: { cat: Category; city?: string; cityName?: string; providersOnly?: boolean; initialJob?: string }) {
  const selectedCity=useCity();
  useEffect(()=>{if(city) selectCity(city);},[city]);
  const { pros: all, error } = usePros(cat.slug, selectedCity);
  const job = cat.servicios.includes(initialJob) || initialJob === OTHER_JOB ? initialJob : '';
  const router = useRouter();
  // Si eligió un trabajo, primero quienes lo marcaron.
  const pros = all && job && job !== OTHER_JOB
    ? [...all].sort((a, b) => Number((b.services ?? []).includes(job)) - Number((a.services ?? []).includes(job)))
    : all;
  // "Visita desde $X": la tarifa más baja de los profesionales de la categoría.
  const rates = (all ?? []).map((p) => p.visitRate).filter((r) => r > 0);
  const from = rates.length ? Math.min(...rates) : 0;

  const pick = (j: string) => {
    const params = new URLSearchParams({trabajo:j});
    params.set('ciudad',selectedCity);
    router.push(`/servicios/${cat.slug}/profesionales?${params}`);
  };

  return (
    <div className="stack gap-32">
      {!providersOnly && <div className="stack gap-12">
        <h2 style={{ fontSize: 24 }}>¿Qué necesitas?</h2>
        <div className="job-grid">
          {[...cat.servicios, OTHER_JOB].map((s) => (
            <button key={s} type="button" className={`job-card ${job === s ? 'on' : ''}`} onClick={() => pick(s)}>
              <span className="job-icon"><Icon name={serviceIcon(s,cat.icon)} size={22} color={job === s ? '#fff' : '#685943'} /></span>
              <span className="stack" style={{ minWidth: 0, flex: 1 }}>
                <strong>{s}</strong>
                <span className="muted" style={{ fontSize: 13 }}>
                  {s === OTHER_JOB ? 'Descríbelo al reservar' : from ? `Visita desde ${formatPrice(from)}` : 'Precio por visita'}
                </span>
              </span>
              <Icon name="chevronRight" size={18} color={job === s ? '#fff' : 'var(--muted)'} />
            </button>
          ))}
        </div>
      </div>}

      {providersOnly && <div className="stack gap-16" style={{ scrollMarginTop: 90 }}>
        <h2 style={{ fontSize: 24 }}>{job ? `Profesionales para: ${job}` : 'Profesionales destacados'}</h2>
        {!job && <p className="muted" style={{ fontSize: 14.5, marginTop: -8 }}>Elige arriba qué necesitas, o reserva directo con un profesional.</p>}
        {pros === null && <p className="muted">Buscando profesionales…</p>}
        {pros && pros.length > 0 && (
          <div className="grid-2">
            {pros.map((p) => <ProCard key={p.id} pro={p} job={job} />)}
          </div>
        )}
        {pros && pros.length === 0 && (
          <div className="card stack gap-12">
            <h3 style={{ fontSize: 19 }}>Estamos sumando profesionales de {cat.name.toLowerCase()}{` en ${serviceCity(selectedCity)?.name || cityName || ''}`}</h3>
            <p className="muted">{error ? 'No pudimos consultar la disponibilidad. Recarga para intentar de nuevo.' : 'Aún no tenemos profesionales disponibles en esta ciudad para este servicio.'}</p>
            <div className="row gap-12" style={{ flexWrap: 'wrap' }}>
              <Link href="/profesionales/registro" className="btn btn-primary">¿Trabajas en {cat.name.toLowerCase()}? Regístrate</Link>
              <Link href="/" className="btn btn-ghost">Ver otros servicios</Link>
            </div>
          </div>
        )}
      </div>}
    </div>
  );
}
