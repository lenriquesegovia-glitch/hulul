# Estado compartido HULUL — 24 octubre 2026

## Publicado y verificado en la entrega V5
- Repositorio: https://github.com/lenriquesegovia-glitch/hulul
- PR #4 integrado en main: 3a06cf67adf7fe67d1b28f55654a5a3ca590a43d.
- Implementación V5: b0d4f05983a7069b33d53ae734d5519c348e74ec.
- Web Vercel SUCCESS y backend Firebase desplegado en esa entrega.
- Android production runtime 0.1.0: grupo ed19aca3-3e57-4923-b983-d76d1cf23e80.
- Incluye tarifas especiales completas (no sumadas), selector nacional, resumen restringido de calificaciones del cliente, buzón persistente y tracker AHORA.
- Consultar despliegues actuales antes de asumir que siguen activos: otra herramienta puede publicar después.

## Trabajo más reciente: V5.1 EN REVISIÓN, NO PUBLICADO
Rama: codex/ajustes-capturas-v5, basada en origin/main vigente al iniciar.
- Selector de ciudad: fondo opaco correcto, input y cierre contenidos, nombre accesible.
- Cabecera compacta para móvil/tablet; en esos tamaños deja de ser sticky para no tapar reservas. Campana con contador y cuenta arriba; Soy pro y Reservar abajo en teléfonos.
- Controles de hora y minutos: números sin partirse; columnas adaptables en web y Android; botones de 48px. Minutos muestra 00, no :00.
- Decoración del hero desactivada hasta 1024px para evitar desbordamiento lateral.
- NUEVA decisión del usuario: quitar restricción de que el trabajo termine antes del cierre. Se valida la llegada, no la finalización. Para horario 08:00–17:00, 16:30 permitido aunque dure más de una hora. Implementado también 17:00 como límite inclusivo; 17:30 no, salvo horario especial aplicable. Sin anticipación mínima; mantener reglas de reservas aceptadas y tarifas especiales.
- SLOTS cada 30 minutos; reservas guardan HH:MM. No reinterpretar reservas históricas por índice.
- Estas decisiones reemplazan las notas previas que exigían terminar dentro de jornada.

## Verificación y pendientes
- Typecheck shared/mobile correcto. Pruebas check-booking-window y check-user-feedback correctas tras cambio de horario.
- Build web correcto antes del último cambio de horario; repetir build final.
- Selector y cabecera revisados a 390x844 y 768x1024. Falta revisión final de reprogramación y export Android.
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
