/**
 * Modo demostración: muestra un aviso de "versión de prueba" y pide a Google
 * que no indexe el sitio. Desactívalo poniendo NEXT_PUBLIC_DEMO_MODE=false
 * cuando la web muestre profesionales y reseñas reales.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false';

/** URL pública del sitio. Configúrala en Vercel con NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hululec.com';

/** Enlaces de descarga. Reemplazar cuando la app esté publicada en las tiendas. */
export const APP_STORE_URL = '#descargar';
export const PLAY_STORE_URL = '#descargar';

/** WhatsApp de atención (formato internacional sin +). Reemplazar por el número real. */
export const WHATSAPP_NUMBER = '';
