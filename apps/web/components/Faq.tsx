const faqs = [
  {
    q: '¿Necesito pedir un presupuesto?',
    a: 'No. Cada profesional publica su precio por hora y su reserva mínima. Eliges cuántas horas necesitas y ves el total, con IVA, antes de pagar.',
  },
  {
    q: '¿Cómo se protege mi pago?',
    a: 'Pagas en la app al reservar, pero HULUL retiene el dinero. Solo se libera al profesional cuando confirmas que el trabajo quedó bien.',
  },
  {
    q: '¿Los profesionales están verificados?',
    a: 'Antes de aparecer en HULUL revisamos su cédula, sus referencias y su experiencia. Además puedes leer las reseñas de otros clientes.',
  },
  {
    q: '¿Qué pasa si el profesional no llega o no termina?',
    a: 'Si el servicio no se realiza por causa del profesional, te devolvemos el valor de las horas no realizadas.',
  },
  {
    q: '¿Los materiales están incluidos?',
    a: 'El precio por hora es la mano de obra. Si hacen falta repuestos o materiales, el profesional te los cotiza en la app y tú decides.',
  },
  {
    q: '¿Emiten factura?',
    a: 'Sí, recibes tu factura electrónica autorizada por el SRI en tu correo después de cada servicio.',
  },
];

export function Faq() {
  return (
    <div>
      {faqs.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};
