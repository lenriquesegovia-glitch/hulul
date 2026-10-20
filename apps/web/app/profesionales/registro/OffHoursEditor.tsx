'use client';

import { MAX_SURCHARGE, NOISE_NOTICE, OFF_HOURS, type Surcharges } from '@hulul/shared';
import { Field } from './ServiceBits';

export interface OffHoursValue {
  offHours: number[];
  holidays: boolean;
  surcharges: Surcharges;
}

const label = (h: number) => `${String(h).padStart(2, '0')}:00`;
const NIGHT = OFF_HOURS.filter((h) => h >= 18);
const EARLY = OFF_HOURS.filter((h) => h < 8);

/**
 * Fuera de horario y feriados: el profesional decide si atiende, a qué horas
 * llega y cuánto cobra de recargo (monto fijo, sin tope). El cliente ve el
 * recargo antes de confirmar.
 */
export function OffHoursEditor({ value, onChange, noisy }: { value: OffHoursValue; onChange: (v: OffHoursValue) => void; noisy?: boolean }) {
  const on = value.offHours.length > 0;
  const toggle = (h: number) => onChange({ ...value, offHours: value.offHours.includes(h) ? value.offHours.filter((x) => x !== h) : [...value.offHours, h] });
  const setSc = (k: keyof Surcharges, raw: string) => {
    const v = raw.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
    onChange({ ...value, surcharges: { ...value.surcharges, [k]: v === '' ? undefined : Math.min(MAX_SURCHARGE, Number(v)) } });
  };
  const chips = (hours: number[]) => (
    <div className="tag-row">
      {hours.map((h) => {
        const sel = value.offHours.includes(h);
        return <button key={h} type="button" aria-pressed={sel} className={`tag ${sel ? 'on' : ''}`} onClick={() => toggle(h)}>{sel && '✓ '}{label(h)}</button>;
      })}
    </div>
  );
  return (
    <div className="card stack gap-12" style={{ padding: 18 }}>
      <strong style={{ fontSize: 16 }}>Fuera de horario y feriados (opcional)</strong>
      <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>
        El horario normal de HULUL es de 08:00 a 18:00. Si quieres atender urgencias de noche, de madrugada o en feriados, marca a qué horas puedes llegar y cuánto cobras de recargo. Es un monto fijo que tú decides y que se suma a tu tarifa por visita. El cliente lo ve antes de confirmar, y HULUL retiene la misma comisión del 15 %.
      </p>
      <label className="check">
        <input type="checkbox" checked={on} onChange={(e) => onChange({ ...value, offHours: e.target.checked ? [18, 19, 20] : [] })} />
        <span><strong>Atiendo fuera de horario</strong> (antes de las 08:00 o desde las 18:00)</span>
      </label>
      {on && (
        <>
          <span className="field-label">Noche: horas en que puedes llegar</span>
          {chips(NIGHT)}
          <span className="field-label">Madrugada y temprano</span>
          {chips(EARLY)}
          <div className="form-2">
            <Field id="sc-noche" label="Recargo nocturno (USD)" hint="Se suma a tu tarifa por visita. Puede ser $0.">
              <input id="sc-noche" type="text" inputMode="numeric" maxLength={3} placeholder="Ej.: 15"
                value={value.surcharges.nocturno ?? ''} onChange={(e) => setSc('nocturno', e.target.value)} />
            </Field>
          </div>
        </>
      )}
      <label className="check">
        <input type="checkbox" checked={value.holidays} onChange={(e) => onChange({ ...value, holidays: e.target.checked })} />
        <span><strong>Atiendo feriados</strong> (Navidad, Año Nuevo, Carnaval, Difuntos…)</span>
      </label>
      {value.holidays && (
        <div className="form-2">
          <Field id="sc-feriado" label="Recargo de feriado (USD)" hint="Si es feriado y de noche, se cobra solo el mayor de los dos.">
            <input id="sc-feriado" type="text" inputMode="numeric" maxLength={3} placeholder="Ej.: 10"
              value={value.surcharges.feriado ?? ''} onChange={(e) => setSc('feriado', e.target.value)} />
          </Field>
        </div>
      )}
      {noisy && (on || value.holidays) && (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>Trabajos con ruido de noche o en feriado: al reservar, el cliente acepta este aviso: &ldquo;{NOISE_NOTICE}&rdquo;</p>
      )}
    </div>
  );
}
