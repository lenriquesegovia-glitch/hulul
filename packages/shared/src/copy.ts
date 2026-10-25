import type { CategorySlug } from './categories';
import type { JobOutcome } from './policy';

/**
 * Textos que cambian según el tipo de actividad. HULUL no es solo para
 * arreglar cosas: también se contrata un paseo de perros, una manicure o una
 * clase. Por eso el lenguaje es neutro y positivo ("servicio", "resumen"), y
 * solo en los oficios técnicos se habla de revisar y resolver.
 */
export type ServiceStyle = 'tecnico' | 'servicio';

const TECNICO: CategorySlug[] = [
  'climatizacion', 'plomeria', 'electricidad', 'electrodomesticos', 'piscinas', 'pintura',
  'cerrajeria', 'carpinteria', 'albanileria', 'fumigacion', 'tecnologia',
];

export function serviceStyle(slug?: string): ServiceStyle {
  return TECNICO.includes(slug as CategorySlug) ? 'tecnico' : 'servicio';
}

/** Ejemplo para el campo de detalles al reservar. */
const DETAIL_EXAMPLE: Partial<Record<CategorySlug, string>> = {
  climatizacion: 'Ej.: 2 splits de 12.000 BTU, uno gotea agua',
  plomeria: 'Ej.: la llave del lavabo gotea',
  electricidad: 'Ej.: instalar 3 lámparas en la sala',
  electrodomesticos: 'Ej.: la lavadora no centrifuga',
  limpieza: 'Ej.: departamento de 2 habitaciones y 2 baños',
  jardineria: 'Ej.: cortar césped y podar 4 arbustos',
  piscinas: 'Ej.: piscina de 6 × 3 m, agua un poco verde',
  pintura: 'Ej.: pintar una habitación de 3 × 4 m',
  salud: 'Ej.: sesión de fisioterapia para la espalda',
  belleza: 'Ej.: manicure y pedicure en gel',
  mascotas: 'Ej.: Max, labrador de 3 años, tranquilo; paseo de 45 minutos',
  clases: 'Ej.: refuerzo de matemáticas para 8vo de básica',
  cerrajeria: 'Ej.: cambiar la cerradura de la puerta principal',
  carpinteria: 'Ej.: ajustar 2 puertas de clóset',
  albanileria: 'Ej.: resanar una pared de 2 m',
  fumigacion: 'Ej.: casa de 120 m², hormigas en la cocina',
  mudanzas: 'Ej.: departamento de 2 habitaciones, 3er piso sin ascensor',
  tecnologia: 'Ej.: configurar el wifi y una impresora',
};

/** Foto opcional al reservar: qué sirve mostrar. */
const PHOTO_HELP: Partial<Record<CategorySlug, string>> = {
  mascotas: 'Una foto de tu mascota ayuda al profesional a conocerla.',
  belleza: 'Si tienes una foto del estilo que te gusta, compártela.',
  limpieza: 'Una foto de los espacios ayuda a calcular el tiempo.',
  jardineria: 'Una foto del jardín ayuda al profesional a saber qué llevar.',
  mudanzas: 'Fotos de lo que hay que trasladar ayudan a planificar.',
  clases: 'Si quieres, comparte una foto de la tarea o el tema.',
  salud: 'Puedes compartir una orden o indicación médica si la tienes.',
};

interface OutcomeCopy { label: string; help: string }

export interface ServiceCopy {
  style: ServiceStyle;
  /** "¿Qué necesitas?" al reservar. */
  jobQuestion: string;
  /** Opción libre. */
  otherJob: string;
  detailsPlaceholder: string;
  detailsHelp: string;
  photosLabel: string;
  photosHelp: string;
  /** Lo que cubre el precio, junto al monto. */
  priceCovers: string;
  /** Nota bajo el total. */
  priceNote: string;
  outcomes: Record<JobOutcome, OutcomeCopy>;
  /** Título del informe que deja el profesional. */
  reportTitle: string;
  reportPlaceholder: string;
  photosAtEnd: string;
  /** Botón y título para pedir ayuda con el servicio. */
  helpButton: string;
  helpTitle: string;
  helpOptions: { value: 'no_vino' | 'incompleto' | 'cobro' | 'trato' | 'dano' | 'otro'; label: string }[];
  /** Pasos del seguimiento. */
  inProgress: string;
  finished: string;
}

const COMMON_HELP = { button: 'Ayuda con este servicio', title: '¿Algo no salió como esperabas?' };

export function serviceCopy(slug?: string): ServiceCopy {
  const style = serviceStyle(slug);
  const s = slug as CategorySlug;
  if (style === 'tecnico') {
    return {
      style,
      jobQuestion: '¿Qué necesitas?',
      otherJob: 'Otro',
      detailsPlaceholder: DETAIL_EXAMPLE[s] ?? 'Cuéntanos qué necesitas',
      detailsHelp: 'Qué equipo o qué espacio, y cualquier dato que ayude al profesional.',
      photosLabel: 'Fotos (opcional)',
      photosHelp: PHOTO_HELP[s] ?? 'Una foto del equipo o del lugar ayuda al profesional a saber qué llevar.',
      priceCovers: 'traslado, revisión y lo que se resuelva en la visita',
      priceNote: 'La visita cubre el traslado, la revisión y lo que se resuelva en ella. Si hace falta algo más (repuestos, más tiempo u otra visita), el profesional te lo propone en la app y tú decides.',
      outcomes: {
        resuelto: { label: 'Listo', help: 'Quedó funcionando en esta visita.' },
        parcial: { label: 'Falta completar', help: 'Hace falta un repuesto, más tiempo u otra visita. Explica qué y propónselo al cliente.' },
        no_resuelto: { label: 'Requiere otra solución', help: 'Explica qué encontraste y qué recomiendas.' },
      },
      reportTitle: 'Informe de la visita',
      reportPlaceholder: 'Qué revisaste, qué hiciste y qué recomiendas',
      photosAtEnd: 'Fotos del trabajo',
      helpButton: COMMON_HELP.button,
      helpTitle: COMMON_HELP.title,
      helpOptions: [
        { value: 'no_vino', label: 'No se realizó el trabajo' },
        { value: 'incompleto', label: 'Se marcó como listo, pero no quedó funcionando' },
        { value: 'cobro', label: 'El cobro no fue el acordado' },
        { value: 'trato', label: 'Me trató mal o fue irrespetuoso' },
        { value: 'dano', label: 'Dañó algo de mi casa' },
        { value: 'otro', label: 'Otra cosa' },
      ],
      inProgress: 'Revisa y resuelve lo que se pueda en la visita.',
      finished: 'Te deja un informe con fotos. Tú lo calificas.',
    };
  }
  return {
    style,
    jobQuestion: '¿Qué servicio quieres?',
    otherJob: 'Otro',
    detailsPlaceholder: DETAIL_EXAMPLE[s] ?? 'Cuéntanos lo que quieres',
    detailsHelp: 'Cualquier detalle que ayude al profesional a preparar tu servicio.',
    photosLabel: 'Fotos (opcional)',
    photosHelp: PHOTO_HELP[s] ?? 'Si una foto ayuda, compártela.',
    priceCovers: 'traslado y el servicio que reservaste',
    priceNote: 'El precio incluye el traslado y el servicio que reservaste. Si quieres algo más (más tiempo u otro servicio), el profesional te lo propone en la app y tú decides.',
    outcomes: {
      resuelto: { label: 'Servicio completo', help: 'Se hizo todo lo reservado.' },
      parcial: { label: 'Completado en parte', help: 'Faltó algo o se necesita más tiempo. Cuéntale al cliente y propónselo.' },
      no_resuelto: { label: 'No se pudo realizar', help: 'Explica qué pasó.' },
    },
    reportTitle: 'Resumen del servicio',
    reportPlaceholder: 'Cómo fue el servicio y cualquier recomendación',
    photosAtEnd: 'Fotos del servicio',
    helpButton: COMMON_HELP.button,
    helpTitle: COMMON_HELP.title,
    helpOptions: [
      { value: 'no_vino', label: 'No se realizó el servicio' },
      { value: 'incompleto', label: 'Se marcó como completo, pero no lo fue' },
      { value: 'cobro', label: 'El cobro no fue el acordado' },
      { value: 'trato', label: 'Me trató mal o fue irrespetuoso' },
      { value: 'dano', label: 'Dañó algo de mi casa' },
      { value: 'otro', label: 'Otra cosa' },
    ],
    inProgress: 'Disfruta tu servicio.',
    finished: 'Te deja un resumen con fotos. Tú lo calificas.',
  };
}

/** Etiqueta del resultado según la actividad. */
export function outcomeLabel(outcome: JobOutcome, slug?: string): string {
  return serviceCopy(slug).outcomes[outcome]?.label ?? '';
}
