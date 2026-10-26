import { categories, type CategorySlug, type IconName } from './categories';

/**
 * Buscador de servicios: sugerencias mientras el cliente escribe.
 *
 * Busca en los nombres de categoría, en los servicios concretos y en palabras
 * que la gente usa en Ecuador aunque no sean el nombre oficial ("gasfitero",
 * "refri", "uñas"). Cada palabra escrita debe ser el comienzo de alguna palabra
 * de la frase, así con una sola letra ya salen opciones.
 */

/** Otras formas de decirlo, por categoría. */
const ALIASES: Record<CategorySlug, string[]> = {
  climatizacion: ['Aire acondicionado', 'Split', 'Técnico de aire', 'Mantenimiento de aire acondicionado', 'Aire que no enfría', 'Aire que gotea'],
  plomeria: ['Plomero', 'Gasfitero', 'Gasfitería', 'Fuga de agua', 'Inodoro', 'Cisterna', 'Calefón', 'Tubería tapada', 'Lavamanos'],
  electricidad: ['Electricista', 'Tomacorrientes', 'Enchufes', 'Cortocircuito', 'Se fue la luz', 'Instalación eléctrica'],
  electrodomesticos: ['Técnico de electrodomésticos', 'Lavadora', 'Refrigeradora', 'Refri', 'Nevera', 'Secadora', 'Microondas', 'Cocina'],
  jardineria: ['Jardinero', 'Cortar el césped', 'Podar', 'Grama', 'Plantas', 'Paisajismo'],
  piscinas: ['Piscinero', 'Piscina verde', 'Cloro', 'Bomba de piscina', 'Filtro de piscina'],
  pintura: ['Pintor', 'Pintar casa', 'Pintar paredes', 'Fachada', 'Humedad en paredes', 'Empastado'],
  salud: ['Fisioterapeuta', 'Terapia física', 'Rehabilitación', 'Enfermera', 'Pediatra', 'Primeros auxilios', 'Inyecciones', 'Adulto mayor', 'Cuidadora', 'Exámenes de laboratorio'],
  cerrajeria: ['Cerrajero', 'Se me quedaron las llaves', 'Chapa', 'Cerradura', 'Llaves'],
  carpinteria: ['Carpintero', 'Ebanista', 'Muebles', 'Closet', 'Puerta de madera'],
  albanileria: ['Albañil', 'Maestro de obra', 'Cerámica', 'Porcelanato', 'Gotera', 'Gypsum', 'Remodelación'],
  fumigacion: ['Fumigador', 'Cucarachas', 'Termitas', 'Comején', 'Ratas', 'Ratones', 'Mosquitos', 'Plagas', 'Hormigas'],
  mudanzas: ['Mudanza', 'Flete', 'Camión', 'Cargadores', 'Trasteo'],
  tecnologia: ['Técnico de computadoras', 'Laptop', 'WiFi', 'Internet', 'Cámaras', 'Celular', 'Televisor', 'Impresora', 'Router'],
  limpieza: ['Empleada doméstica', 'Señora de limpieza', 'Aseo de casa', 'Limpieza de departamento', 'Limpieza de muebles', 'Limpieza de colchones'],
  belleza: ['Uñas', 'Manicure', 'Pedicure', 'Corte de cabello', 'Barbero', 'Cejas', 'Pestañas', 'Peluquería'],
  'servicios-profesionales': ['Ingeniero', 'Ingeniero civil', 'Arquitecto', 'Ingeniero eléctrico', 'Supervisor de obra', 'Fiscalizador', 'Hidrosanitario', 'Inspección de casa', 'Grietas', 'Planos', 'Permiso de construcción', 'Avalúo', 'Perito'],
  mascotas: ['Baño de perros', 'Groomer', 'Paseador de perros', 'Gatos', 'Cuidado de perros'],
  clases: ['Profesor particular', 'Tutor', 'Refuerzo escolar', 'Inglés', 'Matemáticas', 'Guitarra', 'Piano'],
};

/** Palabras que no cuentan al buscar ("de", "la"…). */
const STOP = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'a', 'en', 'por', 'para', 'con', 'que', 'se', 'no', 'mi', 'un', 'una']);

export const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export interface ServiceSuggestion {
  /** Lo que se muestra: "Destape de tuberías" */
  label: string;
  slug: CategorySlug;
  /** Nombre de la categoría: "Plomería" */
  category: string;
  icon: IconName;
}

interface Entry extends ServiceSuggestion {
  words: string[];
  phrase: string;
  /** 0 categoría, 1 servicio, 2 otra forma de decirlo: desempata el orden. */
  kind: number;
}

const ENTRIES: Entry[] = categories.flatMap((c) => {
  const make = (label: string, kind: number): Entry => {
    const phrase = normalize(label);
    return {
      label, slug: c.slug, category: c.name, icon: c.icon, kind, phrase,
      words: phrase.split(/[^a-z0-9ñ]+/).filter((w) => w && !STOP.has(w)),
    };
  };
  return [make(c.name, 0), ...c.servicios.map((s) => make(s, 1)), ...ALIASES[c.slug].map((a) => make(a, 2))];
});

/** Sugerencias para lo que el cliente lleva escrito. */
export function suggestServices(input: string, limit = 6): ServiceSuggestion[] {
  const all = normalize(input).split(/[^a-z0-9ñ]+/).filter(Boolean);
  // La última palabra se está escribiendo: "de" puede ser el inicio de "destape".
  const terms = all.filter((t, i) => i === all.length - 1 || !STOP.has(t));
  if (!terms.length) return [];
  const scored: { e: Entry; score: number }[] = [];
  for (const e of ENTRIES) {
    const hit = (t: string) => e.words.some((w) => w.startsWith(t));
    // "limpieza de": si la última es una palabra corta como "de", no exige que aparezca.
    const ok = terms.every((t, i) => hit(t) || (i === terms.length - 1 && i > 0 && STOP.has(t)));
    if (!ok) continue;
    // Primero lo que empieza igual que lo escrito, luego categorías y servicios.
    const score = (e.phrase.startsWith(terms[0]) ? 0 : 10) + e.kind;
    scored.push({ e, score });
  }
  // Orden estable: a igual puntaje, el orden en que están definidos.
  scored.sort((a, b) => a.score - b.score);
  const seen = new Set<string>();
  const out: ServiceSuggestion[] = [];
  for (const { e } of scored) {
    const key = normalize(e.label);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label: e.label, slug: e.slug, category: e.category, icon: e.icon });
    if (out.length >= limit) break;
  }
  return out;
}

/** Categorías que corresponden a una búsqueda (página de resultados). */
export function searchCategories(input: string): CategorySlug[] {
  return [...new Set(suggestServices(input, 50).map((s) => s.slug))];
}

/** Sugerencias para mostrar antes de escribir. */
export const POPULAR_SEARCHES: ServiceSuggestion[] = [
  'Mantenimiento de split', 'Limpieza por horas', 'Destape de tuberías', 'Electricista urgente', 'Manicure y pedicure',
].map((label) => {
  const e = ENTRIES.find((x) => x.label === label)!;
  return { label, slug: e.slug, category: e.category, icon: e.icon };
});
