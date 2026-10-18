import type { Professional, Review } from './models';

/**
 * DATOS DE DEMOSTRACIÓN.
 * Nombres, valoraciones y precios son ficticios. Se reemplazan por los
 * documentos reales de Firestore cuando se conecte Firebase.
 */
export const demoProfessionals: Professional[] = [
  { id: 'carlos-mendoza', name: 'Carlos Mendoza', initials: 'CM', isCompany: false, category: 'climatizacion', cities: ['samborondon', 'guayaquil'], zone: 'Samborondón · La Puntilla', years: 12, hourlyRate: 20, rating: 4.9, reviewCount: 128, jobsDone: 214, verified: true, availableToday: true, bio: 'Técnico en refrigeración con 12 años de experiencia. Mantenimiento preventivo de splits, carga de gas R410A y R32, instalación y diagnóstico de equipos inverter.' },
  { id: 'andrea-villacis', name: 'Andrea Villacís', initials: 'AV', isCompany: false, category: 'climatizacion', cities: ['guayaquil'], zone: 'Urdesa · Kennedy', years: 7, hourlyRate: 22, rating: 4.8, reviewCount: 76, jobsDone: 98, verified: true, availableToday: false, bio: 'Instalación y mantenimiento de equipos split, cassette y ductos para hogares, oficinas y locales comerciales.' },
  { id: 'frio-express', name: 'Frío Express', initials: 'FE', isCompany: true, category: 'climatizacion', cities: ['guayaquil', 'samborondon', 'daule'], zone: 'Vía a la Costa · Los Ceibos', years: 9, hourlyRate: 25, rating: 4.7, reviewCount: 203, jobsDone: 340, verified: true, availableToday: true, bio: 'Equipo de cuatro técnicos. Atendemos urgencias el mismo día en Guayaquil, Samborondón y Daule.' },
  { id: 'jose-quinonez', name: 'José Quiñónez', initials: 'JQ', isCompany: false, category: 'plomeria', cities: ['guayaquil'], zone: 'Centro · Urdesa', years: 15, hourlyRate: 15, rating: 4.9, reviewCount: 152, jobsDone: 260, verified: true, availableToday: true, bio: 'Plomero con 15 años de oficio. Destapes con máquina, cambio de grifería, cisternas e hidroneumáticos.' },
  { id: 'hidro-soluciones', name: 'Hidro Soluciones', initials: 'HS', isCompany: true, category: 'plomeria', cities: ['samborondon', 'daule'], zone: 'Samborondón · Daule', years: 6, hourlyRate: 18, rating: 4.8, reviewCount: 88, jobsDone: 121, verified: true, availableToday: false, bio: 'Reparación de bombas de agua, presurizadores y redes de agua fría y caliente en casas y edificios.' },
  { id: 'luis-alvarado', name: 'Luis Alvarado', initials: 'LA', isCompany: false, category: 'electricidad', cities: ['guayaquil'], zone: 'Kennedy · Alborada', years: 10, hourlyRate: 15, rating: 4.9, reviewCount: 97, jobsDone: 175, verified: true, availableToday: true, bio: 'Electricista residencial: cortocircuitos, cambio de breakers, lámparas LED y balanceo de tableros.' },
  { id: 'voltio-gye', name: 'Voltio GYE', initials: 'VG', isCompany: true, category: 'electricidad', cities: ['samborondon', 'daule'], zone: 'Samborondón · La Aurora', years: 5, hourlyRate: 17, rating: 4.7, reviewCount: 54, jobsDone: 80, verified: true, availableToday: true, bio: 'Instalaciones eléctricas para casas y locales, acometidas y puesta a tierra.' },
  { id: 'tecnico-hogar', name: 'Técnico Hogar', initials: 'TH', isCompany: true, category: 'electrodomesticos', cities: ['guayaquil', 'samborondon'], zone: 'Norte de Guayaquil', years: 11, hourlyRate: 18, rating: 4.8, reviewCount: 110, jobsDone: 190, verified: true, availableToday: true, bio: 'Reparación de lavadoras y refrigeradoras de todas las marcas, incluso inverter.' },
  { id: 'ricardo-pena', name: 'Ricardo Peña', initials: 'RP', isCompany: false, category: 'electrodomesticos', cities: ['guayaquil'], zone: 'Sur · Centro', years: 8, hourlyRate: 15, rating: 4.7, reviewCount: 41, jobsDone: 63, verified: true, availableToday: false, bio: 'Cocinas de inducción, hornos y secadoras. Diagnóstico claro antes de cualquier cambio de pieza.' },
  { id: 'rosa-cedeno', name: 'Rosa Cedeño', initials: 'RC', isCompany: false, category: 'limpieza', cities: ['samborondon'], zone: 'Samborondón · Entre Ríos', years: 9, hourlyRate: 5, rating: 5.0, reviewCount: 210, jobsDone: 420, verified: true, availableToday: true, bio: 'Limpieza profunda de casas y departamentos. Muy cuidadosa con pisos de madera y mármol.' },
  { id: 'brillo-total', name: 'Brillo Total', initials: 'BT', isCompany: true, category: 'limpieza', cities: ['guayaquil', 'samborondon', 'daule'], zone: 'Urdesa · Los Ceibos', years: 4, hourlyRate: 7, rating: 4.8, reviewCount: 132, jobsDone: 300, verified: true, availableToday: true, bio: 'Equipo para limpieza post obra y mudanzas. Llevamos aspiradora industrial e hidrolavadora.' },
  { id: 'jardines-del-rio', name: 'Jardines del Río', initials: 'JR', isCompany: true, category: 'jardineria', cities: ['samborondon', 'daule'], zone: 'Samborondón · La Aurora', years: 8, hourlyRate: 8, rating: 4.9, reviewCount: 84, jobsDone: 190, verified: true, availableToday: true, bio: 'Mantenimiento de jardines en urbanizaciones: corte de césped, poda, abono y control de maleza.' },
  { id: 'segundo-chila', name: 'Segundo Chila', initials: 'SC', isCompany: false, category: 'jardineria', cities: ['guayaquil'], zone: 'Los Ceibos · Vía a la Costa', years: 14, hourlyRate: 7, rating: 4.8, reviewCount: 61, jobsDone: 150, verified: true, availableToday: false, bio: 'Jardinero con 14 años de experiencia. Poda de árboles, siembra de grama y sistemas de riego.' },
  { id: 'aqua-clean', name: 'Aqua Clean', initials: 'AC', isCompany: true, category: 'piscinas', cities: ['samborondon', 'guayaquil', 'daule'], zone: 'Samborondón · Vía a la Costa', years: 10, hourlyRate: 15, rating: 4.9, reviewCount: 102, jobsDone: 260, verified: true, availableToday: true, bio: 'Limpieza y balance químico de piscinas, recuperación de piscinas verdes y reparación de bombas.' },
  { id: 'marco-villamar', name: 'Marco Villamar', initials: 'MV', isCompany: false, category: 'piscinas', cities: ['guayaquil'], zone: 'Kennedy · Urdesa', years: 6, hourlyRate: 12, rating: 4.7, reviewCount: 39, jobsDone: 85, verified: true, availableToday: true, bio: 'Mantenimiento semanal o mensual de piscinas residenciales. Filtros de arena y cartucho.' },
  { id: 'color-hogar', name: 'Color Hogar', initials: 'CH', isCompany: true, category: 'pintura', cities: ['guayaquil', 'samborondon'], zone: 'Norte de Guayaquil · Samborondón', years: 9, hourlyRate: 12, rating: 4.8, reviewCount: 73, jobsDone: 140, verified: true, availableToday: false, bio: 'Pintura de interiores y fachadas, empaste, impermeabilización de losas y tratamiento de humedad.' },
  { id: 'wilson-macias', name: 'Wilson Macías', initials: 'WM', isCompany: false, category: 'pintura', cities: ['guayaquil', 'daule'], zone: 'Alborada · Daule', years: 18, hourlyRate: 10, rating: 4.9, reviewCount: 95, jobsDone: 230, verified: true, availableToday: true, bio: 'Pintor con 18 años de oficio. Acabados finos, lacado de puertas y pintura de rejas.' },
  { id: 'fisio-en-casa', name: 'Fisio en Casa', initials: 'FC', isCompany: true, category: 'salud', cities: ['guayaquil', 'samborondon', 'daule'], zone: 'Guayaquil · Samborondón', years: 7, hourlyRate: 30, rating: 4.9, reviewCount: 118, jobsDone: 520, verified: true, availableToday: true, bio: 'Fisioterapeutas titulados: rehabilitación después de cirugías, dolor de espalda y terapia para adultos mayores.' },
  { id: 'lcda-karina-mora', name: 'Lcda. Karina Mora', initials: 'KM', isCompany: false, category: 'salud', cities: ['samborondon', 'guayaquil'], zone: 'Samborondón · Urdesa', years: 11, hourlyRate: 15, rating: 5.0, reviewCount: 66, jobsDone: 300, verified: true, availableToday: false, bio: 'Licenciada en enfermería. Curaciones, inyecciones, toma de signos y cuidado de adultos mayores. Dicta cursos de primeros auxilios.' },
  { id: 'daniela-torres', name: 'Daniela Torres', initials: 'DT', isCompany: false, category: 'belleza', cities: ['samborondon', 'daule'], zone: 'Samborondón · Ciudad Celeste', years: 6, hourlyRate: 15, rating: 4.9, reviewCount: 189, jobsDone: 350, verified: true, availableToday: false, bio: 'Manicure y pedicure semipermanente, uñas acrílicas y diseño.' },
  { id: 'studio-glam', name: 'Studio Glam', initials: 'SG', isCompany: true, category: 'belleza', cities: ['guayaquil'], zone: 'Kennedy · Urdesa', years: 5, hourlyRate: 25, rating: 4.8, reviewCount: 95, jobsDone: 160, verified: true, availableToday: true, bio: 'Maquillaje y peinado para eventos, novias y sesiones de fotos.' },
  { id: 'huellitas-spa', name: 'Huellitas Spa', initials: 'HS', isCompany: true, category: 'mascotas', cities: ['samborondon', 'daule'], zone: 'Samborondón · Daule', years: 7, hourlyRate: 12, rating: 4.9, reviewCount: 140, jobsDone: 280, verified: true, availableToday: true, bio: 'Peluquería canina a domicilio en unidad móvil equipada.' },
  { id: 'paola-ruiz', name: 'Paola Ruiz', initials: 'PR', isCompany: false, category: 'mascotas', cities: ['guayaquil'], zone: 'Urdesa · Miraflores', years: 3, hourlyRate: 8, rating: 4.8, reviewCount: 60, jobsDone: 110, verified: true, availableToday: true, bio: 'Paseos y cuidado de perros y gatos.' },
  { id: 'gabriela-leon', name: 'Gabriela León', initials: 'GL', isCompany: false, category: 'clases', cities: ['samborondon', 'guayaquil'], zone: 'Samborondón · Kennedy', years: 12, hourlyRate: 12, rating: 5.0, reviewCount: 72, jobsDone: 400, verified: true, availableToday: false, bio: 'Licenciada en educación. Matemáticas y física para colegio y preuniversitario.' },
  { id: 'teacher-mike', name: 'Teacher Mike', initials: 'TM', isCompany: false, category: 'clases', cities: ['guayaquil', 'samborondon', 'daule'], zone: 'Online y a domicilio', years: 8, hourlyRate: 15, rating: 4.9, reviewCount: 58, jobsDone: 230, verified: true, availableToday: true, bio: 'Inglés conversacional y preparación para exámenes internacionales.' },
];

export const demoReviews: Pick<Review, 'clientName' | 'zone' | 'rating' | 'text'>[] = [
  { clientName: 'María José', zone: 'Urdesa', rating: 5, text: 'Puntual y muy ordenado. Explicó todo antes de empezar y dejó el área limpia.' },
  { clientName: 'Andrés', zone: 'La Aurora', rating: 5, text: 'Reservé por la app el mismo día y llegó a la hora. Ya lo volví a contratar.' },
];

export function prosByCategory(category: string, city?: string): Professional[] {
  return demoProfessionals.filter(
    (p) => p.category === category && (!city || p.cities.includes(city)),
  );
}

export function getProfessional(id: string): Professional | undefined {
  return demoProfessionals.find((p) => p.id === id);
}

export function formatRating(r: number): string {
  return r.toFixed(1).replace('.', ',');
}
