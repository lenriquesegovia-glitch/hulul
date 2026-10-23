import { categories } from './categories';
import type { HomeDiscovery, HomeService } from './home';

export const homeServices: HomeService[] = categories.flatMap(category => category.servicios.map(label => ({
  id: `${category.slug}:${label}`, categoryId: category.slug, label,
})));
export const featuredHomeServices: HomeDiscovery = {
  mode: 'featured',
  items: ['limpieza', 'climatizacion', 'plomeria'].flatMap(slug => {
    const item = homeServices.find(service => service.categoryId === slug);
    return item ? [item] : [];
  }),
};

/** Never trust labels or routes received from the network. Resolve against current catalog. */
export function validateHomeDiscovery(value: unknown, nowMs = Date.now()): HomeDiscovery {
  if (!value || typeof value !== 'object') return featuredHomeServices;
  const data = value as { mode?: unknown; expiresAtMs?: unknown; generatedAtMs?: unknown; items?: unknown };
  if (data.mode !== 'popular' || typeof data.expiresAtMs !== 'number' || !Number.isFinite(data.expiresAtMs)
    || data.expiresAtMs <= nowMs || typeof data.generatedAtMs !== 'number' || !Number.isFinite(data.generatedAtMs)
    || data.generatedAtMs > nowMs + 300000 || nowMs - data.generatedAtMs > 36 * 3600000 || !Array.isArray(data.items)) return featuredHomeServices;
  const ids = [...new Set(data.items.map(item => item && typeof item === 'object' ? (item as {id?:unknown}).id : null))];
  const items = ids.map(id => homeServices.find(service => service.id === id)).filter((s): s is HomeService => !!s).slice(0, 10);
  return items.length ? { mode: 'popular', items } : featuredHomeServices;
}
