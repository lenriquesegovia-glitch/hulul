import { CATEGORY_FLOORS, POLICY as P, pct, usd } from '@hulul/shared';

/**
 * Preguntas frecuentes. El inicio muestra las de clientes más comunes; la
 * página /preguntas-frecuentes las muestra todas, por tema.
 */

interface Q { q: string; a: string }

const climat = CATEGORY_FLOORS.climatizacion;

export const faqGroups: { title: string; items: Q[] }[] = [
  {
    title: 'Precio y pago',
    items: [
      {
        q: '¿Necesito pedir un presupuesto?',
        a: `No. El precio tiene tres partes que ves antes de confirmar: una visita técnica fija por categoría, igual con cualquier profesional (por ejemplo, ${usd(climat.visit)} en climatización, cubre traslado y diagnóstico); la tarifa por hora del profesional, con un mínimo de horas por categoría; y el cargo de plataforma de ${usd(P.platformFee)}. A todo se suma el IVA.`,
      },
      {
        q: '¿Los materiales están incluidos?',
        a: 'No. La tarifa por hora es la mano de obra. Si hacen falta materiales o repuestos, el profesional te los cotiza en la app y tú decides si los aprueba o si los compras tú. Cualquier trabajo extra también se agrega en la app: así queda cubierto por la garantía.',
      },
      {
        q: '¿Cómo se protege mi pago?',
        a: `Con tarjeta, el monto queda retenido al reservar y se cobra recién cuando apruebas el trabajo (o ${P.autoApproveHours} horas después de terminado si no respondes). Si reportas un problema, el pago sigue retenido hasta resolverlo.`,
      },
      {
        q: '¿Puedo pagar en efectivo?',
        a: 'Sí, si el profesional acepta efectivo. Pagas el total al terminar. Recuerda que solo lo pagado por la app (o registrado en ella) tiene garantía y opción de reclamo.',
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
        a: 'Sí. Antes de aparecer en HULUL cada profesional pasa por una revisión: validamos su cédula y la comparamos con una foto de su rostro, revisamos su certificado de antecedentes penales vigente del Ministerio del Interior, y en Salud exigimos el título registrado en la SENESCYT. Luego cada servicio se califica, y quien baja de 4,5 estrellas o acumula reclamos es suspendido.',
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
        q: '¿Puedo cancelar?',
        a: `Sí, sin costo hasta ${P.freeCancelHoursBefore} horas antes de la cita, o hasta ${P.freeCancelMinutes} minutos después de que el profesional acepte si pediste para lo antes posible. Después, si el profesional ya va en camino, hay un cargo de ${usd(P.lateCancelFee)}. Si llega y no estás, tras ${P.clientNoShowWaitMinutes} minutos de espera se cobra la visita técnica.`,
      },
      {
        q: '¿Qué pasa si el profesional llega tarde o no llega?',
        a: `Hay ${P.lateToleranceMinutes} minutos de tolerancia. Si llega entre ${P.lateToleranceMinutes} y ${P.veryLateMinutes} minutos tarde, tienes ${pct(P.lateDiscount)} de descuento automático. Si llega más tarde o no llega, cancelas sin costo, recibes ${usd(P.lateCredit)} de crédito y te buscamos otro profesional.`,
      },
      {
        q: '¿Y si el trabajo queda mal?',
        a: `Repórtalo en la app hasta ${P.claimWindowHours} horas después de terminado, con fotos. Revisamos y, si corresponde, el profesional vuelve sin costo o te devolvemos el dinero. Los trabajos tienen ${P.warrantyDays} días de garantía de mano de obra.`,
      },
    ],
  },
  {
    title: 'Para profesionales',
    items: [
      {
        q: '¿Cuánto cuesta trabajar con HULUL?',
        a: `Registrarte es gratis. HULUL retiene una comisión del ${pct(P.commission)} de cada servicio. La visita técnica de tu categoría es para ti.`,
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
        a: 'Cédula, una foto de tu rostro, el certificado de antecedentes penales (se descarga gratis en la web del Ministerio del Interior) y tu RUC, que es obligatorio para facturar tus servicios (se saca gratis en SRI en línea). En Salud, además, tu título registrado en la SENESCYT.',
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
