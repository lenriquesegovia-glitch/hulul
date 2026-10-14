export type CategorySlug =
  | 'climatizacion'
  | 'plomeria'
  | 'electricidad'
  | 'electrodomesticos'
  | 'limpieza'
  | 'belleza'
  | 'mascotas'
  | 'clases';

export type IconName =
  | 'snow'
  | 'drop'
  | 'bolt'
  | 'washer'
  | 'sparkle'
  | 'scissors'
  | 'paw'
  | 'book';

export interface Category {
  slug: CategorySlug;
  name: string;
  /** Nombre en frase para SEO: "Climatización a domicilio". */
  seoName: string;
  sub: string;
  icon: IconName;
  incluye: string[];
  /** Servicios concretos que se buscan en Google dentro de la categoría. */
  servicios: string[];
}

export const categories: Category[] = [
  {
    slug: 'climatizacion',
    name: 'Climatización',
    seoName: 'Técnicos de aire acondicionado a domicilio',
    sub: 'Mantenimiento de splits, carga de gas e instalación',
    icon: 'snow',
    incluye: [
      'Limpieza de filtros, serpentín y bandeja',
      'Revisión de presión de gas y drenaje',
      'Informe del estado del equipo en la app',
    ],
    servicios: ['Mantenimiento de split', 'Carga de gas', 'Instalación de aire acondicionado', 'Reparación de inverter'],
  },
  {
    slug: 'plomeria',
    name: 'Plomería',
    seoName: 'Plomeros a domicilio',
    sub: 'Fugas, destapes, grifería y bombas de agua',
    icon: 'drop',
    incluye: ['Diagnóstico de la fuga o atasco', 'Mano de obra por las horas reservadas', 'Materiales cotizados aparte en la app'],
    servicios: ['Destape de tuberías', 'Reparación de fugas', 'Bombas de agua', 'Cambio de grifería'],
  },
  {
    slug: 'electricidad',
    name: 'Electricidad',
    seoName: 'Electricistas a domicilio',
    sub: 'Tomacorrientes, iluminación, breakers y tableros',
    icon: 'bolt',
    incluye: ['Revisión del circuito afectado', 'Instalación o cambio de puntos eléctricos', 'Pruebas de funcionamiento al terminar'],
    servicios: ['Electricista urgente', 'Cambio de breakers', 'Instalación de lámparas', 'Revisión de tablero'],
  },
  {
    slug: 'electrodomesticos',
    name: 'Electrodomésticos',
    seoName: 'Reparación de electrodomésticos a domicilio',
    sub: 'Lavadoras, refrigeradoras, cocinas y secadoras',
    icon: 'washer',
    incluye: ['Diagnóstico en sitio', 'Reparación si los repuestos están disponibles', 'Garantía sobre la mano de obra'],
    servicios: ['Reparación de lavadoras', 'Reparación de refrigeradoras', 'Cocinas de inducción', 'Secadoras'],
  },
  {
    slug: 'limpieza',
    name: 'Limpieza',
    seoName: 'Limpieza de casas y departamentos por horas',
    sub: 'Casas, departamentos, post obra y oficinas',
    icon: 'sparkle',
    incluye: ['Limpieza de cocina, baños y áreas sociales', 'Productos incluidos si lo eliges', 'Lista de tareas en la app'],
    servicios: ['Limpieza por horas', 'Limpieza profunda', 'Limpieza post obra', 'Limpieza de oficinas'],
  },
  {
    slug: 'belleza',
    name: 'Belleza',
    seoName: 'Belleza a domicilio',
    sub: 'Uñas, peinado, maquillaje y barbería',
    icon: 'scissors',
    incluye: ['Materiales desinfectados por servicio', 'Productos profesionales', 'Atención en tu casa u oficina'],
    servicios: ['Manicure y pedicure', 'Maquillaje', 'Peinado', 'Barbería'],
  },
  {
    slug: 'mascotas',
    name: 'Mascotas',
    seoName: 'Cuidado de mascotas a domicilio',
    sub: 'Baño, peluquería canina, paseos y cuidado',
    icon: 'paw',
    incluye: ['Baño con productos hipoalergénicos', 'Corte de uñas y limpieza de oídos', 'Fotos del servicio en la app'],
    servicios: ['Peluquería canina', 'Paseo de perros', 'Cuidado de mascotas'],
  },
  {
    slug: 'clases',
    name: 'Clases',
    seoName: 'Clases particulares a domicilio',
    sub: 'Tareas dirigidas, inglés, matemáticas y música',
    icon: 'book',
    incluye: ['Diagnóstico del nivel en la primera clase', 'Material de práctica', 'Reporte de avance'],
    servicios: ['Tareas dirigidas', 'Clases de inglés', 'Clases de matemáticas', 'Clases de música'],
  },
];

export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
