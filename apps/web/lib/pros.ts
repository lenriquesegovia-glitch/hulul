'use client';

import { useEffect, useState } from 'react';
import type { CategorySlug, Professional } from '@hulul/shared';

/** Profesionales aprobados de una categoría. `null` mientras carga. */
export function usePros(category: CategorySlug, city?: string): { pros: Professional[] | null; error: boolean } {
  const [pros, setPros] = useState<Professional[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let off = false;
    setPros(null);
    import('@hulul/shared/firebase')
      .then(({ listPros }) => listPros(category, city))
      .then((l) => { if (!off) setPros(l); })
      .catch(() => { if (!off) { setError(true); setPros([]); } });
    return () => { off = true; };
  }, [category, city]);
  return { pros, error };
}

/** Un profesional; la categoría sale de `?c=` en la dirección. `undefined` mientras carga. */
export function usePro(id: string): Professional | null | undefined {
  const [pro, setPro] = useState<Professional | null | undefined>(undefined);
  useEffect(() => {
    let off = false;
    const c = new URLSearchParams(window.location.search).get('c') as CategorySlug | null;
    import('@hulul/shared/firebase')
      .then(({ loadPro }) => loadPro(id, c ?? undefined))
      .then((p) => { if (!off) setPro(p); })
      .catch(() => { if (!off) setPro(null); });
    return () => { off = true; };
  }, [id]);
  return pro;
}
