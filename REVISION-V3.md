# Inicio HULUL · versión 3 para revisión

Rama local `codex/inicio-resolver-v3`, basada en origin/main 7f02a20. Conserva el registro de profesionales vigente. No publicada, no enviada a GitHub.

## Cambios
Inicio con pregunta protagonista, explicación de HULUL y fotografía de tranquilidad en escritorio. En móvil se priorizan pregunta, buscador y reserva. Catálogo fotográfico de18 categorías debajo; Explorar desplaza hasta él. La elección inicial cliente/profesional conserva su lógica y destinos pero aparece en línea debajo de la portada, sin taparla.

Recomendaciones sin números. Fallback «Servicios destacados». Lectura nueva separada en web/app y dos funciones backend nuevas: homeDiscovery (solo lectura del agregado) y refreshHomeDiscovery (diaria04:00 America/Guayaquil). No se cambian escrituras de reservas, dinero ni reglas Firestore.

## Ranking
acceptedAt es la marca de aceptación existente, escrita por el servidor. El trabajo se reconoce únicamente si notes empieza por una etiqueta exacta del catálogo de su categoría (formato que guardan los formularios actuales). No se clasifica texto libre ni «Otro». Se excluyen demo, [PRUEBA], profesional tester, proveedor faltante, pendiente/cancelada/disputa y fechas inválidas. Una solicitud por cliente/trabajo en7d; mínimo20 solicitudes elegibles totales y3 clientes por trabajo. Umbrales iniciales configurables, no resultados estadísticos reales. Sin datos suficientes o snapshot vencido36h: destacados.

El servidor nunca publica notes, direcciones, clientes, bookings ni conteos. Solo IDs y etiquetas del catálogo. Se usa callable para la lectura: no se amplían permisos Firestore. El job solo escribe homeDiscovery/current. Regenerar catálogo/código backend con `node scripts/build-home-ranking.cjs` al modificar categorías o cálculo.

## Comprobaciones
- `npm.cmd run typecheck`: shared y móvil.
- `npm.cmd run build -w @hulul/web`: compilador/TypeScript generan las122 páginas. La ejecución final con acceso a red termina con exit1 (SecurityFatalError por versión Next heredada). Por tanto el comando final NO está aprobado para publicación aunque los archivos compilados existan.
- `npx.cmd expo export --platform android` desde apps/mobile: bundle Hermes; NO equivale a APK instalado o prueba física.
- `node --test functions/home-ranking.test.js functions/money.test.js`:11 pruebas, incluyendo regresión de cálculos monetarios.
- `node scripts/check-home-preservation.cjs`: declaraciones preexistentes de backend y Firebase sin modificaciones; lógica de RoleChooser conservada.
- Revisión visual del HTML/CSS compilado en escritorio y viewport390px mediante servidor estático. No usa hidratación ni API: no equivale a prueba de sesión, reserva ni pago en navegador.

## Antes de publicar
Revisar capturas y confirmar esta dirección. Probar recorridos autenticados en entorno de prueba y app instalada. El comando next dev informó una vulnerabilidad de la versión Next heredada y se detuvo; revisar actualización de seguridad por separado antes de producción, conservando pruebas de regresión. No se ocultó ese aviso ni se cambió la versión como parte del diseño.

Después de aprobación: publicar la rama y revisión de código, desplegar solo las dos funciones nuevas del ranking, comprobar ejecución y snapshot, y usar el canal EAS/configuración de la app vigente. No publicar todos los servicios Firebase indiscriminadamente ni reemplazar app.json/google-services.json locales.

Las credenciales/configuración local Android no se copiaron al worktree ni se incluyeron en commits. No se reemplazó el icono instalado ni splash.
