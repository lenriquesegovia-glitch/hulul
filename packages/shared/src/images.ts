import type { CategorySlug } from './categories';

/**
 * Fotos de referencia por categoría (Unsplash, licencia libre para uso
 * comercial, sin atribución obligatoria). Se reemplazan por fotos propias
 * de los profesionales de HULUL cuando las tengamos.
 */
const PHOTOS: Record<CategorySlug, string> = {
  climatizacion: 'photo-1718203862467-c33159fdc504',
  plomeria: 'photo-1749532125405-70950966b0e5',
  electricidad: 'photo-1758101755915-462eddc23f57',
  electrodomesticos: 'photo-1604335399105-a0c585fd81a1',
  limpieza: 'photo-1758273238415-01ec03d9ef27',
  jardineria: 'photo-1617576683096-00fc8eecb3af',
  piscinas: 'photo-1613152184920-bc1c4ab7fd1d',
  pintura: 'photo-1717281234297-3def5ae3eee1',
  belleza: 'photo-1632345031435-8727f6897d53',
  mascotas: 'photo-1537151608828-ea2b11777ee8',
  clases: 'photo-1583468982228-19f19164aee2',
  salud: 'photo-1649751361457-01d3a696c7e6',
};

/** URL de la foto de una categoría, recortada al ancho pedido. */
export function categoryImage(slug: CategorySlug, width = 800): string {
  return `https://images.unsplash.com/${PHOTOS[slug]}?auto=format&fit=crop&w=${width}&q=70`;
}
