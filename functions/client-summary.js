/** Authorization is per booking, never a public client directory. */
export function canReadClientSummary(uid, booking) {
  return !!uid && !!booking && booking.professionalId === uid;
}
export function clientSummary(booking, aggregate) {
  const count = Math.max(0, Number(aggregate?.count) || 0);
  const sum = Number(aggregate?.sum) || 0;
  return { name: String(booking.contactName || 'Cliente'), count, rating: count ? Math.round(sum / count * 100) / 100 : null };
}
