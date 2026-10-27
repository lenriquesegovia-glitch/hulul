// Pruebas de firestore.rules (emulador). Cubren los huecos cerrados en V5.2.
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-hulul',
  firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
});

const booking = (over = {}) => ({
  source: 'app', clientId: 'cli1', professionalId: 'pro1', professionalName: 'Pedro Pérez', category: 'plomeria',
  date: '2099-01-15', slot: '10:00', hours: 1, pricingVersion: 2, pricing: 'visita', visit: 20, safetyAccepted: true,
  address: 'Av. Principal 123, Urdesa', notes: 'Fuga en el baño', contactName: 'Ana Ruiz', contactPhone: '0991234567',
  contactEmail: 'ana@gmail.com', paymentMethod: 'tarjeta', subtotal: 20, fee: 1, iva: 0.15, total: 21.15,
  consentMarketing: false, demo: false, status: 'pendiente', consentPrivacy: true, privacyVersion: '2026-10',
  createdAt: serverTimestamp(), ...over,
});

let n = 0;
const ok = async (name, p) => { await assertSucceeds(p); n++; console.log('  ✓', name); };
const no = async (name, p) => { await assertFails(p); n++; console.log('  ✓ (rechazada)', name); };

const anon = env.unauthenticatedContext().firestore();
const cli1 = env.authenticatedContext('cli1').firestore();
const cli2 = env.authenticatedContext('cli2').firestore();

console.log('Reservas');
await ok('cliente con cuenta reserva a su nombre (app)', setDoc(doc(cli1, 'bookings/b1'), booking()));
await ok('cliente con cuenta reserva a su nombre (web)', setDoc(doc(cli1, 'bookings/b2'), booking({ source: 'web' })));
await no('reserva de la app SIN cuenta', setDoc(doc(anon, 'bookings/b3'), booking()));
await no('reserva a nombre de otro cliente (clientId ajeno)', setDoc(doc(cli2, 'bookings/b4'), booking()));
await no('correo con lista de destinatarios', setDoc(doc(cli1, 'bookings/b5'), booking({ contactEmail: 'a@x.com, b@y.com' })));
await no('correo con punto y coma', setDoc(doc(cli1, 'bookings/b6'), booking({ contactEmail: 'a@x.com;b@y.com' })));
await ok('correo vacío permitido', setDoc(doc(cli1, 'bookings/b7'), booking({ contactEmail: '' })));
await no('profesional se reserva a sí mismo', setDoc(doc(env.authenticatedContext('pro1').firestore(), 'bookings/b8'), booking({ clientId: 'pro1' })));
await ok('el cliente lee su reserva', getDoc(doc(cli1, 'bookings/b1')));
await no('otro cliente no lee la reserva', getDoc(doc(cli2, 'bookings/b1')));
await no('nadie cambia una reserva desde el cliente', updateDoc(doc(cli1, 'bookings/b1'), { status: 'completada' }));

console.log('Perfil del cliente');
const profile = { uid: 'cli1', name: 'Ana Ruiz', phone: '0991234567', email: 'ana@gmail.com', consentMarketing: false, consentPrivacy: true, privacyVersion: '2026-10', createdAt: serverTimestamp() };
await ok('crea su perfil', setDoc(doc(cli1, 'clients/cli1'), profile));
await no('perfil con correo en lista', setDoc(doc(cli2, 'clients/cli2'), { ...profile, uid: 'cli2', email: 'a@x.com,b@y.com' }));
await no('cambia su correo a una lista', updateDoc(doc(cli1, 'clients/cli1'), { email: 'a@x.com, b@y.com', updatedAt: serverTimestamp() }));
await ok('cambia su nombre', updateDoc(doc(cli1, 'clients/cli1'), { name: 'Ana María Ruiz', updatedAt: serverTimestamp() }));
await no('se pone saldo a favor', updateDoc(doc(cli1, 'clients/cli1'), { credit: 50, updatedAt: serverTimestamp() }));

console.log('Datos privados');
await no('otro usuario no lee la cuenta bancaria de un profesional', getDoc(doc(cli2, 'providers/pro1/private/banco')));
await no('nadie escribe el directorio público', setDoc(doc(cli1, 'pros/pro1'), { name: 'X' }));
await no('nadie lee buzones ajenos', getDoc(doc(cli2, 'inboxes/cli1/items/x')));

console.log('Reclamos');
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'reclamos/b1'), { clientId: 'cli1', proId: 'pro1', status: 'esperando_respuesta', text: 'No terminó el trabajo' });
  await setDoc(doc(db, 'reclamos/b1/privado/textos'), { apertura: 'texto original' });
  await setDoc(doc(db, 'reclamos/b1/accesos/a1'), { email: 'admin@x.com' });
});
await ok('el cliente ve su reclamo', getDoc(doc(cli1, 'reclamos/b1')));
await ok('el profesional ve el reclamo', getDoc(doc(env.authenticatedContext('pro1').firestore(), 'reclamos/b1')));
await no('otro usuario no ve el reclamo', getDoc(doc(cli2, 'reclamos/b1')));
await no('nadie cambia un reclamo desde la app', updateDoc(doc(cli1, 'reclamos/b1'), { status: 'resuelto' }));
await no('nadie crea un reclamo desde la app', setDoc(doc(cli1, 'reclamos/b2'), { clientId: 'cli1', proId: 'pro1' }));
await no('las partes no leen los textos originales', getDoc(doc(cli1, 'reclamos/b1/privado/textos')));
await no('las partes no leen el registro de accesos', getDoc(doc(cli1, 'reclamos/b1/accesos/a1')));

console.log('Roles del panel');
const intruso = env.authenticatedContext('x', { email: 'conta@correo.com', email_verified: true }).firestore();
await no('nadie se da un rol desde la app', setDoc(doc(intruso, 'adminRoles/conta@correo.com'), { role: 'socio' }));
await no('nadie lee los roles desde la app', getDoc(doc(intruso, 'adminRoles/conta@correo.com')));
await no('nadie lee el registro de accesos del panel', getDoc(doc(intruso, 'adminAccesos/a1')));
await no('nadie lee los estados de cuenta preparados', getDoc(doc(intruso, 'estadosCuenta/2026-10-26')));
await no('nadie lee la clave de la IA', getDoc(doc(intruso, 'adminConfig/ia')));
await no('nadie lee el análisis de IA de un reclamo', getDoc(doc(cli1, 'reclamos/b1/privado/ia')));

await env.cleanup();
console.log(`\nReglas: ${n} comprobaciones correctas.`);
