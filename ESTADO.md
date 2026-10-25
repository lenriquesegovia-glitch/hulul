# HULUL — Estado y registro de entregas

## Estado vigente — V5.4 publicada el 25 de octubre de 2026 (Claude)
- PR #8 → main **8af30df**. Publicado con "Publicar HULUL", run 40231949744: verificar ✅ → backend ✅ → web ✅ (Vercel Production 7318877981) → android ✅ (OTA production).
- Nuevo: **timbre al cliente** (función `timbrar`): hasta 3 avisos con sonido, cada 3 min, guardados en `bookings.rings`. "El cliente no está" exige 3 timbres + 10 min de espera. Términos (versión 2026-10-25) y FAQ actualizados.
- Filtro de groserías: palabras de México (chingada, pinche…) y corrección de signos finales ("!!" ocultaba la palabra). Pruebas en `functions/profanity.test.js`.
- Respaldo: main c94f59b (V5.3).
- Pendiente: módulo de reclamos (protocolo en definición con el dueño).

## Anterior — V5.2 + V5.3 publicadas el 25 de octubre de 2026 (Claude)
- Integrado: PR #6 (V5.2 seguridad + publicador) → main ef81c38; PR #7 (V5.3 estado de cuenta y cabecera) → main **d87f931**.
- Publicado con GitHub Actions "Publicar HULUL", run 40230652530 sobre d87f931: verificar ✅ → backend ✅ (reglas Firestore/Storage y funciones en hulul-59081) → web ✅ (Vercel Production 7318680133, https://hulul-lzfwwc5nn-hulul.vercel.app) → android ✅ (OTA canal production, runtime 0.1.0).
- Grupo OTA: ver la salida del paso "eas update" del job android en ese run o el panel de Expo (la sesión de Claude no puede leer los logs).
- Credenciales de Actions: secret EXPO_TOKEN y FIREBASE_SERVICE_ACCOUNT (cuenta github-publicador-262@hulul-59081); variables MAIL_PROVIDER=resend, FROM_EMAIL=reservas@hululec.com, NOTIFY_TO=servicioalcliente@hululec.com.
- Correo entrante del dominio: ImprovMX (MX mx1/mx2.improvmx.com + SPF en DNS de Vercel); *@hululec.com reenvía al Gmail del dueño.
- Respaldo: web anterior acb1123 / Android anterior grupo a070ca0c-8003-4845-bf54-e2ff154bf08c; backend anterior = reglas y funciones de V5 (main acb1123).
- Pendiente: comprobar en teléfono físico (cabecera, estado de cuenta, Stepper); restringir clave de Google Maps; App Check; módulo de reclamos; identidad visual de correos.

## Integrada — V5.2 seguridad (main ef81c38, backend aún NO desplegado) · 24 oct 2026, Claude
- PR #6, rama `claude/seguridad-v5-2`, commit 19a792c. Basada en main acb1123. Cambia **backend** (reglas y funciones); web y app sin cambios de código.
- Corrige: reservas sin cuenta o a nombre de otro (regla de bookings), correos con lista de destinatarios (reglas + `functions/mail-safety.js`), cruces al aceptar un cambio de hora, reservas en horas pasadas, nodemailer/body-parser vulnerables.
- Agrega el bloqueo contra publicaciones antiguas: `scripts/verificar-copia.cjs` en los dos .bat y publicador `.github/workflows/publicar.yml` (solo desde el último main; orden backend → web → Android).
- Verificado en GitHub Actions (run 40158788633): TypeScript, horarios/tarifas, funciones (dinero, ranking, correos), **reglas en emulador** (19 comprobaciones) y build web: success.
- Para publicar: 1) Firebase (reglas+funciones) desde el publicador de Actions (requiere secrets FIREBASE_SERVICE_ACCOUNT y variables MAIL_PROVIDER/FROM_EMAIL/NOTIFY_TO) o con `publicar-firebase.bat` desde una copia igual a main; 2) integrar PR #6 (Vercel recompila la web sin cambios); 3) Android OTA no es necesario (sin cambios de app).
- Pendientes que no corrige: restringir la clave de Google Maps de app.json al paquete com.hulul.app en Google Cloud; activar App Check (limitar abuso de solicitudes/registros); actualizar dependencias del cliente en la próxima build nativa; `check-home-preservation.cjs` compara contra V2 y está desactualizado; renombrar a mano el `publicar-app.bat` de la carpeta raíz antigua.

## En revisión — V5.3 app (NO publicada) · 24 oct 2026, Claude
- Rama `claude/cuenta-profesional-v5-3`, actualizada con main ef81c38 (incluye V5.2). Solo app Android (y módulo compartido); sin cambios de backend ni de web visibles.
- Corrige: cabecera de la app (la campana y "Mi cuenta" tapaban el logo HULUL en teléfonos de ~360 dp; ahora el logo se ajusta y "Mi cuenta" queda solo como ícono en pantallas angostas) y montos partidos en el panel del profesional ("$337.4 / 5").
- Nuevo: **Estado de cuenta del profesional** (`apps/mobile/app/estado-cuenta.tsx`, cálculo en `packages/shared/src/statement.ts`): ganado, comisión, multas, retenciones, neto por periodo; saldo a favor / disponible / en espera; faltas (x de 3 en 30 días) y suspensión; pagos semanales; movimientos. Lee `ledger`, `payouts` y `providers/{uid}`, ya permitidos por las reglas. Acceso desde la tarjeta "Ganado en 7 días" y el botón "Estado de cuenta".
- Verificado: TypeScript, `scripts/check-statement.mjs` (con movimientos reales de functions/money.js), horarios/tarifas, build web, export Android y revisión visual (exportación web temporal) a 360 y 412 px.
- Publicar: solo OTA Android (canal production) después de integrar; no requiere backend. Se publica junto con V5.2 (PR #6 integrado en main ef81c38).

## Estado vigente — V5.1 publicada el 24 de octubre de 2026
- Web: PR #5 integrado, commit e392844b0d12aaaf17dbefeb56122d12ea595549, Vercel SUCCESS. Dominio hululec.com verificado (HTTP 200, cabecera y estilos nuevos).
- Android: canal production, runtime 0.1.0, grupo a070ca0c-8003-4845-bf54-e2ff154bf08c; update 01a17108-329d-7e3c-b576-49c4c1bdd30f. EAS confirmó Published después de web SUCCESS.
- Código Android: 565aa84dcd72b70d27e37ce731708c15280cc883, integrado por PR #5. Incluye corrección concurrente de Claude al Stepper web.
- Publicado: selector opaco, cabecera compacta sin superposición en móvil/tablet, hora/minutos adaptables y llegada cada 30 minutos sin exigir fin de visita antes del cierre.
- Verificado: pruebas de horario y tarifas, TypeScript shared/mobile, compilación web y export Android. Falta solo comprobación del resultado en teléfono físico del usuario.
- Backend V5 compatible: no se modificó ni se volvió a desplegar en V5.1.
- Respaldo: web anterior c3dc7af (mismo código funcional V5); Android anterior ed19aca3-3e57-4923-b983-d76d1cf23e80. No recalcular registros históricos al revertir.
- Pendientes reales: módulo de reclamos, identidad de correos y bloqueo automático contra publicaciones obsoletas. No están incluidos en V5.1.
- Lo que sigue debajo conserva el historial; este bloque sustituye estados anteriores de publicación pendiente o Android no verificado.


Documento compartido entre todas las personas e IAs que trabajan en el repositorio.
**Antes de trabajar:** leer este archivo, consultar GitHub y anotar aquí cada entrega.

## Reglas de trabajo

1. Antes de empezar: `git fetch` y comparar con `origin/main`. Actualizar la copia **sin descartar cambios locales** (`git merge --ff-only`; si hay cambios propios, commit o `git stash` antes, nunca `reset --hard`).
2. Revisar la última versión integrada (último merge en `main`) y los despliegues activos (web en Vercel vía la API de *deployments* de GitHub; Android en EAS).
3. **No publicar desde una copia atrasada.** Publicar solo desde una copia igual a `origin/main` (o a la rama de la entrega).
4. **No ejecutar el publicador de la carpeta raíz antigua** (`publicar-app.bat` de la copia vieja) ni publicar desde ella.
5. Orden de publicación (de VERSION-5.md): backend y reglas → web de producción → OTA Android.
6. Cada entrega se anota en el registro de abajo: fecha, quién, rama/commit, qué se publicó y dónde, cómo revertir.

## Estado verificado — 2026-10-24 21:57 (Guayaquil)

| Elemento | Estado | Cómo se verificó |
|---|---|---|
| Última versión integrada | `main` = `3a06cf6` — Merge PR #4 `codex/pruebas-usuarios-v5` (Versión 5) | `git fetch` |
| Web producción (Vercel) | `3a06cf6`, despliegue 7304551772, **success**, https://hulul-fa3i49kkw-hulul.vercel.app (2026-10-24 21:12 UTC) | API de deployments de GitHub |
| Web vista previa | `b0d4f05` (rama v5), success, https://hulul-h8x1o7yx1-hulul.vercel.app | API de deployments de GitHub |
| Android (EAS) | **No verificado.** Canal `production`, runtime `0.1.0`. VERSION-5 no anota el grupo OTA publicado. Último grupo anotado: respaldo de V4 `af1a1897-2f5b-4710-ad36-0190c5a2afde`; V3 `a66e3c18-e9b4-4338-a714-48d3fe3a8055` | Repositorio (sin acceso a EAS desde la sesión de Claude) |
| Formulario de registro de profesionales (Apps Script) | Código en `herramientas/registro-profesionales/`. Publicado fuera de Vercel/EAS (implementación de Apps Script del dueño, "VERSION 9"). Pendiente confirmar: acceso "Cualquier usuario" y nueva versión con el `Index.html` generado | Repositorio; la implementación no es visible desde GitHub |

## Registro de entregas

| Fecha (Guayaquil) | Quién | Rama / commit | Qué | Publicado en | Reversión |
|---|---|---|---|---|---|
| 2026-10-21 a 22 | Claude | `main` 14da70a → 878be6d | Formulario anónimo de registro de profesionales (Apps Script + Sheets + Drive): estructura Firestore, cuenta bancaria obligatoria, categorías propias, firma electrónica (solo emisor y caducidad), verificación de rostro con prueba de vida y de documentos por OCR, `Index.html` generado sin comentarios | Apps Script del dueño (no Vercel ni EAS). Los commits a `main` dispararon builds de Vercel sin cambios en la web | Volver a pegar una versión anterior de `herramientas/registro-profesionales/` y publicar una nueva versión de Apps Script |
| 2026-10-23 a 24 | Otra IA (ramas `codex/*`) | PR #1 a #4 → `3a06cf6` | Versiones 2 a 5 de la web y la app (ver VERSION-3/4/5.md) | Vercel producción `3a06cf6`; Android: ver VERSION-*.md | Ver VERSION-*.md |
| 2026-10-24 21:57 | Claude | `main` (este archivo) | Verificación de estado y creación de ESTADO.md. Sin cambios de código | Solo documentación | — |
| 2026-10-24 22:10 | Claude | `codex/ajustes-capturas-v5` | Revisión V5.1 y corrección del Stepper web (globals.css: reglas antiguas 44×44 px anulaban el selector de día/hora/minutos). Detalle en ESTADO-COMPARTIDO-HULUL.md | No publicado (solo vista previa de la rama) | Revertir el commit en la rama |

## V5.1 — publicación en curso
Rama codex/ajustes-capturas-v5, basada en main actualizado. Corrige selector transparente, cabecera en móvil/tablet, controles de hora/minutos y horario por llegada con intervalos de 30 minutos. No modifica tarifas, cobros ni datos históricos. Typecheck, pruebas de horario/tarifas y build web final correctos. Backend V5 compatible, sin despliegue adicional necesario. Los identificadores finales se registrarán al completar web y OTA. Reclamos, identidad de correos y bloqueo automático de publicaciones antiguas siguen pendientes.

**Aviso (Claude, 22:10):** antes de unir a `main` y publicar V5.1, incluir el commit de corrección del Stepper web (ver registro). Sin él, en reprogramación el selector de día/hora/minutos se ve encogido.
