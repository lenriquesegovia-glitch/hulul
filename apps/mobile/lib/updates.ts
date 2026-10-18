import { useEffect } from 'react';
import * as Updates from 'expo-updates';

/**
 * Actualizaciones sin reinstalar: al abrir la app revisa si hay una versión
 * nueva publicada con publicar-app.bat; si la hay, la descarga y reinicia la
 * app con los cambios. Sin internet, sigue con la versión que tiene.
 */
export function useAutoUpdate(): void {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) return;
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } catch {
        // Sin conexión o sin actualización: no pasa nada.
      }
    })();
  }, []);
}
