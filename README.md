# HULUL

Plataforma web y app de servicios del hogar a domicilio en Ecuador: climatización, plomería, electricidad, electrodomésticos, limpieza, belleza, mascotas y clases.

## Estructura

```
apps/
  web/      Sitio web (Next.js): páginas por servicio y ciudad para Google
  mobile/   App Android e iOS (Expo / React Native): búsqueda y reserva
packages/
  shared/   Lo que comparten web y app: marca, categorías, ciudades,
            precios (IVA 15 %), modelos de datos e íconos
```

## Cómo ejecutarlo

Necesitas [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install          # una sola vez, desde la carpeta raíz
```

**Web**

```bash
npm run web          # abre http://localhost:3000
```

**App en tu celular**

1. Instala **Expo Go** desde Google Play o App Store.
2. Ejecuta:
   ```bash
   npm run app
   ```
3. Escanea el código QR que aparece con la cámara (iPhone) o con Expo Go (Android).

## Qué incluye esta primera versión

**Web**
- Inicio con buscador, categorías, cómo funciona y preguntas frecuentes.
- Página por categoría (`/servicios/climatizacion`).
- Página por categoría y ciudad (`/servicios/climatizacion/samborondon`): 40 páginas pensadas para búsquedas como "limpieza por horas en Guayaquil", con datos estructurados para Google.
- Perfil de cada profesional.
- Página "Soy profesional" con formulario de registro.
- `sitemap.xml` y `robots.txt` automáticos.

**App**
- Inicio con búsqueda y categorías.
- Lista de profesionales con orden por valoración, disponibilidad y precio.
- Perfil del profesional.
- Reserva: día, hora, número de horas, dirección, forma de pago y total con IVA.
- Confirmación con el seguimiento del servicio.

## Firebase

Proyecto: **hulul-59081** (cuenta personal, separado de ARCSEG).

- La configuración pública está en `packages/shared/src/firebase.ts`.
- Las reservas se guardan en la colección `bookings` y las solicitudes de profesionales en `applications`, con la prueba de aceptación de la política de privacidad (versión y fecha).
- Las reglas de seguridad están en `firestore.rules` y se publican con `publicar-firebase.bat`.
- La analítica (Google Analytics) solo se activa para quien acepta las cookies de analítica.
- `functions/` tiene los avisos por correo: cada reserva nueva te llega con un botón para escribir al cliente por WhatsApp, y el cliente recibe su confirmación. Lo mismo con cada solicitud de profesional.

**Publicar en Firebase (Windows)**

1. Una sola vez: `configurar-correo.bat` (inicia sesión y guarda la contraseña de aplicación de Gmail como secreto).
2. Cada vez que cambien las reglas o las funciones: `publicar-firebase.bat`.

## Datos de demostración

Los profesionales, reseñas y valoraciones de `packages/shared/src/demo-data.ts` son **ficticios**. Se reemplazan por los datos reales de Firebase.

## Valores por definir

En `packages/shared/src/pricing.ts`:

| Valor | Actual | Qué es |
|---|---|---|
| `COMMISSION_RATE` | 15 % | Comisión que HULUL cobra al profesional |
| `PROTECTION_FEE` | $1,99 | Tarifa fija que paga el cliente por reserva |

En `apps/web/lib/site.ts`: enlaces de App Store y Google Play, y número de WhatsApp.

## Próximos pasos

1. **Firebase**: ya se guardan reservas y solicitudes. Falta el inicio de sesión (celular y Google), profesionales y reseñas reales desde Firestore, y notificaciones push.
2. **Pagos**: pasarela local (Payphone, Kushki o Datafast) con retención del pago hasta que el cliente apruebe.
3. **App del profesional**: disponibilidad, aceptar o rechazar trabajos y ganancias.
4. **Facturación electrónica SRI**.
5. **Google Maps**: dirección del cliente y seguimiento en vivo.
6. **Publicación**: web en Vercel con `hululapp.com` y app en las tiendas con EAS Build.
7. **Legal**: términos y condiciones y política de privacidad (LOPDP), redactados por un abogado.
