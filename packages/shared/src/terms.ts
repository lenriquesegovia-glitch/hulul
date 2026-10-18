import { company, type LegalSection } from './legal';
import { POLICY as P, pct, usd } from './policy';
import { categories } from './categories';
import { CATEGORY_FLOORS } from './provider';

/**
 * Términos y condiciones de HULUL.
 * BORRADOR: debe revisarlo un abogado antes del lanzamiento, en especial a la
 * luz de la Ley Orgánica de Defensa del Consumidor y de la LOPDP.
 * Los montos y plazos salen de `policy.ts` y `provider.ts`.
 */

export const TERMS_VERSION = '2026-10-17';
export const TERMS_UPDATED = '17 de octubre de 2026';

const visitList = categories
  .map((c) => {
    const f = CATEGORY_FLOORS[c.slug];
    return `${c.name}: ${f.visit > 0 ? `visita ${usd(f.visit)}, ` : 'sin visita, '}mínimo ${f.hours} h, tarifa desde ${usd(f.rate)}/h`;
  });

export const termsOfService: LegalSection[] = [
  {
    id: 'quienes',
    title: '1. Quiénes somos y qué hace HULUL',
    body: [
      { p: `HULUL es una plataforma digital operada por ${company.razonSocial}, RUC ${company.ruc}, con domicilio en ${company.direccion}. HULUL conecta a personas que necesitan servicios en su hogar u oficina ("clientes") con profesionales independientes que los prestan ("profesionales").` },
      { p: 'HULUL no presta directamente los servicios: actúa como intermediario. Verifica a los profesionales, gestiona la reserva y el pago, y media si hay un problema. Cada profesional es responsable del trabajo que realiza.' },
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
    title: '3. Precio del servicio',
    body: [
      { p: 'Antes de confirmar ves el total. El precio se compone de:' },
      { ul: [
        'Visita técnica: un valor fijo por categoría, igual para todos los profesionales de esa categoría. Cubre el traslado y el diagnóstico.',
        'Mano de obra: la tarifa por hora que publica el profesional, por las horas reservadas, con un mínimo de horas por categoría. Si el trabajo toma más tiempo, las horas adicionales se agregan en la app y el cliente las aprueba.',
        `Cargo de plataforma: ${usd(P.platformFee)} por reserva.`,
        'IVA vigente sobre todo lo anterior.',
      ] },
      { p: 'Materiales y repuestos no están incluidos. El profesional los cotiza en la app; el cliente los aprueba o los compra por su cuenta.' },
      { p: 'Cualquier trabajo adicional debe agregarse y pagarse en la app. Los trabajos acordados o pagados fuera de HULUL no tienen garantía, protección de pago ni posibilidad de reclamo.' },
      { p: 'Valores por categoría vigentes:' },
      { ul: visitList },
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
        `Si el profesional llega y el cliente no está o no permite el ingreso, después de ${P.clientNoShowWaitMinutes} minutos de espera se cobra la visita técnica de la categoría (o 1 hora de la tarifa si la categoría no tiene visita).`,
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
    title: '7. Problemas con el trabajo, garantía y reembolsos',
    body: [
      { ul: [
        `El cliente puede reportar un problema en la app hasta ${P.claimWindowHours} horas después de terminado el servicio, con fotos y descripción. Mientras se revisa, el pago con tarjeta queda retenido.`,
        'HULUL revisa el reporte, las fotos, el historial y la versión del profesional, y decide: repetir el trabajo sin costo o devolver total o parcialmente lo pagado.',
        `Garantía de mano de obra: ${P.warrantyDays} días para trabajos hechos y pagados en HULUL.`,
        'Las devoluciones que correspondan se descuentan al profesional. Si ya recibió el pago, el valor queda como saldo a su cargo y se descuenta de sus próximos pagos.',
        'Si el servicio no se realiza por causa del profesional, el cliente no paga las horas no realizadas.',
      ] },
      { p: 'Esto no limita los derechos que la Ley Orgánica de Defensa del Consumidor reconoce al cliente.' },
    ],
  },
  {
    id: 'profesionales',
    title: '8. Profesionales',
    body: [
      { ul: [
        'El profesional es un prestador independiente; no es empleado de HULUL. Decide su tarifa por hora (no menor al mínimo de su categoría), sus zonas, su horario y si acepta efectivo.',
        `HULUL retiene una comisión del ${pct(P.commission)} del servicio (visita técnica y mano de obra). La visita técnica es para el profesional.`,
        'Los pagos con tarjeta se transfieren cada semana a la cuenta registrada, menos comisión, multas y saldos pendientes.',
        `Servicios en efectivo: el cargo de plataforma y la comisión quedan como saldo a cargo del profesional y se descuentan de sus próximos pagos. Si ese saldo supera ${usd(P.cashDebtLimit)}, el efectivo se desactiva hasta que se pague.`,
        'Debe marcar en la app el inicio (con el código del cliente) y el fin de cada trabajo, y registrar en la app cualquier trabajo adicional o material.',
        'Está prohibido ofrecer al cliente trabajos o pagos por fuera de HULUL, compartir datos de contacto para ese fin o pedir pagos adicionales no registrados. Hacerlo es causa de suspensión o cierre de la cuenta.',
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
        'HULUL no atiende emergencias. Ante una emergencia, llama al 911.',
        'Las calificaciones y reseñas deben ser honestas y referirse al servicio recibido.',
      ] },
    ],
  },
  {
    id: 'responsabilidad',
    title: '10. Responsabilidad de HULUL',
    body: [
      { p: 'HULUL responde por la verificación de los profesionales con la información y documentos que estos entregan, por el manejo del pago y por la mediación en los reclamos según estos Términos. El profesional responde por la calidad y seguridad del trabajo que realiza. Nada en estos Términos excluye responsabilidades que la ley no permita excluir.' },
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
