import { AFTER_VISIT_NOTE, POLICY as P, pct, usd } from '@hulul/shared';

/**
 * Preguntas frecuentes. El inicio muestra las de clientes más comunes; la
 * página /preguntas-frecuentes las muestra todas, por tema.
 */

interface Q { q: string; a: string }

export const faqGroups: { title: string; items: Q[] }[] = [
  {
    title: 'Precio y pago',
    items: [
      {
        q: '¿Cómo se cobra?',
        a: `Por visita, como un taxi. Cada profesional publica su tarifa por visita, que cubre el traslado, el diagnóstico y el arreglo si se resuelve en esa visita. Al total se suma el cargo de plataforma de ${usd(P.platformFee)} y el IVA, y lo ves antes de confirmar.`,
      },
      {
        q: '¿Qué pasa si el profesional no logra resolver el problema?',
        a: `La visita se paga igual, porque cubre el traslado y el diagnóstico. Al terminar, el profesional marca si quedó resuelto, si necesita más trabajo o si no se pudo resolver, y te deja un diagnóstico escrito con fotos en la app. ${AFTER_VISIT_NOTE}`,
      },
      {
        q: '¿Los materiales y repuestos están incluidos?',
        a: `No. Si hacen falta, el profesional te envía en la app un cobro adicional con el monto y el detalle. Tú lo aceptas o lo rechazas, y lo pagas por la app con tarjeta o en efectivo. Lleva IVA y HULUL retiene la misma comisión del ${pct(P.commission)}.`,
      },
      {
        q: '¿Cómo se protege mi pago?',
        a: `Con tarjeta, el monto de la visita queda retenido al reservar y se cobra cuando termina la visita (o ${P.autoApproveHours} horas después si no respondes). Si el profesional no llega o cancela, no pagas la visita.`,
      },
      {
        q: '¿Puedo pagar en efectivo?',
        a: 'Sí, si el profesional acepta efectivo. Pagas el total de la visita al terminar.',
      },
      {
        q: '¿Emiten factura?',
        a: 'Sí. Recibes en tu correo la factura electrónica del SRI por el servicio y por el cargo de plataforma.',
      },
    ],
  },
  {
    title: 'Profesionales y seguridad',
    items: [
      {
        q: '¿Los profesionales están verificados?',
        a: 'Sí. Antes de aparecer en HULUL cada profesional pasa por una revisión: validamos su cédula y la comparamos con una foto de su rostro, revisamos su certificado de antecedentes penales vigente del Ministerio del Interior, y en cada oficio pedimos un certificado o fotos de trabajos anteriores con una referencia (en Salud, el título registrado en la SENESCYT). Luego cada servicio se califica, y quien baja de 4,5 estrellas o acumula reportes es suspendido.',
      },
      {
        q: '¿HULUL responde si se pierde o daña algo en mi casa?',
        a: 'No. HULUL verifica la identidad y los antecedentes de los profesionales, pero no se responsabiliza por robos, pérdidas ni daños de objetos durante el servicio. Por eso te pedimos que haya en casa una persona adulta de tu confianza mientras dure el trabajo, y que guardes dinero, joyas, documentos y objetos de valor.',
      },
      {
        q: '¿Puedo ver por dónde viene el profesional?',
        a: 'Sí. En la app ves cada paso, como el seguimiento de un paquete: confirmado, en camino (con el mapa y el tiempo de llegada), llegó, en curso y terminado. Al llegar, le das un código de 4 dígitos para empezar.',
      },
      {
        q: '¿Atienden emergencias médicas?',
        a: 'No. HULUL es para servicios con cita. Si alguien está en peligro, llama al 911.',
      },
    ],
  },
  {
    title: 'Cancelaciones, retrasos y reclamos',
    items: [
      {
        q: '¿En qué horarios puedo reservar?',
        a: 'De 08:00 en adelante, y el trabajo debe terminar a más tardar a las 18:00. Paseos y cuidado de mascotas, hasta las 20:00. Cerrajería y salud, desde las 07:00 y hasta las 20:00, reservando con solo 30 minutos de anticipación (el resto, con 2 horas). Los trabajos de obra o con ruido —aire acondicionado, plomería, electricidad, albañilería, pintura y similares— no se agendan domingos ni feriados. Si tu reserva termina después de las 17:00, cae en domingo o en feriado, te avisamos antes de confirmar: cada urbanización tiene sus reglas de ingreso y HULUL no responde si no dejan entrar al profesional.',
      },
      {
        q: '¿Puedo cancelar?',
        a: `Sí, sin costo hasta ${P.freeCancelHoursBefore} horas antes de la cita, o hasta ${P.freeCancelMinutes} minutos después de que el profesional acepte si pediste para lo antes posible. Después, si el profesional ya confirmó o va en camino, hay un cargo de ${usd(P.lateCancelFee)}; te lo mostramos antes de que confirmes. Si llega y no estás, tras ${P.clientNoShowWaitMinutes} minutos de espera se cobra la visita del profesional.`,
      },
      {
        q: '¿Qué pasa si el profesional llega tarde o no llega?',
        a: `Hay ${P.lateToleranceMinutes} minutos de tolerancia. Si llega entre ${P.lateToleranceMinutes} y ${P.veryLateMinutes} minutos tarde, tienes ${pct(P.lateDiscount)} de descuento automático. Si llega más tarde o no llega, cancelas sin costo, recibes ${usd(P.lateCredit)} de crédito y te buscamos otro profesional.`,
      },
      {
        q: '¿Y si el trabajo queda mal?',
        a: `Califica al profesional y cuéntalo en la app hasta ${P.claimWindowHours} horas después de terminado, con fotos. Las calificaciones son públicas y quien acumula malas calificaciones o reportes es suspendido. La calidad del trabajo es responsabilidad del profesional y se arregla directamente con él.`,
      },
    ],
  },
  {
    title: 'Para profesionales',
    items: [
      {
        q: '¿Cuánto cuesta trabajar con HULUL?',
        a: `Registrarte es gratis. Tú pones tu tarifa por visita y HULUL retiene una comisión del ${pct(P.commission)} de esa tarifa. Lo que acuerdes con el cliente después de la visita es entre ustedes.`,
      },
      {
        q: '¿Puedo ofrecer varios oficios?',
        a: 'Sí, todos los que sepas hacer, sin límite. Cada categoría se aprueba por separado: subes un certificado o título, o fotos de trabajos que hiciste y el contacto de alguien que te recomiende. Puedes sumar categorías en cualquier momento desde tu perfil.',
      },
      {
        q: '¿Cómo y cuándo me pagan?',
        a: 'Los servicios pagados con tarjeta se transfieren cada semana a tu cuenta bancaria, menos la comisión y cualquier multa o saldo pendiente.',
      },
      {
        q: '¿Puedo aceptar efectivo?',
        a: `Sí, si lo activas. La comisión y el cargo de plataforma de esos servicios quedan como saldo a tu cargo y se descuentan de tus próximos pagos. Si el saldo pasa de ${usd(P.cashDebtLimit)}, el efectivo se desactiva hasta que lo pagues.`,
      },
      {
        q: '¿Qué documentos necesito?',
        a: 'Cédula, una foto de tu rostro, el certificado de antecedentes penales (se descarga gratis en la web del Ministerio del Interior) y tu RUC, que es obligatorio para facturar tus servicios (se saca gratis en SRI en línea). Por cada oficio, un certificado o fotos de tus trabajos. En Salud, tu título registrado en la SENESCYT.',
      },
    ],
  },
];

/** Las de clientes que van en el inicio y en las páginas de servicio. */
const homeFaqs: Q[] = [
  faqGroups[0].items[0], faqGroups[0].items[1], faqGroups[0].items[2],
  faqGroups[1].items[0], faqGroups[2].items[1], faqGroups[2].items[2],
];

export function Faq({ all = false }: { all?: boolean }) {
  if (!all) {
    return (
      <div>
        {homeFaqs.map((f) => (
          <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
        ))}
      </div>
    );
  }
  return (
    <div className="stack gap-32">
      {faqGroups.map((g) => (
        <div key={g.title} className="stack gap-8">
          <h2 style={{ fontSize: 22 }}>{g.title}</h2>
          <div>
            {g.items.map((f) => (
              <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqGroups.flatMap((g) => g.items).map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};
