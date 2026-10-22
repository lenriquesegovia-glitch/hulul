# HULUL · Portal de registro de profesionales

Formulario para ir sumando profesionales independientes y empresas proveedoras antes de lanzar la app. Los clientes se registran en la app, no aquí. Lo que llenan cae en una hoja de Google Sheets y sus documentos en una carpeta de Google Drive, con los mismos campos que usa Firebase (`providers/{uid}`), para migrarlos después sin rehacer nada.

## Qué hay

| Archivo | Para qué |
|---|---|
| `apps/web/public/preregistro.html` | La página que llenan los profesionales y las empresas proveedoras. Una sola página, funciona en celular. |
| `herramientas/preregistro/Code.gs` | El "servidor" en Google Apps Script: recibe los datos, escribe la hoja y guarda los archivos. |

## Instalación (una sola vez, ~10 minutos)

Usa la cuenta **lenriquesegovia@gmail.com** (o la que quieras que sea dueña de los datos).

1. Entra a **script.google.com** → **Nuevo proyecto**. Ponle de nombre "HULUL pre-registro".
2. Borra lo que trae `Código.gs` y pega todo el contenido de `Code.gs`. Guarda.
3. Arriba, en la lista de funciones, elige **setup** y toca **Ejecutar**. Google pide permisos (Drive, Sheets y correo): acéptalos. Si sale "Google no verificó esta app", toca *Configuración avanzada → Ir a HULUL pre-registro*.
   - Esto crea en tu Drive la carpeta **HULUL · Pre-registro** con la hoja **HULUL · Pre-registro** y la subcarpeta **Profesionales**. Los enlaces salen en el registro de ejecución.
4. **Implementar → Nueva implementación → Tipo: Aplicación web**.
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier usuario**.
   - Copia la **URL de la aplicación web** (termina en `/exec`).
5. En la PC, en PowerShell dentro de C:\Users\lsego\Hulul, corre `.\actualizar.bat` para bajar lo último.
6. Abre `apps/web/public/preregistro.html` con el Bloc de notas y pega la URL en la línea `const ENDPOINT = '';` (entre las comillas). Guarda.
7. Súbelo: `git add apps/web/public/preregistro.html`, `git commit -m "Pre-registro: conectar con Google"`, `git push`. Vercel lo publica solo en **https://hululec.com/preregistro.html**.
8. Regístrate tú mismo de prueba y revisa que aparezca en la hoja y en la carpeta. Luego borra esa fila y esa carpeta.

Mientras no pegues la URL, la página se ve con un aviso de "modo demostración" y no guarda nada.

> Si cambias algo en `Code.gs` después, ve a **Implementar → Administrar implementaciones → editar (lápiz) → Versión: Nueva versión**. Así la URL no cambia.

## Qué se guarda

**Hoja "Profesionales":** una fila por profesional con todo el registro, enlace de WhatsApp, enlace a su carpeta, columna **Estado** (nuevo, contactado, en_revision, observado, aprobado, rechazado) para que lleves el seguimiento, **Posible duplicado** (misma cédula o celular) y **Notas HULUL**.

**Hoja "Categorías":** una fila por profesional y categoría (tarifa, trabajos, cómo se validó). Sirve para ver cuántos plomeros, electricistas, etc. tienes y en qué ciudades, con un filtro o una tabla dinámica.

**Hoja "Banco (privado)":** la cuenta bancaria de cada profesional. No compartas esta pestaña.

**Carpeta de cada profesional** (`Profesionales/Apellido Nombre · cédula · HP-XXXXXXXX`):
- `doc_cedulaFrente.jpg`, `doc_cedulaReverso.jpg`, `doc_selfie.jpg`, `doc_antecedentes`, `doc_ruc`, `doc_titulo` (si aplica).
- `ev_<categoría>_1.jpg`… certificados o fotos de trabajos de cada categoría.
- `datos.json`: el perfil con los nombres de campos de Firestore (`kind`, `firstName`, `cedula`, `categories`, `services`, `visitRates`, `catEvidence`, `catStatus`, `cities`, `days`, `from`, `to`, `offHours`, `holidays`, `surcharges`, `docs`, `taxRegime`, `eSignature`…), con `status: en_revision`. Los archivos van con su id de Drive.
- `banco.json`: igual que `providers/{uid}/private/banco`.

Por cada registro te llega un correo con el resumen, la carpeta y el WhatsApp del profesional; él recibe una confirmación con su código.

## Detalles del formulario

- Los mismos 6 pasos del registro de la app: datos, servicios (con tarifa dentro de la banda ±25 % y validación por categoría), zonas y horario (incluye fuera de horario y feriados con recargo), documentos, cobros y facturación, y envío.
- Valida cédula y RUC con el dígito verificador, igual que la app. Permite marcar **"RUC en trámite"** para no perder a quien aún no lo tiene; queda marcado en la columna **Faltan**.
- Régimen tributario con opción **"No sé"**: cuando lo revises con él, lo cambias.
- La cuenta bancaria es **obligatoria** y debe estar a nombre del profesional o de su empresa (la cédula o RUC del titular tiene que coincidir con la suya).
- Las fotos se reducen en el celular antes de subir (máx. 1.800 px), así suben rápido con datos móviles.
- Si el profesional cierra la página, sus datos escritos se guardan en ese navegador; las fotos hay que volver a subirlas.
- Al terminar le da un enlace para invitar a otros profesionales por WhatsApp; los invitados quedan con **Invitado por** = su código. Puedes usar lo mismo con tus propios enlaces: `hululec.com/preregistro.html?ref=FACEBOOK`, `?ref=VOLANTE-URDESA`, etc.
- La autorización de datos nombra a Corporación Coffeeport Cía. Ltda. (HULUL), conforme a la LOPDP, y aclara que el pre-registro no es contrato: los términos y el mandato de cobro se aceptan al activar la cuenta en la app.

## Cuando llegue la app: pasar a Firebase

Cada `datos.json` ya tiene la forma del documento `providers/{uid}`. El paso que falta es un script (lo hacemos cuando toque) que, por cada carpeta:

1. Crea la cuenta del profesional en Firebase Authentication con su correo o celular.
2. Sube sus archivos de Drive a Storage en `providers/{uid}/...` y cambia los ids de Drive por las rutas de Storage.
3. Escribe `providers/{uid}` y `providers/{uid}/private/banco`, con `status` y `catStatus` según lo que hayas aprobado en la hoja.
4. Marca la columna **Migrado a Firebase**.

Al profesional se le pedirá aceptar los términos y el mandato de cobro (`mandateAccepted`) la primera vez que entre a la app.

## Cuidados

- La hoja y la carpeta tienen datos personales y documentos de identidad: no las compartas con enlace público. Si alguien de tu equipo las revisa, compártelas solo con su correo.
- El enlace `/exec` es público (así funciona el formulario). Tiene una trampa para robots y valida todo en el servidor, pero si algún día llega basura, se puede agregar un captcha.
- Revisar con el abogado el texto de autorización de datos (está en `preregistro.html`, paso "Enviar").
