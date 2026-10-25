# HULUL — Estado y registro de entregas

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

## V5.1 — publicación en curso
Rama codex/ajustes-capturas-v5, basada en main actualizado. Corrige selector transparente, cabecera en móvil/tablet, controles de hora/minutos y horario por llegada con intervalos de 30 minutos. No modifica tarifas, cobros ni datos históricos. Typecheck, pruebas de horario/tarifas y build web final correctos. Backend V5 compatible, sin despliegue adicional necesario. Los identificadores finales se registrarán al completar web y OTA. Reclamos, identidad de correos y bloqueo automático de publicaciones antiguas siguen pendientes.
| 2026-10-24 22:10 | Claude | `codex/ajustes-capturas-v5` | Revisión V5.1 y corrección del Stepper web (globals.css: reglas antiguas 44×44 px anulaban el selector de día/hora/minutos). Detalle en ESTADO-COMPARTIDO-HULUL.md | No publicado (solo vista previa de la rama) | Revertir el commit en la rama |
