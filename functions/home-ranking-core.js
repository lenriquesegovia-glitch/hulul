// Generated from packages/shared/src/home.ts; do not edit directly.
export const homeCopy = {
    headline: '¿Qué necesitas resolver hoy?',
    description: 'Encuentra profesionales verificados a domicilio: limpieza, reparaciones, belleza, cuidado y más.',
    process: 'Busca tu servicio, elige cuándo y paga en la app.',
    coverage: 'Guayaquil · Samborondón · Daule',
    tagline: 'Soluciones para tu día',
};
export function discoveryTitle(mode) {
    return mode === 'popular' ? 'Las más solicitadas' : 'Servicios destacados';
}
/** Full snapshot recomputation; safe to retry. No reservation writes or triggers. */
export function buildRanking(events, catalog, featuredIds, nowMs, policy = { minimumTotal: 20, minimumClientsPerService: 3 }) {
    if (!Number.isFinite(nowMs))
        throw new Error('Invalid ranking clock');
    const windowStartMs = nowMs - 7 * 24 * 60 * 60 * 1000;
    const byId = new Map(catalog.map(item => [item.id, item]));
    const seenBookings = new Set();
    const counted = new Set();
    const counts = new Map();
    // Newest first makes duplicate handling deterministic for valid normalized snapshots.
    for (const e of [...events].sort((a, b) => b.firstConfirmedAtMs - a.firstConfirmedAtMs)) {
        if (!e.bookingId || seenBookings.has(e.bookingId))
            continue;
        seenBookings.add(e.bookingId);
        if (!e.eligible || e.isTest || e.cancelled || !e.clientId || !byId.has(e.serviceId))
            continue;
        if (!Number.isFinite(e.firstConfirmedAtMs) || e.firstConfirmedAtMs < windowStartMs || e.firstConfirmedAtMs > nowMs)
            continue;
        // At most one vote per client and job within the window; avoids repeat-booking inflation.
        const key = JSON.stringify([e.clientId, e.serviceId]);
        if (counted.has(key))
            continue;
        counted.add(key);
        counts.set(e.serviceId, (counts.get(e.serviceId) ?? 0) + 1);
    }
    const ranked = [...counts.entries()]
        .filter(([, count]) => count >= policy.minimumClientsPerService)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 10).map(([id]) => byId.get(id));
    const popular = counted.size >= policy.minimumTotal && ranked.length > 0;
    const fallback = [...new Set(featuredIds)].map(id => byId.get(id)).filter((s) => !!s).slice(0, 10);
    return {
        mode: popular ? 'popular' : 'featured',
        items: popular ? ranked : fallback,
        generatedAtMs: nowMs,
        windowStartMs,
        expiresAtMs: nowMs + 36 * 60 * 60 * 1000,
    };
}
