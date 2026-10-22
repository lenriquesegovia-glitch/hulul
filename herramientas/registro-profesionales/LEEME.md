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
   - Crea en tu Drive la carpeta **Registro de profesionales** con la hoja del mismo nombre y la subcarpeta **Profesionales**.
6. **Implementar → Nueva implementación → Tipo: Aplicación web**.
   - Ejecutar como: **Yo**.
   - Quién tiene acceso: **Cualquier usuario**.
   - La **URL de la aplicación web** (termina en `/exec`) es el enlace que compartes.
7. Ábrelo, regístrate tú de prueba y revisa la hoja y la carpeta. Luego borra esa fila y esa carpeta.

> Si cambias algo después: **Implementar → Administrar implementaciones → editar (lápiz) → Versión: Nueva versión**. Así el enlace no cambia.

Si quieres un enlace más corto, usa un acortador (bit.ly u otro) con un nombre que no diga la marca.

## Qué se guarda

**Hoja "Profesionales":** una fila por profesional con todo el registro, enlace de WhatsApp, enlace a su carpeta, columna **Estado** (nuevo, contactado, en_revision, observado, aprobado, rechazado), **Posible duplicado** (misma cédula o celular) y **Notas**.

**Hoja "Categorías":** una fila por profesional y categoría (tarifa, trabajos, cómo se validó), para ver cuántos tienes por oficio y ciudad.

**Hoja "Banco (privado)":** la cuenta bancaria de cada profesional. No compartas esta pestaña.

**Carpeta de cada profesional** (`Profesionales/Apellido Nombre · cédula · RP-XXXXXXXX`): sus documentos (`doc_…`), certificados o fotos de trabajos por categoría (`ev_…`), `datos.json` (perfil con los campos de Firestore, `status: en_revision`) y `banco.json` (igual que `providers/{uid}/private/banco`).

Por cada registro te llega un correo con el resumen, la carpeta y el WhatsApp del profesional.

## Detalles del formulario

- Los mismos pasos del registro de la app: datos (profesional independiente o empresa), servicios con tarifa por visita y validación por categoría, zonas y horario (incluye noche y feriados con recargo), documentos, cobros y envío.
- Valida cédula y RUC con el dígito verificador. Permite marcar **"RUC en trámite"** (queda en la columna **Faltan**).
- La cuenta bancaria es **obligatoria** y debe estar a nombre del profesional o de su empresa.
- Las fotos se reducen en el celular antes de subir.
- Al terminar puede compartir el enlace por WhatsApp con otros profesionales; los invitados quedan con **Invitado por** = su código. Para tus campañas: `…/exec?ref=FACEBOOK`, `?ref=VOLANTE-URDESA`, etc.
- No se mencionan comisión, cargo de plataforma, pagos semanales ni términos de la app: eso se explica al activar la cuenta.

## Cuando llegue la app: pasar a Firebase

Cada `datos.json` ya tiene la forma de `providers/{uid}`. Falta un script (lo hacemos cuando toque) que por cada carpeta cree la cuenta en Firebase Authentication, suba los archivos a Storage, escriba `providers/{uid}` y `private/banco`, y marque **Migrado a Firebase**. El profesional acepta los términos y el mandato de cobro al entrar por primera vez a la app.

## Cuidados

- La hoja y la carpeta tienen documentos de identidad y cuentas bancarias: no las compartas con enlace público.
- El aviso que Google pone arriba de la página ("Esta aplicación fue creada por un usuario de Google Apps Script") es normal y no muestra ninguna marca.
- Revisar con el abogado el texto de autorización de datos (`Index.html`, paso "Enviar").
