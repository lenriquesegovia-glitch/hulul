import { useEffect, useState } from 'react';
import type { CategorySlug, Professional } from '@hulul/shared';
import { listPros, loadPro } from '@hulul/shared/firebase';

/** Profesionales aprobados de una categoría. `null` mientras carga. */
export function usePros(category?: CategorySlug): { pros: Professional[] | null; error: boolean } {
  const [pros, setPros] = useState<Professional[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!category) return;
    let off = false;
    setPros(null);
    setError(false);
    listPros(category).then((l) => { if (!off) setPros(l); }).catch(() => { if (!off) { setError(true); setPros([]); } });
    return () => { off = true; };
  }, [category]);
  return { pros, error };
}

/** Un profesional aprobado. `undefined` mientras carga, `null` si no existe. */
export function usePro(id?: string, category?: string): Professional | null | undefined {
  const [pro, setPro] = useState<Professional | null | undefined>(undefined);
  useEffect(() => {
    if (!id) { setPro(null); return; }
    let off = false;
    setPro(undefined);
    loadPro(id, category as CategorySlug | undefined).then((p) => { if (!off) setPro(p); }).catch(() => { if (!off) setPro(null); });
    return () => { off = true; };
  }, [id, category]);
  return pro;
}

/** Estado de la cuenta de profesional del usuario (null si no es profesional, undefined mientras carga). */
export function useProviderStatus(uid?: string | null): string | null | undefined {
  const [status, setStatus] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!uid) { setStatus(null); return; }
    setStatus(undefined);
    let off = false;
    import('firebase/firestore').then(async (fs) => {
      const { firestore } = await import('@hulul/shared/firebase');
      const snap = await fs.getDoc(fs.doc(firestore(), 'providers', uid));
      if (!off) setStatus(snap.exists() ? String(snap.data().status ?? '') : null);
    }).catch(() => { if (!off) setStatus(null); });
    return () => { off = true; };
  }, [uid]);
  return status;
}
