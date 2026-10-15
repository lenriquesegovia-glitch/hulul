'use client';

import { useEffect } from 'react';
import { CHANGE_EVENT, hasConsent } from '@/lib/consent';

/**
 * Google Analytics (vía Firebase), solo para quien aceptó las cookies de
 * analítica. Si después retira el permiso, se detiene la recolección.
 */
export function Analytics() {
  useEffect(() => {
    let analytics: import('firebase/analytics').Analytics | null = null;

    const apply = async () => {
      const allowed = hasConsent('analitica');
      if (!allowed && !analytics) return;
      const [{ firebaseApp }, mod] = await Promise.all([
        import('@hulul/shared/firebase'),
        import('firebase/analytics'),
      ]);
      if (!(await mod.isSupported())) return;
      if (!analytics) analytics = mod.getAnalytics(firebaseApp());
      mod.setAnalyticsCollectionEnabled(analytics, allowed);
    };

    apply().catch(() => {});
    const onChange = () => { apply().catch(() => {}); };
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  return null;
}
