import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PRIVACY_VERSION } from '@hulul/shared';

/**
 * Aceptación de la política de privacidad en este teléfono.
 * Se vuelve a pedir si cambia PRIVACY_VERSION.
 * Cuando el usuario cree su cuenta (Firebase), esta aceptación se copiará
 * a su perfil como prueba del consentimiento.
 */
export interface PrivacyConsent {
  v: string;
  at: string;
  analitica: boolean;
}

const KEY = 'hulul.privacy';

interface Ctx {
  ready: boolean;
  consent: PrivacyConsent | null;
  accept: (opts: { analitica: boolean }) => Promise<void>;
}

const PrivacyContext = createContext<Ctx>({ ready: false, consent: null, accept: async () => {} });

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [consent, setConsent] = useState<PrivacyConsent | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const c = JSON.parse(raw) as PrivacyConsent;
        if (c.v === PRIVACY_VERSION) setConsent(c);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const accept = useCallback(async ({ analitica }: { analitica: boolean }) => {
    const c: PrivacyConsent = { v: PRIVACY_VERSION, at: new Date().toISOString(), analitica };
    setConsent(c);
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(c));
    } catch {
      // Si no se puede guardar, se volverá a pedir la próxima vez.
    }
  }, []);

  return <PrivacyContext.Provider value={{ ready, consent, accept }}>{children}</PrivacyContext.Provider>;
}

export const usePrivacy = () => useContext(PrivacyContext);
