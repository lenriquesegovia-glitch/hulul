'use client';

import { useEffect, useState } from 'react';
import { ABSENT_PROBLEM_OPTIONS } from '@hulul/shared/firebase';
import { serviceCopy } from '@hulul/shared';
import { ReportForm } from '@/components/Claim';

/** Código de llegada del cliente: se lo da al profesional cuando llega, para que empiece. */
export function ArrivalCode({ id, pro }: { id: string; pro: string }) {
  const [code, setCode] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let unsub = () => {};
    let off = false;
    import('@hulul/shared/firebase').then(({ watchArrivalCode }) => { if (!off) unsub = watchArrivalCode(id, setCode); });
    return () => { off = true; unsub(); };
  }, [id]);
  if (!code) return null;
  return (
    <div className="card row gap-16" style={{ alignItems: 'center', flexWrap: 'wrap', borderColor: 'var(--primary)', borderWidth: 2 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, letterSpacing: 8, fontWeight: 800 }} aria-label={`Código ${code.split('').join(' ')}`}>{code}</div>
      <div className="stack gap-4" style={{ flex: 1, minWidth: 200 }}>
        <strong>Tu código de llegada</strong>
        <span className="muted" style={{ fontSize: 14 }}>Dáselo a {pro} cuando esté en tu casa. Sin este código no puede empezar ni cerrar el trabajo. No lo compartas antes.</span>
      </div>
    </div>
  );
}

/** Pedir ayuda con el servicio (hasta 48 h): el pago queda en espera y HULUL revisa. */
export function ProblemBox({ id, category, absent = false }: { id: string; category?: string; absent?: boolean }) {
  const copy = serviceCopy(category);
  const options: { value: string; label: string }[] = absent ? ABSENT_PROBLEM_OPTIONS : copy.helpOptions;
  const [open, setOpen] = useState(false);
  if (!open) return <div className="actions"><button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>{absent ? 'Yo sí estaba en casa' : copy.helpButton}</button></div>;
  return (
    <ReportForm id={id} side="cliente" options={options} onCancel={() => setOpen(false)}
      title={absent ? '¿Estabas en casa?' : copy.helpTitle}
      help={absent ? 'El cobro queda en espera y HULUL revisa la llegada del profesional, los timbres, el chat y las horas. Si estabas, no pagas nada.' : 'Cuéntanos y lo revisamos. Mientras tanto el pago queda en espera; si el servicio no se realizó, no pagas.'} />
  );
}
