# Módulo Cuenta

La vista autenticada conserva `AccountClient` para login, registro y cierre de sesión, y usa `AccountDashboard` para el perfil, saldo y bloque inferior de opciones. La presentación pública no contiene etiquetas de cuenta de prueba ni avisos de demostración. El cierre de sesión está al final del bloque, bajo el título «Sesión».

Las acciones de Cuenta se exponen mediante la capacidad opcional `ProductGateway.account`, definida en `src/lib/account/contracts.ts`. El proveedor local la implementa con peticiones al servidor; un backoffice externo debe implementar su propio contrato antes de habilitar esas acciones. No hay fallback al proveedor local cuando se usa `backoffice`.

## Contacto por WhatsApp

Configurar `NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER` con el número oficial en formato internacional, incluyendo código de país. La configuración es pública y se incorpora al compilar. Reiniciar desarrollo o recompilar después de cambiarla.

Un valor vacío o inválido muestra un panel informativo con acceso a `/ayuda`; no se utiliza un número de ejemplo ni un destinatario alternativo. El enlace válido abre `https://wa.me/` en otra pestaña con un mensaje fijo sin ID, nombre, saldo ni credenciales del usuario. No envía un mensaje automáticamente.

El ícono de WhatsApp procede de [Simple Icons](https://github.com/simple-icons/simple-icons/blob/develop/icons/whatsapp.svg) y está guardado en `public/assets/icons/ui/whatsapp.svg`.

## Autolímites y pausas

En el proveedor local, los controles se guardan en el servidor y se aplican a la **sesión actual**, incluso al navegar o recargar la página. La interfaz informa ese alcance antes y después de confirmar; no los presenta como una autoexclusión persistente de una identidad.

- Los importes diario y semanal cuentan las apuestas aceptadas en las últimas 24 horas y 7 días. Suman tanto jugadas instantáneas como tradicionales; los premios o reintegros no reducen el importe apostado. No son límites de depósito.
- El tiempo máximo (15, 30, 60 o 120 minutos) se mide desde el inicio de la sesión, sin reiniciarlo al consultar o guardar preferencias.
- Los límites ya guardados solo pueden reducirse. Si se fija un límite inferior al uso acumulado, se bloquean las nuevas jugadas; no se alteran las ya aceptadas.
- Una pausa de 15, 30 o 60 minutos requiere confirmación y no puede acortarse mientras esté vigente. La pausa y el tiempo máximo bloquean nuevas jugadas y recargas, pero permiten consultar saldo, historial, comprobantes y cerrar sesión.
- Los controles se comprueban antes de generar resultados o modificar el saldo. Reintentar una operación ya aceptada con la misma clave idempotente recupera su respuesta sin volver a cobrar, acreditar o extender una pausa.

Los datos y restricciones siguen el ciclo de vida de las sesiones en memoria: se pierden al cerrar sesión, crear otra sesión, expirar por inactividad, ser desalojados por capacidad o reiniciar el proceso. Este servicio no proporciona autenticación persistente, almacenamiento de usuarios ni autoexclusión entre dispositivos. Esas garantías deben venir del backoffice de producción; ocultar el texto de prueba no cambia esa limitación técnica.

## Perfil, registro y solicitudes

El nombre visible se edita con validación de 2 a 80 caracteres. Actualizarlo no modifica identificación, rol, saldo ni movimientos. No se inventan teléfono, email, verificación ni un cambio de contraseña no soportado. «Seguridad y acceso» conserva recomendaciones y acceso a privacidad.

El registro local ahora establece una sesión de servidor y su cookie, en vez de devolver solamente un fixture del navegador. El identificador `source: "preview-session"` hace que `ProductProvider` hidrate catálogo, resultados y movimientos después del registro. No se almacenan las credenciales ni se promete que puedan recuperar una cuenta tras reiniciar la sesión.

Rutas locales:

- `GET /api/mock/account`: preferencias y uso de la sesión.
- `POST /api/mock/account/limits`: guardar o reducir autolímites.
- `POST /api/mock/account/pause`: activar o ampliar la pausa.
- `POST /api/mock/account/profile`: actualizar el nombre visible.
- `POST /api/mock/session/register`: establecer la nueva sesión y cookie.

Las rutas de Cuenta comparan `X-Account-Session` con la cookie **antes** de consultar o mutar. Si otra pestaña cambió la sesión, rechazan con 409 y no modifican la cuenta nueva. Las mutaciones requieren `Idempotency-Key`; el proveedor conserva la clave para reintentos fallidos, valida la identidad de la respuesta y cancela resultados de sesiones anteriores. Los errores de pausa/tiempo son 423 y los de límites/conflicto son 409, sin interpretarlos como un cierre de sesión.

La interfaz espera la respuesta antes de confirmar, bloquea envíos duplicados, conserva datos ante errores y permite reintentar. Al cerrar un panel cancela su petición y descarta actualizaciones tardías. Las opciones no implementadas por un servicio externo muestran indisponibilidad, sin afirmar que un cambio fue guardado.

## Centro de ayuda

`/ayuda` presenta 13 preguntas sobre quiniela con búsqueda sin distinción de mayúsculas o acentos, categorías y respuestas desplegables accesibles. `help-data.ts` centraliza el contenido y enlaza a modalidades, reglas, resultados, jugadas, saldo y Cuenta.

Las respuestas describen las modalidades y los rangos aceptados por los esquemas actuales. No inventan multiplicadores, horarios de cierre, liquidaciones automáticas, retiros, anulaciones ni plazos de cobro. La cuenta regresiva corresponde a la hora del sorteo y no a un corte de recepción de apuestas.

## Verificación

- `tests/unit/auth-ui/account-dashboard.component.test.tsx`: opciones, destinos, perfil, límites, confirmación de pausa, errores, cancelación, capacidades y logout.
- `tests/unit/auth-ui/account-options.test.ts`: validación de contacto y de importes.
- `tests/unit/auth-ui/account-client.component.test.tsx`: flujos de autenticación con `ProductProvider`.
- `tests/unit/auth-ui/account-api.test.ts`: cookies, sesión esperada, idempotencia, errores y registro en las rutas.
- `tests/unit/gaming/account-controls.test.ts`: restricciones del servidor, uso acumulado, límites temporales, pausas, perfil y reintentos.
- `tests/unit/product-gateway/account.test.ts`: transporte, cabeceras, contratos y cancelación de Cuenta.
- `tests/unit/product-gateway/account-provider.test.tsx`: sesión esperada, hidratación y aislamiento de actualizaciones de Cuenta.
- `tests/unit/product-views/help-client.component.test.tsx`: contenido, búsqueda, filtros, enlaces y respuestas desplegables.

Los estilos están aislados en `account.module.css`, usan los temas existentes, agrupan las columnas según el ancho disponible y conservan objetivos táctiles de al menos 44 px.
