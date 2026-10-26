export type CategorySlug =
  | 'climatizacion'
  | 'plomeria'
  | 'electricidad'
  | 'electrodomesticos'
  | 'limpieza'
  | 'jardineria'
  | 'piscinas'
  | 'pintura'
  | 'salud'
  | 'belleza'
  | 'mascotas'
  | 'clases'
  | 'cerrajeria'
  | 'carpinteria'
  | 'albanileria'
  | 'fumigacion'
  | 'mudanzas'
  | 'tecnologia'
  | 'servicios-profesionales';

export type IconName =
  | 'snow'
  | 'drop'
  | 'bolt'
  | 'washer'
  | 'sparkle'
  | 'leaf'
  | 'waves'
  | 'roller'
  | 'heart'
  | 'key'
  | 'saw'
  | 'brick'
  | 'bug'
  | 'truck'
  | 'monitor'
  | 'scissors'
  | 'paw'
  | 'book'
  | 'compass';

export interface Category {
  slug: CategorySlug;
  name: string;
  /** Nombre para los botones de categoría, con guion opcional (\u00AD) donde puede cortarse. */
  tileName?: string;
  /** Nombre en frase para SEO: "Climatización a domicilio". */
  seoName: string;
  sub: string;
  icon: IconName;
  incluye: string[];
  /** Servicios más pedidos dentro de la categoría (no es una lista cerrada). */
  servicios: string[];
  /** Aviso importante que se muestra en la categoría y al reservar. */
  aviso?: string;
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
    servicios: ['Mantenimiento de split', 'Carga de gas', 'Instalación de aire acondicionado', 'Reparación de inverter', 'Desinstalación y traslado de equipos', 'Aire acondicionado central y ductos', 'Fuga de agua del split', 'Instalación de extractores'],
  },
  {
    slug: 'plomeria',
    name: 'Plomería',
    seoName: 'Plomeros a domicilio',
    sub: 'Fugas, destapes, grifería y bombas de agua',
    icon: 'drop',
    incluye: ['Diagnóstico de la fuga o atasco', 'Arreglo si se resuelve en la visita', 'Materiales y trabajo extra: cobro adicional en la app'],
    servicios: ['Destape de tuberías', 'Reparación de fugas', 'Bombas de agua', 'Cambio de grifería', 'Instalación de inodoro', 'Calefón y termotanque', 'Cisternas y tanques elevados', 'Lavamanos y fregaderos', 'Detección de fugas ocultas', 'Hidroneumático y presurizador'],
  },
  {
    slug: 'electricidad',
    name: 'Electricidad',
    seoName: 'Electricistas a domicilio',
    sub: 'Tomacorrientes, iluminación, breakers y tableros',
    icon: 'bolt',
    incluye: ['Revisión del circuito afectado', 'Instalación o cambio de puntos eléctricos', 'Pruebas de funcionamiento al terminar'],
    servicios: ['Electricista urgente', 'Cambio de breakers', 'Instalación de lámparas', 'Revisión de tablero', 'Tomacorrientes e interruptores', 'Ventiladores de techo', 'Duchas eléctricas', 'Acometida y medidor', 'Puesta a tierra', 'Iluminación LED'],
  },
  {
    slug: 'electrodomesticos',
    name: 'Electrodomésticos',
    tileName: 'Electro\u00ADdomésticos',
    seoName: 'Reparación de electrodomésticos a domicilio',
    sub: 'Lavadoras, refrigeradoras, cocinas y secadoras',
    icon: 'washer',
    incluye: ['Diagnóstico en sitio', 'Reparación si los repuestos están disponibles', 'Diagnóstico escrito con fotos en la app'],
    servicios: ['Reparación de lavadoras', 'Reparación de refrigeradoras', 'Cocinas de inducción', 'Secadoras', 'Microondas', 'Hornos y cocinas a gas', 'Lavavajillas', 'Congeladores', 'Instalación de electrodomésticos'],
  },
  {
    slug: 'limpieza',
    name: 'Limpieza',
    seoName: 'Limpieza de casas y departamentos por horas',
    sub: 'Casas, departamentos, post obra y oficinas',
    icon: 'sparkle',
    incluye: ['Limpieza de cocina, baños y áreas sociales', 'Productos incluidos si lo eliges', 'Lista de tareas en la app'],
    servicios: ['Limpieza por horas', 'Limpieza profunda', 'Limpieza post obra', 'Limpieza de oficinas', 'Planchado', 'Limpieza de vidrios', 'Muebles y colchones', 'Alfombras y cortinas', 'Limpieza por mudanza'],
  },
  {
    slug: 'jardineria',
    name: 'Jardinería',
    seoName: 'Jardineros a domicilio',
    sub: 'Corte de césped, poda y mantenimiento de jardines',
    icon: 'leaf',
    incluye: ['Corte y bordeado de césped', 'Poda de plantas y arbustos', 'Retiro de los restos de la poda'],
    servicios: ['Corte de césped', 'Poda de árboles y arbustos', 'Mantenimiento de jardines', 'Sistemas de riego', 'Siembra de grama', 'Diseño de jardines', 'Retiro de maleza y desechos', 'Fumigación de plantas'],
  },
  {
    slug: 'piscinas',
    name: 'Piscinas',
    seoName: 'Mantenimiento de piscinas a domicilio',
    sub: 'Limpieza, químicos, bombas y filtros',
    icon: 'waves',
    incluye: ['Aspirado, cepillado y limpieza de bordes', 'Medición y balance de cloro y pH', 'Revisión de bomba y filtro'],
    servicios: ['Limpieza de piscina', 'Balance de químicos', 'Reparación de bombas y filtros', 'Mantenimiento mensual', 'Recuperar piscina verde', 'Cambio de arena del filtro', 'Reparación de fugas', 'Iluminación de piscina'],
  },
  {
    slug: 'pintura',
    name: 'Pintura',
    seoName: 'Pintores a domicilio',
    sub: 'Interiores, fachadas, empaste y acabados',
    icon: 'roller',
    incluye: ['Protección de pisos y muebles', 'Preparación y resane de paredes', 'Limpieza al terminar'],
    servicios: ['Pintura de interiores', 'Pintura de fachadas', 'Empaste y resanes', 'Impermeabilización', 'Rejas y puertas', 'Lacado de muebles', 'Tratamiento de humedad', 'Pintura de techos'],
  },
  {
    slug: 'belleza',
    name: 'Belleza',
    seoName: 'Belleza a domicilio',
    sub: 'Uñas, peinado, maquillaje y barbería',
    icon: 'scissors',
    incluye: ['Materiales desinfectados por servicio', 'Productos profesionales', 'Atención en tu casa u oficina'],
    servicios: ['Manicure y pedicure', 'Maquillaje', 'Peinado', 'Barbería', 'Uñas acrílicas y gel', 'Corte de cabello', 'Cejas y pestañas', 'Tintes y mechas', 'Depilación', 'Masajes relajantes'],
  },
  {
    slug: 'mascotas',
    name: 'Mascotas',
    seoName: 'Cuidado de mascotas a domicilio',
    sub: 'Baño, peluquería canina, paseos y cuidado',
    icon: 'paw',
    incluye: ['Baño con productos hipoalergénicos', 'Corte de uñas y limpieza de oídos', 'Fotos del servicio en la app'],
    servicios: ['Peluquería canina', 'Paseo de perros', 'Cuidado de mascotas', 'Baño de mascotas', 'Corte de uñas', 'Adiestramiento', 'Cuidado de gatos'],
  },
  {
    slug: 'clases',
    name: 'Clases',
    seoName: 'Clases particulares a domicilio',
    sub: 'Tareas dirigidas, inglés, matemáticas y música',
    icon: 'book',
    incluye: ['Diagnóstico del nivel en la primera clase', 'Material de práctica', 'Reporte de avance'],
    servicios: ['Tareas dirigidas', 'Clases de inglés', 'Clases de matemáticas', 'Clases de música', 'Física y química', 'Preuniversitario', 'Computación', 'Otros idiomas'],
  },
  {
    slug: 'salud',
    name: 'Salud',
    seoName: 'Salud a domicilio: fisioterapia, enfermería y pediatría',
    sub: 'Fisioterapia, enfermería, pediatría y cuidado de adultos mayores',
    icon: 'heart',
    incluye: ['Profesionales con título registrado en la SENESCYT', 'Atención en tu casa, con cita', 'Informe de la atención en la app'],
    servicios: ['Fisioterapia', 'Enfermería a domicilio', 'Consulta pediátrica', 'Cuidado de adultos mayores', 'Curso de primeros auxilios', 'Toma de muestras', 'Terapia de lenguaje', 'Nutrición', 'Cuidado posoperatorio'],
    aviso: 'HULUL no atiende emergencias. Si alguien está en peligro, llama al 911.',
  },
  {
    slug: 'cerrajeria',
    name: 'Cerrajería',
    seoName: 'Cerrajeros a domicilio',
    sub: 'Apertura de puertas, cambio de chapas y copias de llaves',
    icon: 'key',
    incluye: ['Revisión de la cerradura', 'Arreglo si se resuelve en la visita', 'Chapas y repuestos: cobro adicional en la app'],
    servicios: ['Apertura de puertas', 'Cambio de chapas y cerraduras', 'Copia de llaves', 'Cerraduras de seguridad', 'Apertura de autos', 'Cajas fuertes', 'Cerraduras digitales'],
  },
  {
    slug: 'carpinteria',
    name: 'Carpintería',
    seoName: 'Carpinteros a domicilio',
    sub: 'Muebles a medida, puertas, closets y reparaciones',
    icon: 'saw',
    incluye: ['Medición y revisión', 'Arreglo si se resuelve en la visita', 'Madera y herrajes: cobro adicional en la app'],
    servicios: ['Reparación de muebles', 'Muebles a medida', 'Closets y cocinas', 'Puertas y marcos', 'Armado de muebles', 'Pisos de madera', 'Lacado y restauración'],
  },
  {
    slug: 'albanileria',
    name: 'Albañilería',
    tileName: 'Albañi\u00ADlería',
    seoName: 'Albañiles y maestros de obra a domicilio',
    sub: 'Arreglos, cerámica, paredes, losas y pequeñas obras',
    icon: 'brick',
    incluye: ['Diagnóstico del trabajo', 'Arreglo si se resuelve en la visita', 'Materiales y trabajo extra: cobro adicional en la app'],
    servicios: ['Colocación de cerámica y porcelanato', 'Enlucido y paredes', 'Arreglo de goteras y losas', 'Gypsum y cielo falso', 'Contrapisos', 'Remodelación de baños', 'Remodelación de cocinas', 'Cerramientos'],
  },
  {
    slug: 'fumigacion',
    name: 'Fumigación',
    seoName: 'Fumigación de casas y departamentos',
    sub: 'Cucarachas, termitas, roedores, mosquitos y desinfección',
    icon: 'bug',
    incluye: ['Inspección de la plaga', 'Productos autorizados y seguros para tu familia', 'Recomendaciones después del servicio'],
    servicios: ['Cucarachas', 'Termitas y comején', 'Roedores', 'Mosquitos y zancudos', 'Hormigas', 'Desinfección de ambientes', 'Pulgas y garrapatas'],
  },
  {
    slug: 'mudanzas',
    name: 'Mudanzas',
    seoName: 'Mudanzas y fletes',
    sub: 'Mudanzas, fletes, cargadores y embalaje',
    icon: 'truck',
    incluye: ['Vehículo y personal de carga', 'Cuidado de tus muebles', 'Embalaje: lo acuerdas con el profesional'],
    servicios: ['Mudanza de casa', 'Mudanza de departamento', 'Fletes pequeños', 'Cargadores', 'Embalaje', 'Armado y desarmado de muebles', 'Mudanza de oficina'],
  },
  {
    slug: 'tecnologia',
    name: 'Tecnología',
    seoName: 'Técnicos de computadoras, redes y cámaras a domicilio',
    sub: 'Computadoras, internet y WiFi, cámaras, TV y celulares',
    icon: 'monitor',
    incluye: ['Diagnóstico del equipo', 'Arreglo si se resuelve en la visita', 'Repuestos: cobro adicional en la app'],
    servicios: ['Reparación de computadoras', 'Internet y WiFi', 'Cámaras de seguridad', 'Instalación de TV y soportes', 'Reparación de celulares', 'Impresoras', 'Alarmas y cerco eléctrico', 'Domótica y casa inteligente'],
  },
  {
    slug: 'servicios-profesionales',
    name: 'Servicios profesionales',
    tileName: 'Servicios profe\u00ADsionales',
    seoName: 'Ingenieros y arquitectos a domicilio: supervisión, inspección y asesoría',
    sub: 'Supervisión, inspección y asesoría técnica en una visita',
    icon: 'compass',
    incluye: ['Profesionales con título registrado en la SENESCYT', 'Una visita puntual con diagnóstico o informe', 'Si hace falta un proyecto completo, lo acuerdas con el profesional'],
    servicios: ['Supervisión hidrosanitaria', 'Supervisión de obra', 'Inspección de vivienda antes de comprar', 'Revisión de instalaciones eléctricas', 'Revisión estructural (grietas, fisuras)', 'Asesoría de remodelación', 'Medición y levantamiento de planos', 'Asesoría en permisos de construcción', 'Avalúo de vivienda'],
    aviso: 'Es una visita puntual: diagnóstico, inspección o asesoría. Diseños, planos completos o la dirección de una obra se acuerdan aparte con el profesional.',
  },
];
export function getCategory(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
