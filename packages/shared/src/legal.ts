/**
 * Textos legales de HULUL, compartidos entre la web y la app.
 *
 * BORRADOR: redactado a partir de la Ley Orgánica de Protección de Datos
 * Personales del Ecuador (LOPDP, R.O. 5.º Supl. 459, 26-05-2021), con
 * secciones para usuarios de la Unión Europea (RGPD) y de Estados Unidos.
 * Debe revisarlo un abogado antes de publicar la plataforma.
 *
 * Los datos entre corchetes son marcadores: complétalos en `company`.
 */

export const company = {
  razonSocial: '[RAZÓN SOCIAL DE HULUL]',
  ruc: '[RUC]',
  direccion: '[DIRECCIÓN DEL DOMICILIO LEGAL], Guayaquil, Ecuador',
  emailPrivacidad: 'privacidad@hululec.com',
  /** Delegado de protección de datos, si se designa. */
  delegado: '[NOMBRE DEL DELEGADO DE PROTECCIÓN DE DATOS, si aplica]',
  pasarelaPago: '[PASARELA DE PAGOS: Payphone, Kushki o Datafast]',
};

/**
 * Versión de la política. Al cambiarla, la web y la app vuelven a pedir
 * la aceptación a todos los usuarios.
 */
export const PRIVACY_VERSION = '2026-10-24';
export const PRIVACY_UPDATED = '14 de octubre de 2026';

export type LegalBlock = { p: string } | { ul: string[] };

export interface LegalSection {
  id: string;
  title: string;
  body: LegalBlock[];
}

/** Resumen corto que se muestra al aceptar (pantalla de bienvenida y registro). */
export const privacySummary: string[] = [
  'Usamos tus datos para conectar tu solicitud con un profesional, procesar el pago, emitir tu factura y darte soporte.',
  'Compartimos con el profesional solo lo necesario para el servicio: tu nombre, la dirección y lo que describas.',
  'No vendemos tus datos. La publicidad y las estadísticas solo se activan si tú lo aceptas.',
  'Puedes acceder, corregir, eliminar o llevarte tus datos cuando quieras escribiendo a ' + company.emailPrivacidad + '.',
];

export const privacyPolicy: LegalSection[] = [
  {
    id: 'responsable',
    title: '1. Quién es responsable de tus datos',
    body: [
      { p: `${company.razonSocial} (en adelante, "HULUL"), con RUC ${company.ruc} y domicilio en ${company.direccion}, es responsable del tratamiento de los datos personales que se recogen a través del sitio web hululec.com y las aplicaciones móviles de HULUL (en conjunto, la "Plataforma").` },
      { p: `Para cualquier asunto sobre tus datos puedes escribirnos a ${company.emailPrivacidad}.` },
      { p: `Delegado de protección de datos: ${company.delegado}.` },
      { p: 'Esta política se rige por la Ley Orgánica de Protección de Datos Personales del Ecuador (LOPDP) y su Reglamento. Si resides fuera del Ecuador, revisa también la sección 11.' },
    ],
  },
  {
    id: 'datos',
    title: '2. Qué datos recogemos',
    body: [
      { p: 'Si contratas servicios (cliente):' },
      { ul: [
        'Datos de cuenta: nombre, apellido, número de celular y correo electrónico.',
        'Datos del servicio: dirección donde se realizará, descripción de lo que necesitas, fotos que decidas adjuntar, fecha y hora.',
        'Datos de facturación: nombre o razón social, cédula o RUC y correo, para emitir la factura electrónica.',
        'Datos de pago: los procesa directamente la pasarela de pagos. HULUL no guarda el número completo de tu tarjeta.',
        'Reseñas y calificaciones que publiques sobre los profesionales.',
      ] },
      { p: 'Si ofreces servicios (profesional):' },
      { ul: [
        'Datos de identidad y verificación: nombre, cédula o RUC, foto de perfil, y los documentos y referencias que entregues para verificar tu experiencia.',
        'Datos de contacto: celular, correo y ciudad o zonas donde trabajas.',
        'Datos de cobro: banco y número de cuenta donde recibirás tus pagos.',
        'Datos de actividad: servicios realizados, calificaciones recibidas, agenda y disponibilidad.',
      ] },
      { p: 'De todos los usuarios, de forma automática:' },
      { ul: [
        'Ubicación: solo si das permiso en tu teléfono. Al cliente la usamos para ubicar la dirección del servicio; al profesional, para mostrar su llegada mientras va en camino a un servicio confirmado.',
        'Datos técnicos: dirección IP, tipo de dispositivo y navegador, sistema operativo, y páginas o pantallas visitadas.',
        'Cookies y tecnologías similares, según se explica en la Política de Cookies.',
        'Mensajes que intercambies con HULUL o con el profesional a través de la Plataforma, y las conversaciones con soporte.',
      ] },
      { p: 'No pedimos datos sensibles (como salud, religión u orientación) para usar la Plataforma. Te pedimos no incluirlos en las descripciones o mensajes.' },
    ],
  },
  {
    id: 'finalidades',
    title: '3. Para qué usamos tus datos y con qué base legal',
    body: [
      { p: 'Usamos tus datos solo para estas finalidades, cada una con su base legal según el artículo 7 de la LOPDP:' },
      { ul: [
        'Crear y administrar tu cuenta, gestionar reservas, conectar al cliente con el profesional, procesar pagos, liberar el pago al profesional y gestionar cancelaciones o reembolsos. Base: ejecución del contrato que aceptas al usar la Plataforma.',
        'Emitir facturas electrónicas y conservar registros contables y tributarios. Base: cumplimiento de obligaciones legales ante el Servicio de Rentas Internas (SRI).',
        'Verificar la identidad y experiencia de los profesionales, prevenir fraudes y proteger la seguridad de clientes y profesionales. Base: interés legítimo de HULUL y de los usuarios en una plataforma segura.',
        'Dar soporte y resolver reclamos. Base: ejecución del contrato.',
        'Enviarte avisos sobre tus reservas (confirmaciones, recordatorios, cambios) por notificación, SMS, WhatsApp o correo. Base: ejecución del contrato.',
        'Medir el uso de la Plataforma con herramientas de analítica para mejorarla. Base: tu consentimiento, que puedes retirar en cualquier momento.',
        'Enviarte promociones y novedades de HULUL. Base: tu consentimiento, que se pide por separado y que puedes retirar en cualquier momento.',
      ] },
      { p: 'No tomamos decisiones que te afecten de forma significativa basadas únicamente en procesos automáticos. El orden en que se muestran los profesionales (por calificación, disponibilidad o precio) es un criterio que tú eliges.' },
    ],
  },
  {
    id: 'compartir',
    title: '4. Con quién compartimos tus datos',
    body: [
      { p: 'No vendemos ni alquilamos tus datos personales. Solo los compartimos con:' },
      { ul: [
        'El profesional o el cliente de tu reserva: solo lo necesario para el servicio, como nombre, dirección, descripción del trabajo y medio de contacto dentro de la Plataforma. El profesional asignado puede consultar el promedio y la cantidad de calificaciones del cliente para evaluar la solicitud. Los comentarios privados del cliente no se publican.',
        `La pasarela de pagos (${company.pasarelaPago}), para procesar cobros, retenciones y reembolsos.`,
        'Proveedores tecnológicos que trabajan por encargo de HULUL: alojamiento y base de datos (Google Cloud / Firebase), alojamiento del sitio web (Vercel), envío de notificaciones, mapas (Google Maps) y mensajería. Solo pueden usar los datos para prestar su servicio a HULUL.',
        'El Servicio de Rentas Internas (SRI) y otras autoridades, cuando la ley o una orden judicial lo exijan.',
        'Un eventual comprador o sucesor de HULUL, si la empresa se fusiona o vende. Te lo informaríamos con anticipación.',
      ] },
    ],
  },
  {
    id: 'transferencias',
    title: '5. Transferencias internacionales',
    body: [
      { p: 'Algunos de nuestros proveedores guardan o procesan datos fuera del Ecuador. Nuestra base de datos principal está en servidores de Google Cloud en São Paulo (Brasil), y algunos servicios técnicos operan desde Estados Unidos.' },
      { p: 'Estas transferencias se hacen conforme al capítulo de transferencias internacionales de la LOPDP: a países declarados con nivel adecuado de protección o, en su defecto, con garantías contractuales que obligan al proveedor a proteger tus datos con un estándar igual o superior al ecuatoriano. Puedes pedirnos información sobre estas garantías a ' + company.emailPrivacidad + '.' },
    ],
  },
  {
    id: 'conservacion',
    title: '6. Cuánto tiempo guardamos tus datos',
    body: [
      { ul: [
        'Datos de cuenta y perfil: mientras tu cuenta esté activa. Si la eliminas, los borramos o anonimizamos, salvo lo indicado abajo.',
        'Facturas y registros de pago: el plazo que exige la normativa tributaria y contable del Ecuador.',
        'Historial de reservas, mensajes y reclamos: hasta que prescriban las acciones legales que pudieran derivarse del servicio.',
        'Datos usados con tu consentimiento (analítica, promociones): hasta que lo retires.',
        'Solicitudes para ejercer tus derechos y sus respuestas: al menos el tiempo que exija la Autoridad de Protección de Datos.',
      ] },
    ],
  },
  {
    id: 'derechos',
    title: '7. Tus derechos',
    body: [
      { p: 'Según la LOPDP tienes derecho a:' },
      { ul: [
        'Acceso (art. 13): saber qué datos tuyos tratamos y obtener una copia.',
        'Rectificación y actualización (art. 14): corregir datos inexactos o incompletos.',
        'Eliminación (art. 15): pedir que borremos tus datos cuando ya no sean necesarios o retires tu consentimiento.',
        'Oposición (art. 16): oponerte a ciertos tratamientos, como la publicidad.',
        'Portabilidad (art. 17): recibir tus datos en un formato estructurado y de uso común.',
        'Suspensión del tratamiento (art. 19).',
        'No ser objeto de decisiones basadas únicamente en valoraciones automatizadas (art. 20).',
        'Revocar tu consentimiento en cualquier momento, sin que eso afecte lo tratado antes.',
      ] },
      { p: `Para ejercerlos, escribe a ${company.emailPrivacidad} desde el correo o celular registrado en tu cuenta, indicando qué derecho quieres ejercer. Es gratuito. Te responderemos en un plazo máximo de 15 días.` },
      { p: 'Muchos datos puedes verlos y corregirlos directamente en tu perfil, y puedes eliminar tu cuenta desde la configuración de la app.' },
      { p: 'Si no estás conforme con nuestra respuesta, puedes presentar un reclamo ante la Superintendencia de Protección de Datos Personales del Ecuador (spdp.gob.ec).' },
    ],
  },
  {
    id: 'seguridad',
    title: '8. Seguridad',
    body: [
      { p: 'Aplicamos medidas técnicas y organizativas para proteger tus datos: conexiones cifradas, acceso restringido a quienes lo necesitan para su trabajo, autenticación segura y proveedores con certificaciones de seguridad reconocidas. Los datos de tarjeta los procesa directamente la pasarela de pagos.' },
      { p: 'Si ocurriera una vulneración de seguridad que afecte tus datos, la notificaremos a la Autoridad de Protección de Datos en los plazos de la LOPDP y te informaremos sin demora cuando exista riesgo para tus derechos.' },
    ],
  },
  {
    id: 'menores',
    title: '9. Menores de edad',
    body: [
      { p: 'La Plataforma está dirigida a personas mayores de 18 años, porque contratar u ofrecer servicios requiere capacidad legal. No recogemos a sabiendas datos de menores. Si un servicio involucra a un menor (por ejemplo, clases particulares), quien lo contrata es su padre, madre o representante legal.' },
    ],
  },
  {
    id: 'cookies',
    title: '10. Cookies',
    body: [
      { p: 'Usamos cookies necesarias para que el sitio funcione, y cookies de analítica y publicidad solo si las aceptas. La primera vez que entras te mostramos un aviso para elegir, y puedes cambiar tu elección cuando quieras desde el enlace "Configurar cookies" al pie de cada página. El detalle está en la Política de Cookies.' },
      { p: 'Si tu navegador envía la señal Global Privacy Control, la respetamos como un rechazo a las cookies de publicidad y analítica.' },
    ],
  },
  {
    id: 'internacional',
    title: '11. Si resides fuera del Ecuador',
    body: [
      { p: 'HULUL opera en el Ecuador. Si usas la Plataforma desde otro país, además de lo anterior:' },
      { ul: [
        'Unión Europea y Espacio Económico Europeo: en la medida en que te resulte aplicable el Reglamento General de Protección de Datos (RGPD), tienes los derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición, y puedes reclamar ante la autoridad de protección de datos de tu país.',
        'Estados Unidos: según la ley de tu estado (por ejemplo, California, Colorado, Virginia y otros con leyes de privacidad), puedes pedir saber qué datos tenemos, corregirlos, eliminarlos y obtener una copia. HULUL no vende ni comparte tus datos para publicidad dirigida entre sitios a cambio de dinero, y no te trataremos de forma distinta por ejercer estos derechos. La Plataforma no está dirigida a menores de 13 años.',
      ] },
      { p: `Para cualquiera de estos derechos escribe a ${company.emailPrivacidad}.` },
    ],
  },
  {
    id: 'cambios',
    title: '12. Cambios a esta política',
    body: [
      { p: 'Si modificamos esta política de forma importante, te lo avisaremos en la Plataforma y, cuando el cambio requiera tu consentimiento, te lo pediremos de nuevo antes de aplicarlo.' },
      { p: `Última actualización: ${PRIVACY_UPDATED}.` },
    ],
  },
];

/** Categorías de cookies que el usuario puede aceptar o rechazar. */
export const cookieCategories = [
  {
    id: 'necesarias' as const,
    name: 'Necesarias',
    required: true,
    description: 'Permiten que el sitio funcione: recordar tu elección de cookies, mantener tu sesión iniciada y proteger los formularios. No se pueden desactivar.',
  },
  {
    id: 'analitica' as const,
    name: 'Analítica',
    required: false,
    description: 'Nos dicen qué páginas se visitan y cómo se usa el sitio, de forma agregada, para mejorarlo (por ejemplo, Google Analytics).',
  },
  {
    id: 'publicidad' as const,
    name: 'Publicidad',
    required: false,
    description: 'Permiten medir nuestras campañas y mostrarte anuncios de HULUL en otras plataformas (por ejemplo, Meta o Google Ads).',
  },
];

export type CookieCategoryId = (typeof cookieCategories)[number]['id'];

export const cookiePolicy: LegalSection[] = [
  {
    id: 'que-son',
    title: '1. Qué son las cookies',
    body: [
      { p: 'Las cookies son pequeños archivos que un sitio web guarda en tu navegador para recordar información entre visitas. También usamos tecnologías similares, como el almacenamiento local del navegador.' },
    ],
  },
  {
    id: 'tipos',
    title: '2. Qué cookies usamos',
    body: [
      { ul: cookieCategories.map((c) => `${c.name}${c.required ? ' (siempre activas)' : ' (solo con tu permiso)'}: ${c.description}`) },
      { p: 'Hoy, en la versión de prueba, el sitio solo usa cookies necesarias. Las de analítica y publicidad se activarán únicamente para quienes las acepten.' },
    ],
  },
  {
    id: 'elegir',
    title: '3. Cómo elegir o cambiar tu decisión',
    body: [
      { p: 'La primera vez que entras te mostramos un aviso para aceptar todas, rechazar las opcionales o elegir por categoría. Tu decisión se guarda durante 12 meses; después, o si cambiamos esta política, te lo preguntaremos de nuevo.' },
      { p: 'Puedes cambiarla cuando quieras desde "Configurar cookies" al pie de cada página, o borrando las cookies desde la configuración de tu navegador.' },
      { p: 'Si tu navegador envía la señal Global Privacy Control, la tratamos como un rechazo a las cookies de analítica y publicidad.' },
    ],
  },
  {
    id: 'contacto',
    title: '4. Contacto',
    body: [
      { p: `Si tienes preguntas sobre las cookies o tus datos, escríbenos a ${company.emailPrivacidad}. Más información en nuestra Política de Privacidad.` },
      { p: `Última actualización: ${PRIVACY_UPDATED}.` },
    ],
  },
];
