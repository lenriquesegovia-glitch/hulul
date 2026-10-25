/**
 * Actividades que un profesional puede proponer además de las 18 categorías.
 *
 * Al registrarse, si su oficio no está entre las categorías, el profesional lo
 * busca en este catálogo (o escribe uno nuevo) y marca sus trabajos. Queda
 * como propuesta en revisión (`providers/{uid}.proposals`): los clientes no la
 * ven ni la pueden reservar hasta que HULUL la apruebe y la convierta en
 * categoría (o la sume a una existente).
 *
 * Cuando HULUL apruebe una actividad nueva escrita por un profesional, se
 * agrega aquí para que los siguientes la encuentren en la lista.
 */
import { categories, type CategorySlug } from './categories';

export interface ExtraActivity {
  id: string;
  name: string;
  /** Trabajos más comunes (no es una lista cerrada). */
  services: string[];
  /** Categoría cercana, para que HULUL decida si la suma ahí. */
  near?: CategorySlug;
}

export const EXTRA_ACTIVITIES: ExtraActivity[] = [
  { id: 'cuidado-adultos', name: 'Cuidado de adultos mayores', services: ['Acompañamiento por horas', 'Cuidado nocturno', 'Ayuda con aseo y alimentación', 'Acompañamiento a citas médicas'], near: 'salud' },
  { id: 'ninera', name: 'Niñera y cuidado de niños', services: ['Cuidado por horas', 'Cuidado nocturno', 'Recoger del colegio', 'Ayuda con tareas'] },
  { id: 'enfermeria', name: 'Enfermería a domicilio', services: ['Inyecciones y sueros', 'Curaciones', 'Toma de signos vitales', 'Cuidado postoperatorio'], near: 'salud' },
  { id: 'fisioterapia', name: 'Fisioterapia', services: ['Rehabilitación', 'Terapia respiratoria', 'Masaje terapéutico', 'Terapia para adultos mayores'], near: 'salud' },
  { id: 'nutricion', name: 'Nutrición', services: ['Consulta nutricional', 'Plan de alimentación', 'Control de peso'], near: 'salud' },
  { id: 'psicologia', name: 'Psicología', services: ['Terapia individual', 'Terapia de pareja', 'Terapia infantil', 'Orientación familiar'], near: 'salud' },
  { id: 'masajes', name: 'Masajes y spa', services: ['Masaje relajante', 'Masaje descontracturante', 'Drenaje linfático', 'Reflexología'], near: 'belleza' },
  { id: 'entrenador', name: 'Entrenador personal', services: ['Entrenamiento funcional', 'Yoga', 'Pilates', 'Bailoterapia'] },
  { id: 'chef', name: 'Chef y cocina a domicilio', services: ['Cena privada', 'Comida de la semana', 'Clases de cocina', 'Parrillada'] },
  { id: 'eventos', name: 'Eventos y fiestas', services: ['Decoración de eventos', 'Catering', 'Meseros', 'Animación infantil', 'DJ y sonido', 'Alquiler de mobiliario'] },
  { id: 'foto-video', name: 'Fotografía y video', services: ['Sesión de fotos', 'Fotos de eventos', 'Video de eventos', 'Fotos de producto o inmueble'] },
  { id: 'lavanderia', name: 'Lavado y planchado', services: ['Planchado por horas', 'Lavado de ropa', 'Lavado de cortinas'], near: 'limpieza' },
  { id: 'lavado-muebles', name: 'Lavado de muebles, colchones y alfombras', services: ['Lavado de muebles', 'Lavado de colchones', 'Lavado de alfombras', 'Lavado de sillas de auto'], near: 'limpieza' },
  { id: 'costura', name: 'Costura y arreglos de ropa', services: ['Arreglos de ropa', 'Confección a medida', 'Cortinas a medida', 'Uniformes'] },
  { id: 'tapiceria', name: 'Tapicería', services: ['Tapizado de muebles', 'Tapizado de sillas', 'Reparación de espumas', 'Tapicería de autos'] },
  { id: 'vidrieria', name: 'Vidriería y aluminio', services: ['Cambio de vidrios', 'Ventanas de aluminio', 'Puertas de vidrio', 'Mamparas de baño', 'Espejos'] },
  { id: 'herreria', name: 'Herrería y soldadura', services: ['Puertas y rejas', 'Soldadura en general', 'Pasamanos', 'Estructuras metálicas', 'Reparación de portones'] },
  { id: 'techos', name: 'Techos e impermeabilización', services: ['Arreglo de goteras', 'Impermeabilización de losas', 'Cambio de techo', 'Canaletas y bajantes'], near: 'albanileria' },
  { id: 'gypsum', name: 'Gypsum y cielo raso', services: ['Cielo raso', 'Paredes de gypsum', 'Reparación de cielo raso', 'Muebles de gypsum'], near: 'albanileria' },
  { id: 'pisos', name: 'Pisos y porcelanato', services: ['Instalación de porcelanato', 'Piso flotante', 'Pulido y cristalizado', 'Cambio de baldosas'], near: 'albanileria' },
  { id: 'cortinas', name: 'Cortinas y persianas', services: ['Instalación de cortinas', 'Persianas y roller', 'Reparación de persianas', 'Toldos'] },
  { id: 'armado-muebles', name: 'Armado e instalación de muebles', services: ['Armado de muebles', 'Instalación de repisas y cuadros', 'Montaje de TV', 'Instalación de cocinas'], near: 'carpinteria' },
  { id: 'puertas-automaticas', name: 'Puertas automáticas y motores', services: ['Motores de portón', 'Puertas eléctricas', 'Controles remotos', 'Mantenimiento de motores'] },
  { id: 'paneles-solares', name: 'Paneles solares y calentadores', services: ['Instalación de paneles solares', 'Calentadores solares', 'Mantenimiento de paneles'], near: 'electricidad' },
  { id: 'generadores', name: 'Generadores y UPS', services: ['Mantenimiento de generadores', 'Instalación de UPS', 'Transferencias automáticas'], near: 'electricidad' },
  { id: 'gas', name: 'Gas doméstico y centralizado', services: ['Instalación de gas centralizado', 'Revisión de fugas de gas', 'Instalación de cocinas a gas'] },
  { id: 'cisternas', name: 'Limpieza de cisternas y pozos', services: ['Limpieza de cisternas', 'Desinfección de tanques', 'Limpieza de pozo séptico', 'Hidrosuccionador'], near: 'plomeria' },
  { id: 'vidrios-altura', name: 'Limpieza de vidrios y fachadas', services: ['Vidrios en altura', 'Lavado de fachadas', 'Hidrolavado de pisos y paredes'], near: 'limpieza' },
  { id: 'mecanica', name: 'Mecánica a domicilio', services: ['Cambio de aceite', 'Batería y arranque', 'Diagnóstico con escáner', 'Frenos'] },
  { id: 'lavado-autos', name: 'Lavado de autos a domicilio', services: ['Lavado exterior', 'Lavado completo', 'Pulido y encerado', 'Limpieza de tapicería'] },
  { id: 'cerramientos', name: 'Cerramientos y cercas', services: ['Malla y cerca', 'Cerco eléctrico', 'Concertina', 'Muros y cerramientos'] },
  { id: 'diseno-interiores', name: 'Diseño de interiores', services: ['Asesoría de decoración', 'Diseño de espacios', 'Remodelación de cocinas y baños'] },
  { id: 'mensajeria', name: 'Mandados y trámites', services: ['Mandados y compras', 'Trámites', 'Pagos de servicios', 'Entregas locales'] },
  { id: 'paseo-perros', name: 'Paseo y cuidado de mascotas', services: ['Paseo de perros', 'Cuidado en casa', 'Baño a domicilio'], near: 'mascotas' },
  { id: 'veterinaria', name: 'Veterinaria a domicilio', services: ['Consulta veterinaria', 'Vacunas', 'Desparasitación'], near: 'mascotas' },
  { id: 'musica', name: 'Clases de música y arte', services: ['Guitarra', 'Piano', 'Canto', 'Dibujo y pintura'], near: 'clases' },
  { id: 'idiomas', name: 'Clases de idiomas', services: ['Inglés', 'Francés', 'Español para extranjeros', 'Preparación de exámenes'], near: 'clases' },
];

/** Propuesta de actividad nueva que hace un profesional (queda en revisión). */
export interface ActivityProposal {
  /** Id del catálogo, o `nueva-…` si la escribió él. */
  id: string;
  name: string;
  services: string[];
  /** Tarifa por visita que propone (USD). */
  rate?: number;
  /** Cómo demuestra que sabe hacerlo (certificado, años, dónde trabajó). */
  note: string;
}

export const MAX_PROPOSALS = 10;

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Busca en el catálogo de actividades y en los trabajos de las 18 categorías. */
export function searchActivities(q: string): { activities: ExtraActivity[]; inCategory: { category: CategorySlug; name: string; service: string }[] } {
  const t = norm(q);
  if (t.length < 2) return { activities: EXTRA_ACTIVITIES, inCategory: [] };
  const words = t.split(/\s+/).filter((w) => w.length > 1);
  const hit = (s: string) => words.every((w) => norm(s).includes(w));
  const activities = EXTRA_ACTIVITIES.filter((a) => hit(a.name) || a.services.some(hit));
  const inCategory: { category: CategorySlug; name: string; service: string }[] = [];
  for (const c of categories) {
    if (hit(c.name)) { inCategory.push({ category: c.slug, name: c.name, service: '' }); continue; }
    const s = c.servicios.find(hit);
    if (s) inCategory.push({ category: c.slug, name: c.name, service: s });
  }
  return { activities, inCategory: inCategory.slice(0, 4) };
}

/** Qué le falta a una propuesta para poder enviarla ('' si está completa). */
export function proposalProblem(p: ActivityProposal): string {
  if (p.name.trim().length < 3) return 'Escribe el nombre de la actividad.';
  if (!p.services.length) return `Marca o escribe al menos un trabajo de ${p.name}.`;
  if (!(Number(p.rate) >= 1 && Number(p.rate) <= 500)) return `Pon tu tarifa por visita en ${p.name}.`;
  if (p.note.trim().length < 10) return `Cuenta cómo demuestras que sabes hacer ${p.name.toLowerCase()} (al menos 10 caracteres).`;
  return '';
}
