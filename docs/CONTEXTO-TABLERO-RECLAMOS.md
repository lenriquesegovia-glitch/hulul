# Contexto para la sesión: tablero completo de reclamos (HULUL)

> Documento de traspaso. Léelo entero antes de tocar código. Estado al 25-oct-2026, main `3cfd16a`.

## 0. Reglas de trabajo (obligatorias)
- Fuente oficial: GitHub `lenriquesegovia-glitch/hulul`. Antes de empezar: `git fetch`, compara con `origin/main`, lee `ESTADO.md`.
- Nunca `reset --hard` ni `clean`. Trabaja en una rama `claude/…`, abre PR, espera el check **verificar** (TypeScript, pruebas, reglas en emulador, build web) y luego integra.
- **Publicar = GitHub Actions** "Publicar HULUL" (`.github/workflows/publicar.yml`, `workflow_dispatch` en main, inputs `backend` y `android`). Orden automático: backend (Firebase) → web (espera Vercel) → Android OTA. Se dispara por API: `POST /repos/{owner}/{repo}/actions/workflows/publicar.yml/dispatches` con `ref=main`.
- No usar los `.bat` ni la carpeta antigua `C:\Users\lsego\Hulul`.
- Registrar cada entrega en `ESTADO.md` (commit, run, deployment de Vercel, pendientes).
- Hay otra sesión trabajando en paralelo: acaba de integrar `/admin/profesionales` (commit 3cfd16a). Reutiliza su patrón y no pises sus archivos.

## 1. Protocolo de reclamos (decidido por el dueño, no cambiar sin preguntarle)
- Abre el **cliente** o el **profesional**, hasta **48 h** después de la visita (o de la cancelación por cliente/cliente ausente). Uno por reserva. Texto ≥15 caracteres y hasta 6 fotos.
- La otra parte responde **una vez** en **24 h** (texto y fotos). Si no responde, el caso pasa solo a "en revisión".
- HULUL decide en **máximo 72 h** desde la apertura. Correo 12 h antes de vencer y al vencer.
- Si reclama el cliente, la reserva pasa a `en_disputa` y el pago al profesional queda retenido (el libro de movimientos no se toca mientras está en disputa).
- Decisión: a favor del **cliente** (no se cobra la visita; opcional multa al profesional ≤ $200 y crédito al cliente ≤ $500) o del **profesional** (se cobra y se libera el pago). Faltas opcionales a cualquiera (3 faltas en 30 días = 7 días de suspensión del profesional). Motivo ≥20 caracteres, visible para ambos. No se deshace.
- Timbre: antes de "cliente ausente" el profesional timbra 3 veces (cada 3 min) y espera 10 min; cada timbre queda en `bookings.rings`.

## 2. Datos (Firestore, proyecto `hulul-59081`)
| Ruta | Quién escribe | Quién lee | Contenido |
|---|---|---|---|
| `reclamos/{bookingId}` | solo servidor | cliente y profesional de la reserva | code, bookingId, openedBy ('cliente'/'profesional'), openerId, clientId, proId, clientName, proName, category, date, slot, kind, kindLabel, text (moderado), photos[], status ('esperando_respuesta' / 'en_revision' / 'resuelto'), openedAt, responseDueAt, resolveDueAt (ms), response {text, photos, at, late} \| null, responseMissed, decision {outcome, note, multaPro, creditoCliente, faltaPro, faltaCliente, by, at} \| null, alerts {porVencer, vencido}, moneyHeld |
| `reclamos/{id}/privado/textos` | servidor | **solo panel (vía funciones)** | apertura, respuesta: textos originales sin moderar |
| `reclamos/{id}/accesos/{auto}` | servidor | **solo panel** | uid, email, action ('abrir', 'ver_contacto', 'resolver_cliente', 'resolver_profesional'), at |
| `bookings/{id}` | servidor | partes | status, previousStatus, dispute {kind,text,by,status,outcome}, claimId, arrivedAt, arrivedPos {distance, accuracy}, rings[], startedAt, finishedAt, cancelledAt/By, diagnosis, diagnosisPhotos, photos, extra, delay, cancelFee, proFine, clientCredit… |
| `bookings/{id}/messages` | partes (reglas) | partes | from, kind ('texto'/'foto'/'pedir_fotos'), text, photo, at |
| `bookings/{id}/moderacion/{msgId}` | servidor | nadie desde la app | original de mensajes con groserías |
| `ledger`, `payouts`, `providers/{uid}` (strikes, strikeLog, suspendedUntil, rating), `clients/{uid}` (strikes, strikeLog) | servidor | ver reglas | dinero y faltas |
- Fotos: Storage `reclamos/{uid}/{bookingId}/…` (solo el autor sube/lee; las URLs con token quedan en el doc).
- Las reglas están en `firestore.rules` (bloque "Reclamos") y probadas en `tests/reglas/reglas.test.mjs`.

## 3. Backend existente (`functions/`)
- `reclamos-core.js` (lógica pura, probada en `reclamos-core.test.js`): `claimBlocked`, `deadlines`, `dueActions`, `cleanClaimPhotos`, `decisionPatch`, `responseStats` (tiempos de respuesta del chat por parte), `timeline` (línea de tiempo del expediente), `maskContact`, `isAdminToken`, constantes y etiquetas.
- `index.js`, sección "Reclamos" (callables en `southamerica-east1`):
  - `reportarProblema` (cliente), `reportarProblemaPro`, `responderReclamo`.
  - `adminReclamos` → lista (máx. 200, sin contacto).
  - `adminReclamo {id, reveal}` → expediente completo: claim + privado, booking (contacto enmascarado salvo `reveal`), parties (reclamos y faltas previas, rating), messages (con `original` si fue moderado), stats, timeline, accesses. **Cada llamada se registra en accesos.**
  - `resolverReclamo {id, outcome, note, multaPro, creditoCliente, faltaPro, faltaCliente}`.
  - `plazosReclamos` (cada 30 min): sin respuesta → revisión; avisos por vencer / vencido.
- Acceso de administrador: `requireAdmin(req)` = correo **verificado** dentro del parámetro `ADMIN_EMAILS` (variable de GitHub `ADMIN_EMAILS`; por defecto `lenriquesegovia@gmail.com`). Todo acceso del panel pasa por funciones; el panel nunca lee Firestore directo.
- Cliente JS: `packages/shared/src/firebase.ts` → `adminListClaims`, `adminGetClaim`, `adminResolveClaim`, tipos `Claim`, `ClaimListItem`, `ClaimFile`, `CLAIM_STATUS_LABEL`, `CLAIM_RULES`.

## 4. Panel actual (punto de partida)
- `apps/web/app/admin/reclamos/page.tsx` + `ClaimsPanel.tsx` (https://hululec.com/admin/reclamos, `noindex`, `/admin` bloqueado en robots).
- Lista con filtros Abiertos / Por vencer-vencidos / Resueltos / Todos, insignia de urgencia y cuenta regresiva.
- Expediente (`?caso=ID`): las dos versiones con fotos y textos originales, reserva, evidencia (llegada GPS, timbres, código, informe, fotos), tiempos de respuesta del chat, antecedentes, línea de tiempo, chat completo, formulario de decisión con confirmación y registro de accesos.
- Hermano: `apps/web/app/admin/profesionales/ProsPanel.tsx` (otra sesión), con el mismo acceso.

## 5. Qué falta para el "tablero completo" (propuesta; confirmar alcance con el dueño)
1. **Resumen con indicadores (KPI)**: abiertos, por vencer, vencidos, resueltos en el periodo; tiempo medio de respuesta de la otra parte y de decisión de HULUL; % de casos a tiempo (≤72 h); % a favor del cliente o del profesional; montos retenidos, multas y créditos.
2. **Gráficos**: reclamos por semana, por motivo, por categoría de servicio y por quién abre.
3. **Ranking de riesgo**: profesionales y clientes con más reclamos o faltas en 30/90 días (detección de abusos: "que nadie se pase de sabido").
4. **Filtros y búsqueda**: por fecha, motivo, categoría, estado, profesional, cliente o código; ordenar por vencimiento.
5. **Exportar** a CSV/Excel (sin datos de contacto) para contabilidad o revisión.
6. Navegación común `/admin` (Reclamos · Profesionales · futuro: Reservas y Pagos).
- Para los KPI, crear una función nueva `adminResumenReclamos {desde, hasta}` que calcule en el servidor (lógica pura en `reclamos-core.js` con su prueba). No exponer contactos. Registrar el acceso.
- Si hace falta un índice compuesto (por ejemplo `status` + `openedAt`): hoy el publicador despliega solo `firestore:rules,storage,functions`; habría que agregar `firestore:indexes` en `publicar.yml` y el archivo de índices en `firebase.json`. Mejor evitarlo: filtrar en memoria (son pocos casos) o con consultas de un solo campo.

## 6. Privacidad (no negociable)
- Solo administradores verificados; cada vista del expediente y cada vez que se muestra un contacto queda registrada.
- Contacto enmascarado por defecto (`maskContact`). Los KPI y la exportación van sin teléfonos ni correos.
- Los textos originales moderados se ven solo en el expediente.
- La política de privacidad (`packages/shared/src/legal.ts`, versión 2026-10-25) ya describe esta revisión. Si cambia lo que se trata, actualizarla.

## 7. Cómo verificar
- `cd functions && npm test` · `npx tsc --noEmit` en `packages/shared`, `apps/web` y `apps/mobile` · el PR corre las reglas en el emulador.
- Revisión visual: exportar o levantar la web y mirar `/admin/reclamos` a 360 px y en escritorio. Requiere iniciar sesión con Google en una cuenta de ADMIN_EMAILS; para la prueba local, datos de muestra.
- Publicar solo backend + web (`android=false`) si no cambia la app.
