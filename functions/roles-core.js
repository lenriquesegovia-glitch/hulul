/**
 * Roles del panel de administración (hululec.com/admin).
 *
 * - dueno: los correos de ADMIN_EMAILS (Luis). Todo, incluido dar y quitar accesos.
 * - socio: todo menos "Equipo y roles".
 * - contabilidad: Resumen, Contabilidad y Proveedores; exporta y marca liquidaciones pagadas.
 * - cumplimiento: oficial de cumplimiento (UAFE). Solo lectura de reservas, clientes,
 *   proveedores, contabilidad y alertas de cumplimiento. Sin reclamos ni chats.
 *
 * Los roles distintos de dueno viven en adminRoles/{correo} (solo servidor; las reglas
 * lo niegan a la app). Debe coincidir con ROLE_PERMS de packages/shared/src/dashboard.ts.
 * Funciones puras: pruebas en roles-core.test.js.
 */

export const ROLES = ['dueno', 'socio', 'contabilidad', 'cumplimiento'];
export const ASSIGNABLE_ROLES = ['socio', 'contabilidad', 'cumplimiento'];

export const ROLE_PERMS = {
  dueno: ['tablero', 'reservas', 'clientes', 'contabilidad', 'proveedores', 'cumplimiento', 'reclamos', 'profesionales', 'pagos', 'equipo'],
  socio: ['tablero', 'reservas', 'clientes', 'contabilidad', 'proveedores', 'cumplimiento', 'reclamos', 'profesionales', 'pagos'],
  contabilidad: ['tablero', 'contabilidad', 'proveedores', 'pagos'],
  cumplimiento: ['tablero', 'reservas', 'clientes', 'contabilidad', 'proveedores', 'cumplimiento'],
};

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;
export const normEmail = (e) => String(e ?? '').trim().toLowerCase();
export const isEmail = (e) => EMAIL.test(normEmail(e)) && normEmail(e).length <= 120;

const ownersOf = (ownerEmails) => String(ownerEmails ?? '').toLowerCase().split(/[,;\s]+/).filter(Boolean);

/**
 * Rol de quien llama. token = req.auth.token; roleDoc = adminRoles/{correo} (o null).
 * Exige correo verificado. Devuelve null si no tiene acceso.
 */
export function roleFor(token, ownerEmails, roleDoc) {
  const email = normEmail(token?.email);
  if (!email || token?.email_verified !== true) return null;
  if (ownersOf(ownerEmails).includes(email)) return 'dueno';
  if (roleDoc && roleDoc.active !== false && ASSIGNABLE_ROLES.includes(roleDoc.role)) return roleDoc.role;
  return null;
}

export const can = (role, perm) => !!role && (ROLE_PERMS[role] ?? []).includes(perm);

/** Valida lo que manda "Equipo y roles" al guardar un acceso. */
export function roleInput(data, ownerEmails) {
  const email = normEmail(data?.email);
  const role = String(data?.role ?? '');
  const name = String(data?.name ?? '').trim().slice(0, 80);
  if (!isEmail(email)) return { error: 'Escribe un correo válido.' };
  if (ownersOf(ownerEmails).includes(email)) return { error: 'Ese correo ya es dueño del panel.' };
  if (!ASSIGNABLE_ROLES.includes(role)) return { error: 'Elige un rol.' };
  if (name.length < 2) return { error: 'Escribe el nombre de la persona.' };
  return { email, role, name };
}

/**
 * Datos del tablero según el rol: contabilidad y cumplimiento no reciben reclamos;
 * contabilidad tampoco recibe la ficha de clientes.
 */
export function dashForRole(data, role) {
  if (role === 'dueno' || role === 'socio') return data;
  // Sin motivo del reclamo ni fotos de la casa del cliente para quien no los necesita.
  const strip = (b) => ({ ...b, claim: b.claim ? { ...b.claim, kindLabel: '' } : null, photoUrls: { request: [], work: [] } });
  if (role === 'contabilidad') return { ...data, bookings: data.bookings.map(strip), claims: [], clients: [] };
  if (role === 'cumplimiento') return { ...data, bookings: data.bookings.map(strip), claims: [] };
  return { ...data, bookings: [], ledger: [], payouts: [], providers: [], clients: [], claims: [] };
}
