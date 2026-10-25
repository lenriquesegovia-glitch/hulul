# Estado compartido HULUL — 24 octubre 2026

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


## Publicado y verificado en la entrega V5
- Repositorio: https://github.com/lenriquesegovia-glitch/hulul
- PR #4 integrado en main: 3a06cf67adf7fe67d1b28f55654a5a3ca590a43d.
- Implementación V5: b0d4f05983a7069b33d53ae734d5519c348e74ec.
- Web Vercel SUCCESS y backend Firebase desplegado en esa entrega.
- Android production runtime 0.1.0: grupo ed19aca3-3e57-4923-b983-d76d1cf23e80.
- Incluye tarifas especiales completas (no sumadas), selector nacional, resumen restringido de calificaciones del cliente, buzón persistente y tracker AHORA.
- Consultar despliegues actuales antes de asumir que siguen activos: otra herramienta puede publicar después.

## Trabajo más reciente: V5.1 VERIFICADA, PUBLICACIÓN EN CURSO
Rama: codex/ajustes-capturas-v5, basada en origin/main vigente al iniciar.
- Selector de ciudad: fondo opaco correcto, input y cierre contenidos, nombre accesible.
- Cabecera compacta para móvil/tablet; en esos tamaños deja de ser sticky para no tapar reservas. Campana con contador y cuenta arriba; Soy pro y Reservar abajo en teléfonos.
- Controles de hora y minutos: números sin partirse; columnas adaptables en web y Android; botones de 48px. Minutos muestra 00, no :00.
- Decoración del hero desactivada hasta 1024px para evitar desbordamiento lateral.
- NUEVA decisión del usuario: quitar restricción de que el trabajo termine antes del cierre. Se valida la llegada, no la finalización. Para horario 08:00–17:00, 16:30 permitido aunque dure más de una hora. Implementado también 17:00 como límite inclusivo; 17:30 no, salvo horario especial aplicable. Sin anticipación mínima; mantener reglas de reservas aceptadas y tarifas especiales.
- SLOTS cada 30 minutos; reservas guardan HH:MM. No reinterpretar reservas históricas por índice.
- Estas decisiones reemplazan las notas previas que exigían terminar dentro de jornada.

## Revisión de Claude sobre V5.1 — 24 oct 2026, 22:10 (Guayaquil)
- Typecheck shared/mobile, check-booking-window y check-user-feedback: correctos. Build web (Next 16) y export Android (expo export, 5.4 MB): correctos.
- check-home-preservation.cjs falla también en main: compara contra V2 (7f02a20) y la V5 cambió `pushTo` a propósito (buzón). Actualizar su línea base; no es regresión.
- **Error corregido en web:** reglas antiguas de globals.css (`.stepper` 44×44 px, `.stepper` dentro del grupo de chips y `.stepper:disabled`) anulaban el contenedor del selector − valor +. En reprogramación "Mañana" se cortaba y botones/números se salían. Se quitaron (solo Stepper.tsx usa la clase). Comprobado con el CSS compilado a 320/390/768 px, sin desborde. **Publicar V5.1 con este commit incluido.**
- Pendiente: ver el Stepper de Android en teléfono físico.

## Verificación y pendientes
- Typecheck shared/mobile correcto. Pruebas check-booking-window y check-user-feedback correctas tras cambio de horario.
- Build web final correcto después del cambio de horario.
- Selector y cabecera revisados a 390x844 y 768x1024. Reprogramación web revisada y corregida por Claude; export Android correcto.
- No desplegar hasta cerrar verificación. Web SUCCESS antes de Android OTA. No requiere cambio de backend para quitar restricción de finalización: esa restricción estaba en checkSlot compartido.
- Correo todavía conserva identidad vino. Se detectó en captura; usuario aclaró que el enfoque inmediato es presentación y superposiciones. No se modificó functions/index.js en esta rama.

## Reclamos: solicitud pendiente de diseño e implementación
Usuario solicita módulo de reclamos, notificación y estado visible para cliente, y bandeja que reduzca seguimiento manual. Hoy existe reportarProblema y correo, no se debe presentar un sistema de tickets como terminado.
Propuesta por desarrollar: número de caso, vínculo a reserva, motivo, evidencia, historial, estados Recibido/En revisión/Esperando respuesta/Resuelto/Cerrado; responsable, avisos, prioridades, recordatorios y filtros. Definir plazos operativos y resolución con el usuario. No automatizar reembolsos, sanciones ni cierres favorables sin reglas aprobadas.

## Coordinación entre IA
- GitHub es fuente del código; Obsidian es bitácora, no sincronización automática.
- Antes de editar: git fetch, revisar main y esta rama, preservar cambios locales. No reset/clean forzado.
- Carpeta de trabajo: C:\Users\lsego\Hulul\implementacion-v3.
- Raíz C:\Users\lsego\Hulul contiene copia vieja con cambios ajenos. NO ejecutar su publicar-app.bat ni publicar desde allí.
- Control automático contra publicación obsoleta todavía NO implementado.
- Actualizar este documento después de cada publicación con commit, PR y grupo OTA.

Registro canónico de despliegues: ESTADO.md. Consultar ese archivo para los identificadores de publicación posteriores a este punto de control.
