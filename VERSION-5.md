# Versión 5 — ajustes tras pruebas con usuarios

## Comportamiento
- Nuevas reservas usan pricingVersion 2: tarifa nocturna/feriado reemplaza a la normal; 0 mantiene normal; coincidencias escogen la mayor. Se guarda en visit, con surcharge 0. Contabilidad histórica y money.js no cambian. Apps antiguas no pueden crear nuevas reservas con recargos especiales acumulados; reciben aviso de actualización. Se exceptúan eventos antiguos anteriores al corte 2026-10-24T14:17:23Z.
- Selector bajo HULUL, ciudades/cantones con provincia y búsqueda de alias/parroquias, persistencia local y filtro por cobertura declarada del profesional. Catálogo independiente de las páginas SEO; incluye las 24 provincias. Fuente: https://github.com/GAumala/geografia.ec, transcripción INEC 2025 recuperada el 24-oct-2026. No confundir localidades del catálogo con oferta activa.
- Resumen de calificaciones del cliente consultado por función autenticada y restringida al profesional asignado; devuelve solo nombre, promedio y cantidad. No expone comentarios privados ni datos del perfil.
- Buzón por usuario, 100 avisos recientes, campana y contador de no leídos en esa ventana. Se persiste aunque no haya permiso/token de push. Solo el dueño puede leer y marcar leído. Avisos históricos anteriores a este despliegue no se reconstruyen. Push espera navegación/sesión y conserva contexto; chat tiene acceso directo. Los avisos idénticos se deduplican; los mensajes incluyen su id para no confundir dos textos iguales.
- Tracker muestra AHORA, alto contraste e indicador lleno. Checks solo en pasos terminados. Propuestas de horario arriba y diferenciadas del estado confirmado.
- Nueva pantalla web de detalle de trabajo para enlaces de notificaciones, incluso reservas en historial.

## Verificación
- Compilación Next.js 16.4.2: correcta.
- TypeScript shared y Android: correcto.
- scripts/check-user-feedback.cjs: tarifas 15/30/45, noche+feriado, tres regímenes, contabilidad histórica, acceso a resumen y catálogo nacional.
- scripts/check-booking-window.cjs: anticipación cero y fin de jornada preservados.
- 11 pruebas de dinero y ranking: correctas.
- Revisión web a 390 x 844: selector bajo logo, campana, fotos conservadas. Cuenca seleccionada persiste en navegación y lista vacía correcta.
- No se crearon reservas/cobros reales para probar. No hay emulador de reglas (Java no instalado); reglas se compilan en despliegue. Recepción de push desde Android físico requiere comprobación de usuario.

## Publicación / reversión
Publicar backend y reglas antes que clientes. Web producción antes de OTA Android. Mantener rama codex/pruebas-usuarios-v5 y PR como versión recuperable. No publicar desde copia raíz antigua ni ejecutar su publicar-app.bat.
Una reversión de interfaz no debe revertir importes guardados. No borrar pricingVersion ni recalcular registros históricos.
