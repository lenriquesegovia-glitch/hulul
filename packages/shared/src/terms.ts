import { company, type LegalSection } from './legal';
import { POLICY as P, HOME_SAFETY_NOTICE, pct, usd } from './policy';
import { categories } from './categories';
import { CATEGORY_PRICING } from './provider';

/**
 * Términos y condiciones de HULUL.
 * BORRADOR: debe revisarlo un abogado antes del lanzamiento, en especial a la
 * luz de la Ley Orgánica de Defensa del Consumidor y de la LOPDP.
 * Los montos y plazos salen de `policy.ts` y `provider.ts`.
 */

export const TERMS_VERSION = '2026-10-18';
export const TERMS_UPDATED = '18 de octubre de 2026';

const suggestedList = categories.map((c) => `${c.name}: ${usd(CATEGORY_PRICING[c.slug].suggested)}`);

export const termsOfService: LegalSection[] = [
  {
    id: 'quienes',
    title: '1. Quiénes somos y qué hace HULUL',
    body: [
      { p: `HULUL es una plataforma digital operada por ${company.razonSocial}, RUC ${company.ruc}, con domicilio en ${company.direccion}. HULUL conecta a personas que necesitan servicios en su hogar u oficina ("clientes") con profesionales independientes que los prestan ("profesionales").` },
      { p: 'HULUL no presta directamente los servicios: actúa como intermediario. Verifica a los profesionales, gestiona la reserva y el pago de la visita, y aplica las reglas de cancelaciones y retrasos. Cada profesional es responsable del trabajo que realiza.' },
      { p: 'Al crear una cuenta o hacer una reserva aceptas estos Términos y la Política de privacidad. Si no estás de acuerdo, no uses la plataforma.' },
    ],
  },
  {
    id: 'cuentas',
    title: '2. Cuentas',
    body: [
      { ul: [
        'Para reservar necesitas una cuenta con un celular verificado. Para ofrecer servicios necesitas una cuenta de profesional aprobada por HULUL.',
        'Debes ser mayor de edad y dar datos verdaderos. Eres responsable de lo que se haga con tu cuenta.',
        'HULUL puede suspender o cerrar una cuenta por datos falsos, fraude, maltrato, incumplimientos repetidos o uso de la plataforma para fines distintos a los previstos.',
      ] },
    ],
  },
  {
    id: 'precio',
    title: '3. Precio: se paga por visita',
    body: [
      { p: 'HULUL cobra por cita, como un taxi. Antes de confirmar ves el total, que se compone de:' },
      { ul: [
        'Tarifa por visita: la fija cada profesional en cada categoría y se publica en su perfil. Cubre el traslado, el diagnóstico y el trabajo que se pueda resolver en esa visita.',
        `Cargo de plataforma: ${usd(P.platformFee)} por reserva.`,
        'IVA vigente sobre lo anterior.',
      ] },
      { p: 'Al reservar, el cliente describe el problema para que el profesional acepte sabiendo qué va a hacer. La visita se paga siempre, se resuelva o no el problema, porque cubre el traslado y el diagnóstico.' },
      { p: 'Al terminar, el profesional registra en la app el resultado (resuelto, necesita más trabajo o no se pudo resolver) y un diagnóstico escrito con fotos, que queda como respaldo para ambos.' },
      { p: 'Repuestos, materiales, más horas de trabajo u otras visitas no están incluidos en la tarifa. Si hacen falta, el cliente y el profesional los acuerdan directamente. HULUL no interviene, no cobra ni garantiza esos acuerdos.' },
      { p: 'Tarifas sugeridas por HULUL como referencia para los profesionales (cada uno fija la suya):' },
      { ul: suggestedList },
    ],
  },
  {
    id: 'pago',
    title: '4. Pago',
    body: [
      { ul: [
        `Con tarjeta: al confirmar se reserva (preautoriza) el total en la tarjeta del cliente a través de ${company.pasarelaPago}. El cobro se hace cuando el cliente aprueba el trabajo, o automáticamente ${P.autoApproveHours} horas después de terminado si no aprueba ni reporta un problema. HULUL no guarda los datos completos de la tarjeta.`,
        'En efectivo: si el profesional lo acepta, el cliente paga el total en efectivo al terminar. El cargo de plataforma y la comisión quedan como saldo a cargo del profesional.',
        'Si un cliente tiene un saldo pendiente con HULUL (por ejemplo, un cargo de cancelación de una reserva en efectivo), ese saldo se suma a su próxima reserva y, mientras exista, solo puede pagar con tarjeta.',
      ] },
    ],
  },
  {
    id: 'cancelacion-cliente',
    title: '5. Cancelaciones del cliente',
    body: [
      { ul: [
        'Sin costo: antes de que un profesional acepte la reserva.',
        `Sin costo: hasta ${P.freeCancelMinutes} minutos después de que el profesional aceptó, en reservas para lo antes posible.`,
        `Sin costo: hasta ${P.freeCancelHoursBefore} horas antes de la hora reservada, en reservas programadas.`,
        `Con menos de ${P.freeCancelHoursBefore} horas de anticipación y la reserva ya confirmada por el profesional, o con el profesional en camino: cargo de ${usd(P.lateCancelFee)}. La app o la web muestran el cargo antes de confirmar la cancelación.`,
        'Con tarjeta, el cargo se descuenta del monto retenido. Con efectivo o transferencia, queda como saldo pendiente y se suma a la próxima reserva.',
        `Si el profesional llega y el cliente no está o no permite el ingreso, después de ${P.clientNoShowWaitMinutes} minutos de espera se cobra la tarifa por visita del profesional.`,
        `De los cargos de esta sección, el ${pct(P.proShareOfClientFees)} es para el profesional que se trasladó.`,
      ] },
    ],
  },
  {
    id: 'retrasos',
    title: '6. Retrasos y cancelaciones del profesional',
    body: [
      { ul: [
        `Tolerancia de llegada: ${P.lateToleranceMinutes} minutos.`,
        `Entre ${P.lateToleranceMinutes} y ${P.veryLateMinutes} minutos tarde: el cliente recibe automáticamente un ${pct(P.lateDiscount)} de descuento, que se descuenta al profesional.`,
        `Más de ${P.veryLateMinutes} minutos tarde, o si el profesional cancela con menos de ${P.freeCancelHoursBefore} horas: el cliente puede cancelar sin costo y recibe ${usd(P.lateCredit)} de crédito; HULUL busca otro profesional. El profesional paga una multa de ${usd(P.proLateFine)}.`,
        `Si el profesional no llega y no avisa: multa de ${usd(P.proNoShowFine)} y revisión de su cuenta.`,
        `${P.strikesToSuspend} faltas o cancelaciones tardías en ${P.strikesWindowDays} días: suspensión temporal.`,
        'La hora de llegada se mide con la ubicación de la app del profesional y con el código de inicio que el cliente le entrega al llegar.',
      ] },
    ],
  },
  {
    id: 'reclamos',
    title: '7. Calificaciones y problemas con el trabajo',
    body: [
      { ul: [
        `Después de cada servicio el cliente califica al profesional. Tiene ${P.claimWindowHours} horas para hacerlo o para reportar un problema, con fotos y descripción.`,
        'La calidad del trabajo y lo acordado después de la visita son responsabilidad del profesional y se resuelven entre el cliente y el profesional. HULUL no garantiza el resultado del trabajo.',
        'Las calificaciones son públicas. Una calificación baja sostenida o reportes repetidos llevan a un aviso y luego a la suspensión del profesional.',
        'Si el servicio no se realiza por causa del profesional (no llega o cancela), el cliente no paga la visita y aplican las reglas de la sección 6.',
      ] },
      { p: 'Esto no limita los derechos que la Ley Orgánica de Defensa del Consumidor reconoce al cliente.' },
    ],
  },
  {
    id: 'profesionales',
    title: '8. Profesionales',
    body: [
      { ul: [
        'El profesional es un prestador independiente; no es empleado de HULUL. Decide su tarifa por visita en cada categoría, sus zonas, su horario y si acepta efectivo.',
        'Puede ofrecer servicios en las categorías que quiera, sin límite. Cada categoría se aprueba por separado: debe demostrar que sabe hacer ese trabajo con un certificado o título, o con fotos de trabajos anteriores y una referencia. Puede sumar categorías en cualquier momento.',
        `HULUL retiene una comisión del ${pct(P.commission)} de la tarifa por visita.`,
        'Los pagos con tarjeta se transfieren cada semana a la cuenta registrada, menos comisión, multas y saldos pendientes.',
        `Servicios en efectivo: el cargo de plataforma y la comisión quedan como saldo a cargo del profesional y se descuentan de sus próximos pagos. Si ese saldo supera ${usd(P.cashDebtLimit)}, el efectivo se desactiva hasta que se pague.`,
        'Debe aceptar solo trabajos que sabe hacer, marcar en la app la llegada y el fin de cada visita, y al terminar registrar el resultado y un diagnóstico escrito con fotos.',
        'No puede cobrar la visita por fuera de HULUL ni ofrecer al cliente saltarse la plataforma en reservas futuras. Hacerlo es causa de suspensión o cierre de la cuenta.',
        'Debe contar con los permisos, títulos y registros que su oficio exija (en Salud, título registrado en la SENESCYT y lo que disponga la ACESS) y emitir los comprobantes que correspondan ante el SRI.',
      ] },
    ],
  },
  {
    id: 'conducta',
    title: '9. Conducta y seguridad',
    body: [
      { ul: [
        'Clientes y profesionales se tratan con respeto. El acoso, la discriminación o la violencia llevan al cierre inmediato de la cuenta y, si corresponde, a la denuncia ante las autoridades.',
        ...HOME_SAFETY_NOTICE,
        'HULUL no atiende emergencias. Ante una emergencia, llama al 911.',
        'Las calificaciones y reseñas deben ser honestas y referirse al servicio recibido.',
      ] },
    ],
  },
  {
    id: 'responsabilidad',
    title: '10. Responsabilidad de HULUL',
    body: [
      { p: 'HULUL responde por la verificación de los profesionales con la información y documentos que estos entregan, y por el manejo del pago de la visita según estos Términos. El profesional responde por la calidad y seguridad del trabajo que realiza, y por los acuerdos que haga con el cliente después de la visita. HULUL no se responsabiliza por robos, pérdidas ni daños de objetos durante el servicio. Nada en estos Términos excluye responsabilidades que la ley no permita excluir.' },
      { p: 'Horarios: los trabajos se agendan para terminar a más tardar a las 18:00 (cerrajería y salud, 20:00). Los trabajos de obra o con ruido no se agendan domingos ni feriados. Cuando el cliente reserva un trabajo que termina después de las 17:00, en domingo o en feriado, la app le avisa antes de confirmar: cada urbanización o edificio fija sus propias reglas de ingreso, y HULUL no responde si no permiten la entrada del profesional. En ese caso, si el profesional se trasladó, aplica el cargo por cancelación tardía.' },
    ],
  },
  {
    id: 'cambios',
    title: '11. Cambios y ley aplicable',
    body: [
      { p: 'HULUL puede actualizar estos Términos. Los cambios importantes se avisan en la app y por correo antes de entrar en vigor; las reservas ya confirmadas se rigen por los Términos vigentes al confirmarlas.' },
      { p: 'Estos Términos se rigen por las leyes de la República del Ecuador. Las controversias se intentarán resolver primero por mediación; de no lograrse, serán competentes los jueces de Guayaquil, sin perjuicio de los derechos del consumidor.' },
      { p: `Contacto: ${company.emailPrivacidad}.` },
    ],
  },
];
