'use client';

/**
 * Selector tipo reloj: el valor grande en el centro y − / + a los lados.
 * Reemplaza las listas largas de opciones (horas, minutos, días, retraso).
 */
export function Stepper({ label, value, onMinus, onPlus, canMinus = true, canPlus = true, minusLabel = 'Menos', plusLabel = 'Más' }: {
  label?: string; value: string; onMinus: () => void; onPlus: () => void; canMinus?: boolean; canPlus?: boolean; minusLabel?: string; plusLabel?: string;
}) {
  return (
    <div className="stack gap-4" style={{ flex: 1, minWidth: 0 }}>
      {label && <span className="muted" style={{ fontSize: 13, fontWeight: 700, textAlign: 'center' }}>{label}</span>}
      <div className="stepper">
        <button type="button" aria-label={minusLabel} disabled={!canMinus} onClick={onMinus}>−</button>
        <output aria-live="polite">{value}</output>
        <button type="button" aria-label={plusLabel} disabled={!canPlus} onClick={onPlus}>+</button>
      </div>
    </div>
  );
}
