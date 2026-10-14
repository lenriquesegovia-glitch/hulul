export interface City {
  slug: string;
  name: string;
  province: string;
  /** Zonas que se muestran para dar contexto local en las páginas. */
  zonas: string[];
  /** true = ya operamos; false = página SEO para captar demanda antes del lanzamiento. */
  activa: boolean;
}

export const cities: City[] = [
  { slug: 'guayaquil', name: 'Guayaquil', province: 'Guayas', zonas: ['Urdesa', 'Kennedy', 'Los Ceibos', 'Alborada', 'Vía a la Costa', 'Centro'], activa: true },
  { slug: 'samborondon', name: 'Samborondón', province: 'Guayas', zonas: ['La Puntilla', 'Entre Ríos', 'Ciudad Celeste', 'Vía Samborondón'], activa: true },
  { slug: 'daule', name: 'Daule', province: 'Guayas', zonas: ['La Aurora', 'Vía a Salitre', 'Centro de Daule'], activa: true },
  { slug: 'quito', name: 'Quito', province: 'Pichincha', zonas: ['Cumbayá', 'La Carolina', 'Tumbaco', 'Valle de los Chillos'], activa: false },
  { slug: 'cuenca', name: 'Cuenca', province: 'Azuay', zonas: ['El Centro', 'Ordóñez Lasso', 'Challuabamba'], activa: false },
];

export function getCity(slug: string): City | undefined {
  return cities.find((c) => c.slug === slug);
}
