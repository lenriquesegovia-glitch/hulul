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
  cerrajeria: 'photo-1756341782434-3020b9d17372',
  carpinteria: 'photo-1769353086138-19ee65291a04',
  albanileria: 'photo-1701850009190-2859ba2aeea6',
  fumigacion: 'photo-1747659629851-a92bd71149f6',
  mudanzas: 'photo-1714647211902-bb711d643a17',
  tecnologia: 'photo-1550041473-d296a3a8a18a',
};

/** URL de la foto de una categoría, recortada al ancho pedido. */
export function categoryImage(slug: CategorySlug, width = 800): string {
  return `https://images.unsplash.com/${PHOTOS[slug]}?auto=format&fit=crop&w=${width}&q=70`;
}
