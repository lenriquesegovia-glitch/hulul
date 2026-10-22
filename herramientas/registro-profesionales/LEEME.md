# Registro de profesionales (formulario anónimo)

Formulario para ir sumando profesionales independientes y empresas proveedoras antes del lanzamiento, **sin mostrar la marca ni la app**. La página no dice HULUL, no menciona ninguna app, no usa los colores de la marca y no vive en hululec.com: la sirve Google desde una dirección `script.google.com/...`.

Lo que llenan cae en una hoja de Google Sheets y sus documentos en una carpeta de Google Drive, con los mismos campos que usa Firebase (`providers/{uid}`), para migrarlos después sin rehacer nada.

## Archivos

| Archivo | Para qué |
|---|---|
| `Index.html` | La página que llenan los profesionales. Funciona en celular. |
| `Code.gs` | Sirve la página, escribe la hoja y guarda los archivos. |

Los dos van dentro de un proyecto de Google Apps Script. No se suben a ninguna web.

## Instalación (una sola vez, ~10 minutos)

Usa la cuenta de Google que quieras que sea dueña de los datos.

1. Entra a **script.google.com** → **Nuevo proyecto**. Ponle de nombre "Registro de profesionales" (ese nombre no lo ve nadie más).
2. Borra lo que trae `Código.gs` y pega todo el contenido de `Code.gs`.
3. Toca **+ → HTML**, ponle de nombre exactamente `Index` y pega todo el contenido de `Index.html`. Guarda.
4. En `Code.gs`, al inicio, revisa `CONFIG`:
   - `CONTROLLER`: quién aparece como responsable de los datos en la autorización. Está **Corporación Coffeeport Cía. Ltda.** (no menciona HULUL). La Ley de Protección de Datos exige nombrar a alguien.
   - `CONTACT_EMAIL`: un correo para que el profesional pida corregir o borrar sus datos. Vacío = no se muestra. Conviene uno neutro (no @hululec.com).
   - `CONFIRM_TO_APPLICANT`: si es `true`, el profesional recibe un correo de confirmación sin marca, enviado desde tu cuenta de Google. Está en `false`.
5. Arriba, en la lista de funciones, elige **setup** y toca **Ejecutar**. Acepta los permisos (Drive, Sheets y correo). Si sale "Google no verificó esta app", toca *Configuración avanzada → Ir a Registro de profesionales*.
   - Usa la hoja y la carpeta ya definidas en `CONFIG` (`SHEET_ID` y `FOLDER_ID`) y crea en la hoja las pestañas **Profesionales**, **Categorías** y **Banco (privado)**. No borra nada de lo que la hoja ya tenga.
   - Haz la instalación con una cuenta que pueda **editar** esa hoja y esa carpeta.
6. **Implementar → Nueva implementación → Tipo: Aplicación web**.
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier usuario**.
   - La **URL de la aplicación web** (termina en `/exec`) es el enlace que compartes.
7. Ábrelo, regístrate tú de prueba y revisa la hoja y la carpeta. Luego borra esa fila y esa carpeta.

> Si cambias algo después: **Implementar → Administrar implementaciones → editar (lápiz) → Versión: Nueva versión**. Así el enlace no cambia.

Si quieres un enlace más corto, usa un acortador (bit.ly u otro) con un nombre que no diga la marca.

## Qué se guarda

Hoja: **1C97wrHqgCq5yGUEmyYNHizLglkdnPiY6hKVZSqflR_I**. Fotos y documentos: carpeta **RESPALDO DE PROVEEDORES** (1ZpZs19-_cT12vw-2oVLGt5yPfrlzQB0L). Para cambiarlas, edita `SHEET_ID` y `FOLDER_ID` en `CONFIG`.

### Estructura de la hoja (igual a Firestore)

Cada pestaña es una parte de Firestore y cada columna se llama exactamente igual que el campo. Las columnas que empiezan con `_` son de control y **no se suben**. Listas y objetos van en formato JSON dentro de la celda.

**Pestaña `providers`** → documento `providers/{uid}`, una fila por profesional.

| Columna | Qué es | Ejemplo |
|---|---|---|
| `_codigo` | Código del registro (columna A) | RP-5XP6MUNB |
| `_fecha` | Fecha del registro | 21/10/2026 21:30 |
| `_seguimiento` | Tu control: nuevo, contactado, documentos pendientes, listo | nuevo |
| `_duplicado` | Otros registros con la misma cédula o celular | RP-AB12CD34 |
| `_carpeta` | Enlace a su carpeta de documentos | https://drive.google.com/… |
| `_whatsapp` | Enlace directo a su WhatsApp | https://wa.me/593991234567 |
| `_notas` | Tus notas | |
| `_uid` | Se llena al migrar (uid de Firebase) | |
| `status` | **Lo cambias tú**: en_revision, observado, aprobado, rechazado | en_revision |
| `kind` | persona o empresa | persona |
| `firstName`, `lastName`, `businessName` | Nombres, apellidos, razón social | Juan · Vargas · |
| `cedula`, `ruc`, `phone`, `email` | Texto (conservan el 0 inicial) | 0926687856 · 0926687856001 · 0991234567 |
| `years`, `bio` | Años de experiencia y presentación | 5 · Plomero con… |
| `categories` | Categorías (JSON) | ["plomeria","electricidad"] |
| `services` | Trabajos por categoría | {"plomeria":["Destape de tuberías"]} |
| `visitRates` | Tarifa por visita por categoría | {"plomeria":20} |
| `catEvidence` | Cómo valida cada categoría; `files` = ids de Drive | {"plomeria":{"kind":"certificado","note":"SECAP 2019","files":["1Ab…"]}} |
| `cities`, `days` | Ciudades y días (0 = domingo) | ["guayaquil"] · [1,2,3,4,5,6] |
| `from`, `to`, `acceptsCash` | Horario y efectivo | 08:00 · 17:00 · TRUE |
| `offHours`, `holidays`, `surcharges` | Fuera de horario, feriados y recargos | [19,20] · FALSE · {"nocturno":10} |
| `taxRegime`, `eSignature` | Régimen SRI y firma electrónica (vacío si respondió "No sé") | rimpe_popular · FALSE |
| `docs` | Documentos con su id de Drive | {"cedulaFrente":{"driveId":"1Xy…","name":"doc_cedulaFrente.jpg"}} |
| `consentPrivacy`, `consentMarketing` | Autorizaciones | TRUE · TRUE |
| `preregistro` | Datos solo de este registro (código, RUC en trámite, zonas, invitado por, cómo se enteró) | {"rucPending":false,…} |

**Pestaña `providers.catStatus`** → campo `catStatus` del profesional. Una fila por profesional y categoría. Aquí **apruebas cada categoría** cambiando `catStatus` (en_revision, observado, aprobado, rechazado). Columnas: `_codigo`, `_nombre`, `category`, `catStatus`, `visitRate`, `services`, `evidenceKind`, `evidenceNote`, `evidenceReference`, `evidenceFiles`, `_carpeta`, `_categoria` (nombre visible de la categoría).

**Pestaña `providers.private.banco`** → documento `providers/{uid}/private/banco`. Columnas: `_codigo`, `_nombre`, `bank`, `type`, `number`, `holder`, `holderId`. No compartas esta pestaña.

Puedes corregir cualquier celda a mano (por ejemplo un nombre mal escrito): lo que esté en la hoja es lo que se sube.

### Carpetas

Dentro de **RESPALDO DE PROVEEDORES**, una carpeta por profesional (`Apellido Nombre · cédula · RP-XXXXXXXX`) con sus documentos (`doc_…`), certificados o fotos de trabajos (`ev_…`), `datos.json` y `banco.json` (respaldo de lo que envió).

Por cada registro te llega un correo con el resumen, la carpeta y el WhatsApp del profesional.

## Detalles del formulario

- Los mismos pasos del registro de la app: datos (profesional independiente o empresa), servicios con tarifa por visita libre (sin rango mínimo ni máximo) y validación por categoría, zonas y horario (incluye noche y feriados con recargo), documentos, cobros y envío.
- **Categorías y subcategorías:** elige de la lista y marca las subcategorías (trabajos) que hace; puede sumar subcategorías propias. Si su oficio no está, toca **+ Agregar mi actividad** y escribe el nombre y sus subcategorías. Esas quedan con `category` = `otra-1`, `otra-2`… y su nombre en `_categoria` y en `preregistro.customNames`; al migrar se asignan a una categoría de la app (o se crea la categoría nueva).
- **Firma electrónica:** pregunta si tiene, quién la emitió y cuándo caduca (quedan en `eSignature` y en `preregistro.eSignatureIssuer` / `preregistro.eSignatureExpires`). El archivo .p12 y su clave **no** se piden aquí: se cargan después, al activar la cuenta, directo en el proveedor de facturación electrónica.
- Valida cédula y RUC con el dígito verificador. Permite marcar **"RUC en trámite"** (queda en la columna **Faltan**).
- La cuenta bancaria es **obligatoria** y debe estar a nombre del profesional o de su empresa.
- Las fotos se reducen en el celular antes de subir.
- Al terminar puede compartir el enlace por WhatsApp con otros profesionales; los invitados quedan con **Invitado por** = su código. Para tus campañas: `…/exec?ref=FACEBOOK`, `?ref=VOLANTE-URDESA`, etc.
- No se mencionan comisión, cargo de plataforma, pagos semanales ni términos de la app: eso se explica al activar la cuenta.

## Cuando llegue la app: pasar a Firebase

1. Revisa la hoja: pon `status` = aprobado (u otro) en `providers` y aprueba las categorías en `providers.catStatus`.
2. En el editor de Apps Script ejecuta **exportarFirestore**. Deja en la carpeta RESPALDO DE PROVEEDORES el archivo `firestore-providers.json`, con un elemento por profesional: `{ codigo, uid, provider, banco, carpeta }`. `provider` ya es el documento `providers/{uid}` completo (con `catStatus` armado desde su pestaña) y `banco` es `private/banco`.
3. Con ese archivo, el script de importación (lo hacemos cuando toque) crea la cuenta de cada profesional en Firebase Authentication, sube sus archivos de Drive a Storage, escribe los documentos y anota el `_uid` en la hoja. El profesional acepta los términos y el mandato de cobro al entrar por primera vez a la app.

## Cuidados

- La hoja y la carpeta tienen documentos de identidad y cuentas bancarias: no las compartas con enlace público.
- El aviso que Google pone arriba de la página ("Esta aplicación fue creada por un usuario de Google Apps Script") es normal y no muestra ninguna marca.
- Revisar con el abogado el texto de autorización de datos (`Index.html`, paso "Enviar").
