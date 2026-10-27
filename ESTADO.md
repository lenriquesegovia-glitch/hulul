# HULUL — Estado y registro de entregas

## En PR — Gastos de la empresa y nómina (/admin/gastos), 26 de octubre de 2026 (Claude)

- Nueva página en Finanzas: «Gastos y nómina». La ven socios, contadora y UAFE; registran y aprueban socios y contadora (permiso pagos). La UAFE no ve cédulas, cuentas ni el detalle por empleado.
- Gastos con categoría → cuenta Supercias (52xx), base, IVA (crédito tributario 1010501), retenciones, forma de pago, por pagar con vencimiento, gastos fijos que se copian al mes siguiente con un clic.
- Rol de pagos mensual: SBU 2026 $482, aporte personal 9,45 %, patronal 11,15 % + IECE y SECAP 0,5 %, décimos, vacaciones y fondos de reserva desde el mes 13. Borrador → aprobar (registra los gastos de nómina) → reabrir.
- Estado de resultados (ingresos HULUL − gastos = utilidad), curva ingresos vs. gastos, gastos por grupo, categoría y proveedor; todo tocable.
- Excel para la contadora (estado de resultados, gastos, diario de gastos y nómina, compras para el ATS, roles) y botón «Enviar a la contadora».
- Datos en `gastos`, `empleados`, `rolPagos` y `adminConfig/nomina` (solo servidor). Lógica en `functions/gastos-core.js` y `packages/shared/src/dashboard.ts`, con pruebas.
- Pendiente: la contadora valida cuentas y parámetros; adjuntar foto/PDF del comprobante; archivo de pago masivo de sueldos al banco.
- Devengado en todo (27-oct): cada gasto se reconoce en el mes que cubre; lo anual se reparte en 12 meses (pagados por anticipado 1010404) y el consumo de la nube que se cobra al mes siguiente va al mes en que se usó.
- Tarjeta de crédito: los cargos son deuda con la tarjeta (2010401) hasta registrar el pago del estado de cuenta; gastos pagados con tarjeta personal de un socio quedan como deuda con él (20108) hasta el reembolso.
- Plataformas (el stack: Firebase/Google Cloud, Vercel, Claude, Claude API, Expo, GitHub, Resend, Workspace, Google Play, Apple, dominios, Meta Ads): costo mensual, meses que faltan por registrar, IVA de servicios digitales, ISD 5 % y aviso de liquidación de compra faltante.
- Bandeja «Novedades por revisar» arriba del resumen ejecutivo: reclamos por vencer, pagos, aprobaciones, atrasos de hoy, calificaciones bajas, UAFE, SRI, gastos vencidos, rol e IESS, plataformas, socios. «Visto» por navegador; vuelve si cambia.
- Novedades desplegable (se recuerda oculta o abierta en el navegador).
- Subir estado de cuenta de la tarjeta (PDF, Excel o CSV): Claude lo lee (`leerEstadoTarjeta`, no se guarda el archivo), une IVA de servicios digitales e ISD a cada consumo, reconoce la plataforma y su devengado, marca duplicados; se revisa y se crean los gastos de una vez (`guardarGastosLote`). Por defecto la tarjeta es personal de Socio 1 (decisión de Luis): queda como deuda de la empresa con él hasta el reembolso.
- Necesita publicar con backend (funciones nuevas).

## En PR — Asistente de reclamos y decisión prellenada, 26 de octubre de 2026 (Claude)
- Misma rama, además: **menú** Gestión (Resumen, Reservas, Reclamos, Aprobar profesionales) · Finanzas (Contabilidad, Proveedores, Clientes) · Control (Cumplimiento UAFE, **Cumplimiento SRI** nuevo) · Administración (Equipo, roles y permisos).
- **Estados de cuenta semanales con aprobación**: el lunes `liquidacionSemanal` ya no envía PDFs; prepara `estadosCuenta/{semana}` en borrador (`prepareStatementsBatch`) y avisa a HULUL. En Proveedores → «Estados de cuenta de la semana» se revisan, se desmarcan y se aprueban (`adminEstadosSemana`, `aprobarEstadosSemana`). El correo de liquidación sigue saliendo sin adjunto.
- **Clientes**: pestaña Facturas (dos comprobantes por reserva cobrada: profesional por la visita y HULUL por el cargo de plataforma; `bookingInvoices`), estado de cuenta en PDF y por correo (`estadoCuentaClientePdf`, `enviarEstadoCuentaCliente`, `clientStatementPdf`). El detalle de cada reserva muestra sus comprobantes.
- **Enviar a la contadora** (Contabilidad): manda el Excel contable y el de ventas a quienes tengan el rol Contabilidad (`enviarContadora`; el destinatario no se escribe a mano).
- **Cumplimiento SRI** (`/admin/sri`): próximo vencimiento por noveno dígito del RUC (6 → día 20), ventas gravadas e IVA de HULUL, facturas de profesionales (terceros), retenciones y Excel.
- Todas las tarjetas del panel abren su detalle o filtran (Clientes, Cumplimiento, Proveedores).
- **Claude (IA) en reclamos**: clave en Administración → «Conexión con Claude» (`guardarClaveIA`, se prueba y queda en `adminConfig/ia`, solo servidor). En cada reclamo «Analizar con IA» (`analizarReclamoIA`, `functions/ia-reclamos.js`, modelo claude-sonnet-5-5): envía versiones, chat (sin teléfonos ni correos), hasta 8 fotos y la evidencia; guarda el resultado en `reclamos/{id}/privado/ia`; «Usar la recomendación» llena la decisión. **Pendiente legal:** sumar el análisis por proveedor de IA a la política de privacidad.
- Rama `claude/reclamos-asistente`. Publicar con **backend** (android no).
- `claimAdvice` (functions/reclamos-core.js, con pruebas): lee la evidencia (llegada y distancia GPS, atraso, timbres, código de inicio, fotos, resultado marcado, duración, respuesta en plazo, calificaciones, reclamos y faltas previas) y sugiere lado, confianza y razones. `adminReclamo` lo devuelve como `advice`; `adminReclamos` agrega `suggestion` a los abiertos.
- Panel: al elegir «A favor del cliente/profesional» se llenan multa, crédito, faltas y motivo (editables). Por defecto: a favor del cliente que reclama → crédito $5, falta al profesional y multa $10 («no vino», «sí estaba») o $5 (otros); a favor del profesional → se cobra y se libera el pago; falta al cliente si el reclamo era del profesional o si el del cliente era claramente infundado.

## En PR — Calificación obligatoria, proveedor como mini CRM y curva de dinero, 26 de octubre de 2026 (Claude)
- Rama `claude/proveedor-crm-calificacion`. **Toca la app: publicar con backend y android.**
- **Calificar antes de reservar otra vez**: si el cliente tiene un servicio completado sin calificar, la web y la app le piden calificarlo antes del formulario de reserva (`pendingRating` en `packages/shared/src/firebase.ts`, `RateFirst` en `reservar/[id]`); el servidor (`avisoReserva` → `unratedBookingOf`) anula una reserva nueva que llegue sin esa calificación.
- **Resumen ejecutivo**: «Dinero del periodo» con Entra (todos los medios, desglosado), Por cobrar (proyección), Sale (profesionales y créditos a clientes) y Queda para HULUL, más curva tipo trading (entra, sale, neto, proyección) por día, semana o mes; cada punto abre sus reservas. El pastel lleva debajo «Cómo quedó el trabajo» y «Puntualidad»; «Semana a semana» se cambió por «Resultado por servicio» (éxito, con problema, pendiente por categoría).
- **Proveedor**: KPI tocables; calificación calculada de las reservas («Sin calificar» y cuántos trabajos calificados); pastel de desempeño; actividad como mini CRM (filtro por etapa; vistas por fecha, tablero y línea de tiempo tipo Gantt). Facturas estimadas para reservas sin movimientos (prueba o anteriores al libro). Mismo mini CRM en Clientes.
- **Fotos** del pedido y del trabajo en el detalle de la reserva, solo dueño y socio, se cargan al tocar «Ver fotos».
- Los reclamos del cliente se abren con el botón «Ayuda con este servicio» (texto neutro decidido por Luis); el del profesional dice «Reportar un problema con el cliente».
- Segunda ronda (misma rama): roles «Socio 1» (antes Dueño) y «Socio 2»; tarjetas de dinero = Ingreso (todos los medios), Ingreso por tarjeta (cuadra con el banco), Por cobrar, Salida y Queda para HULUL; al tocar una tarjeta la curva muestra solo esa línea («Ver reservas» abre la lista). Contabilidad: tarjetas y filas llevan al libro filtrado.
- **Reclamos antiguos** (solo en `bookings.dispute`, antes de V5.5): `adminReclamos` los pasa a `reclamos/{id}` (plazos desde hoy, `legacy: true`) para verlos y decidirlos; el detalle de la reserva muestra el reclamo (motivo, textos, estado, decisión) y enlaza al expediente.
- **Deuda de efectivo**: `registrarAbono` (Contabilidad → Por cobrar → «Registrar pago recibido»), movimiento `abono_profesional` en `recaudo` con `proDelta` positivo; en el diario va a 10101 / 2010301.
- **Estado de cuenta PDF** (`functions/statement-pdf.js`, pdfkit): descarga y «Enviar por correo» en la ficha del proveedor (`estadoCuentaPdf`, `enviarEstadoCuenta`); los lunes la liquidación lleva el PDF adjunto y los demás profesionales con movimientos en 7 días reciben su estado de cuenta.
- Curva de proveedores (general y por profesional): cobrado, comisión HULUL, para el profesional y programado.

## Publicado — Resumen cualitativo, pagos al banco y Excel contable, 26 de octubre de 2026 (Claude)
- Rama `claude/resumen-cualitativo-pagos`. Pedido de Luis tras ver el panel publicado (main 79d0ea8, run con backend ✅).
- **Resumen ejecutivo** sin las etapas (quedan en Reservas): dinero de la semana (entra, HULUL debe pagar hoy, pago estimado del lunes, IVA y créditos), estrellas 1–5, comentarios de 3★ o menos, cómo quedó el trabajo, puntualidad, tiempo para aceptar, fidelidad, calificación por servicio y motivos de cancelación y reclamo. **Cada número abre la lista de reservas que lo forman.**
- **Contabilidad**: pestañas Por pagar (lotes semanales con el listado de profesionales, «Descargar archivo para el banco» y «Marcar lote pagado» con el número de orden) y Por cobrar (profesionales que deben, reservas por cobrar). Antes / Durante / Después se pueden tocar.
- Funciones nuevas: `archivoPagos` (permiso pagos; arma el archivo con cuentas completas; `functions/bank-files.js`) y `marcarLotePagado`. Formato actual: plantilla CSV HULUL; **falta el instructivo de Banco del Pacífico (Cash Management)** para agregar su formato exacto en `bank-files.js`.
- **Excel**: todas las exportaciones del panel salen en .xlsx (exceljs). «Excel para la contadora (NIIF)»: libro diario por partida doble con códigos de la Superintendencia de Compañías (10101, 1010205, 1010208, 2010301, 2010701, 20113, 4102, 4109; gasto 52 a definir), mayor por cuenta, ventas de HULUL, terceros, liquidaciones y plan de cuentas. «Ventas para el SRI»: comprobantes de HULUL (cargo de plataforma y comisión) con base e IVA. Cuentas en `SUPERCIAS_ACCOUNTS` (dashboard.ts), por validar con la contadora.
- `adminTablero` ahora trae el texto de las reseñas (`reviews`) y `acceptedAt`. Publicar con backend.

## Publicado — Roles del panel (/admin/equipo), 26 de octubre de 2026 (Claude)
- PR #11 integrado (main 79d0ea8) y publicado por Luis con backend ✅ (verificar, backend, web; android omitido). Roles: **Dueño** (correos de ADMIN_EMAILS: todo + equipo), **Socio** (todo menos equipo), **Contabilidad** (Resumen, Contabilidad, Proveedores; marca liquidaciones pagadas), **Oficial de cumplimiento (UAFE)** (solo lectura: reservas, clientes, proveedores, contabilidad y Cumplimiento; sin reclamos ni chats).
- Se dan y quitan en hululec.com/admin/equipo (solo dueño): `adminRoles/{correo}` (solo servidor), funciones `adminEquipo`, `adminGuardarRol` (envía correo con el enlace), `adminQuitarRol`; cada cambio en `adminAccesos`. Todas las funciones del panel exigen el permiso de su sección (`functions/roles-core.js`, igual a `ROLE_PERMS` en `packages/shared/src/dashboard.ts`).
- Nueva sección **Cumplimiento (UAFE)**: alertas (operación ≥ $1.000; cliente ≥ $5.000 / $10.000 al mes; efectivo ≥ $2.000 al mes; 5+ servicios en 7 días con el mismo profesional; profesional > $10.000 liquidados al mes) y registro de operaciones exportable. Umbrales de referencia en `COMPLIANCE_LIMITS`, por confirmar con la oficial.
- Publicar con backend (funciones y reglas). El PR #10 (tablero) ya está en main y también necesita el backend publicado.

## Publicado — Tablero de administración (/admin), 26 de octubre de 2026 (Claude)
- PR #10 integrado a main por Luis y publicado con el PR #11 ("Publicar HULUL" con `backend=true`, `android=false`): la app no cambia.
- `/admin`: Resumen ejecutivo (pastel del 100 % de lo terminado: éxito, atrasado, mal servicio, en reclamo, falla del profesional, cliente ausente, cancelaciones; tasas, clientes reportados, ventas, ingreso HULUL, semanas, categorías, rankings), Reservas (CRM) por etapa en tarjetas / lista / por día con periodos, Clientes, Contabilidad (antes / durante / después, bolsas, libro, liquidaciones con "marcar pagada") y Proveedores (facturado, comisión, saldo, liquidaciones, actividad). Reclamos y Aprobar profesionales quedan en el mismo menú.
- Funciones nuevas: `adminTablero` (solo ADMIN_EMAILS, contactos enmascarados, acceso en `adminAccesos`) y `marcarLiquidacion`. Lógica en `packages/shared/src/dashboard.ts` y `functions/tablero-core.js`; pruebas en `scripts/check-dashboard.mjs` y `functions/tablero-core.test.js`.
- Revisión local con datos de muestra: `node scripts/muestra-tablero.mjs` y `NEXT_PUBLIC_ADMIN_MUESTRA=1 npx next dev` en apps/web (solo en desarrollo).

## Estado vigente — Acceso, registro verificado y panel de profesionales, publicado el 25 de octubre de 2026 (Claude)
- main **a4b350a** (con ef19299 y 3cfd16a). "Publicar HULUL" manual: verificar ✅ → backend ✅ → web ✅ → android ✅ (OTA production).
- Acceso: web con Google, Outlook (Microsoft Entra, secreto vence oct-2028) y correo; sin SMS; Facebook oculto. App: Google y Outlook por el navegador (`/app-login` → `tokenApp` → `hulul://login`, pantalla `app/login.tsx`), sin APK nuevo.
- Registro de profesionales: ciudades de los 222 cantones; actividades nuevas (`proposals`, en revisión); verificación de documentos como el formulario anónimo (OCR Cloud Vision en `verificarDocumento`, lógica en `functions/doc-verify.js`; selfie con prueba de vida comparada en el celular); al enviar se vuelve a exigir y, si falta algo, vuelve a observado.
- Panel `/admin/profesionales` (mismo acceso ADMIN_EMAILS): documentos con resultado de verificación, decisión por categoría, aprobar / pedir corrección / rechazar con motivo; avisos automáticos (correo y notificación).
- Google Cloud: activadas Cloud Vision API e IAM Service Account Credentials API; rol Creador de tokens de cuenta de servicio a 1070795690327-compute@.
- Copia local antigua C:\Users\lsego\Hulul tiene 56 commits de atraso y archivos que chocan: publicar solo con el publicador de GitHub Actions o desde una copia limpia.
- Detalle en el documento del proyecto claude/hulul-acceso.md.

## Anterior — V5.5 publicada el 25 de octubre de 2026 (Claude)
- PR #9 → main **49937f0**. "Publicar HULUL" run 40241447524: verificar ✅ (incluye reglas en emulador) → backend ✅ → web ✅ (Vercel Production 7320276990) → android ✅ (OTA production).
- **Protocolo de reclamos** (decidido por el dueño): abren cliente o profesional hasta 48 h después; la otra parte responde en 24 h; HULUL decide en máximo 72 h. Si reclama el cliente, el pago queda retenido.
- Datos: `reclamos/{reserva}` (solo servidor escribe; leen las dos partes), `reclamos/{id}/privado/textos` (originales sin moderar) y `reclamos/{id}/accesos` (registro de cada apertura, contacto mostrado y decisión). Fotos en Storage `reclamos/{uid}/{reserva}/`.
- Funciones: `reportarProblema` (cliente), `reportarProblemaPro`, `responderReclamo`, `adminReclamos`, `adminReclamo`, `resolverReclamo`, `plazosReclamos` (cada 30 min: sin respuesta → revisión; correo 12 h antes de vencer y al vencer).
- Panel privado: https://hululec.com/admin/reclamos — acceso por correo verificado en ADMIN_EMAILS (por defecto lenriquesegovia@gmail.com; para sumar a alguien: variable ADMIN_EMAILS en GitHub con los correos separados por coma y volver a publicar el backend).
- Decisión: a favor de cliente (sin cobro, multa opcional al profesional, crédito opcional) o profesional (se paga); faltas opcionales a cualquiera. Motivo obligatorio, visible para ambos.
- Privacidad: contacto enmascarado en el panel; política de privacidad versión 2026-10-25.
- Respaldo: main 77c21b7 (V5.4).

## Anterior — V5.4 publicada el 25 de octubre de 2026 (Claude)
- PR #8 → main **8af30df**. Publicado con "Publicar HULUL", run 40231949744: verificar ✅ → backend ✅ → web ✅ (Vercel Production 7318877981) → android ✅ (OTA production).
- Nuevo: **timbre al cliente** (función `timbrar`): hasta 3 avisos con sonido, cada 3 min, guardados en `bookings.rings`. "El cliente no está" exige 3 timbres + 10 min de espera. Términos (versión 2026-10-25) y FAQ actualizados.
- Filtro de groserías: palabras de México (chingada, pinche…) y corrección de signos finales ("!!" ocultaba la palabra). Pruebas en `functions/profanity.test.js`.
- Respaldo: main c94f59b (V5.3).

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
