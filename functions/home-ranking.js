/** Pure normalization: published labels come only from the versioned catalog. */
export function normalizeRankingBooking(id, booking, provider, catalog) {
  const known = catalog.filter(item => item.categoryId === booking.category)
    .sort((a, b) => b.label.length - a.label.length);
  const notes = typeof booking.notes === 'string' ? booking.notes : '';
  // Current booking forms prepend the exact chosen catalog label followed by '. '.
  // Never classify arbitrary free text, "Otro", or publish the notes themselves.
  const job = known.find(item => notes === item.label || notes.startsWith(`${item.label}. `));
  const confirmed = booking.acceptedAt?.toMillis?.();
  return {
    bookingId: id,
    clientId: typeof booking.clientId === 'string' ? booking.clientId : '',
    serviceId: job?.id ?? '',
    firstConfirmedAtMs: Number.isFinite(confirmed) ? confirmed : NaN,
    eligible: !!provider && ['confirmada', 'en_camino', 'en_curso', 'por_aprobar', 'completada'].includes(booking.status),
    cancelled: booking.status === 'cancelada',
    isTest: booking.demo === true || provider?.tester === true || notes.startsWith('[PRUEBA]'),
  };
}
