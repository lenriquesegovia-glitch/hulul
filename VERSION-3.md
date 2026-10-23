# Version 3 — entrega separada

## Version anterior conservada
- Web: commit 7f02a20 de main. Despliegue Vercel confirmado: https://vercel.com/hulul/hulul/2kBfNvxMCn6dEmEJGtyWSTNDPCB9
- App Android: canal production, runtime 0.1.0, grupo a66e3c18-e9b4-4338-a714-48d3fe3a8055.

## Version nueva
- Rama Git: codex/inicio-resolver-v3.
- Web: vista previa de Vercel mediante la rama; main no se modifica.
- App: actualizacion en rama Expo version-3, sin mover el canal production.
- No se cambian reglas Firestore, reservas, pagos ni funciones actuales.
- Las recomendaciones usan Servicios destacados hasta que se desplieguen las dos funciones nuevas; no se simula popularidad.

## Seguridad y comprobaciones
Next actualizado a 16.4.2, compilacion web y 11 pruebas aprobadas. Quedan avisos de dependencias transitivas de Expo/Firebase. Los intentos de overrides no corrigieron el arbol de workspaces; se retiraron y no se presentan como soluciones. No se forza una migracion de Expo ni degradaciones sugeridas por npm audit.

## Volver atras
Mientras esta entrega sea de revision, web y app de produccion siguen en la version anterior. Tras promover V3, Vercel permite restaurar el despliegue anterior indicado arriba. Para Android, republicar el grupo anterior en production mediante EAS Update, verificando runtime 0.1.0 y el canal. No borrar la rama ni el grupo anterior.
