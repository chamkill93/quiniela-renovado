# Contrato de integración con backoffice

## Estado

Este documento describe la frontera interna `v1-draft` del frontend. No es el
contrato definitivo del proveedor: cada diferencia del backoffice real debe
resolverse en el adaptador o en un mapper validado, nunca dentro de páginas o
componentes.

El modo productivo se habilita con
`NEXT_PUBLIC_PRODUCT_GATEWAY_MODE=backoffice`. Si falta la URL base o uno de
los endpoints obligatorios, la aplicación falla de forma explícita y no cae al
modo preview. Omitir el modo en un build productivo también falla; `preview`
debe habilitarse de forma intencional únicamente en desarrollo o QA.

## Transporte

- JSON sobre HTTPS.
- `credentials: include` para que el backoffice administre la sesión.
- Preferencia: cookie `HttpOnly`, `Secure` y `SameSite` acordada con el dominio
  real. El frontend no persiste tokens ni contraseñas.
- Timeout por defecto: 15 segundos; configurable con
  `NEXT_PUBLIC_BACKOFFICE_TIMEOUT_MS`.
- Cancelación mediante `AbortSignal`.
- `Idempotency-Key` en jugadas y recargas.
- CORS, CSRF, dominio de cookies y política de expiración deben confirmarse con
  el equipo del backoffice antes de UAT.

## Endpoints configurables

La URL base usa `NEXT_PUBLIC_BACKOFFICE_BASE_URL`. Las rutas se suministran con
las siguientes variables; no se asume ningún path por defecto.
Pueden ser paths relativos a la base o URLs absolutas; el build agrega a CSP
únicamente los orígenes HTTP(S) explícitos de la base y de esas URLs.

| Capacidad | Variable | Requerida |
| --- | --- | --- |
| Consultar sesión | `NEXT_PUBLIC_BACKOFFICE_ENDPOINT_SESSION` | Sí |
| Bootstrap monolítico de compatibilidad | `NEXT_PUBLIC_BACKOFFICE_ENDPOINT_BOOTSTRAP` | No |
| Login | `NEXT_PUBLIC_BACKOFFICE_ENDPOINT_LOGIN` | Sí |
| Registro | `NEXT_PUBLIC_BACKOFFICE_ENDPOINT_REGISTER` | Sí |
| Logout | `NEXT_PUBLIC_BACKOFFICE_ENDPOINT_LOGOUT` | Sí |
| Catálogo | `NEXT_PUBLIC_BACKOFFICE_ENDPOINT_CATALOG` | Sí |
| Jugadas | `NEXT_PUBLIC_BACKOFFICE_ENDPOINT_PLAYS` | Sí |
| Registrar Quiniela | `NEXT_PUBLIC_BACKOFFICE_ENDPOINT_TRADITIONAL_PLAYS` | Sí |
| Registrar Instantánea | `NEXT_PUBLIC_BACKOFFICE_ENDPOINT_INSTANT_PLAYS` | Sí |
| Resultados | `NEXT_PUBLIC_BACKOFFICE_ENDPOINT_RESULTS` | Sí |
| Comprobante `{ticketId}` | `NEXT_PUBLIC_BACKOFFICE_ENDPOINT_TICKET` | No |
| Movimientos | `NEXT_PUBLIC_BACKOFFICE_ENDPOINT_WALLET_MOVEMENTS` | No, en pareja |
| Recarga | `NEXT_PUBLIC_BACKOFFICE_ENDPOINT_WALLET_TOPUP` | No, en pareja |

La billetera se muestra como capacidad no disponible si no están configuradas
ambas rutas. El template de comprobante, cuando se configure, debe contener el
token literal `{ticketId}`. La hidratación principal consulta sesión, catálogo,
jugadas y resultados por separado; el bootstrap monolítico queda solo como
compatibilidad para un proveedor que lo requiera fuera de esa composición.

## Convenciones de datos

- Moneda: `PYG`.
- Importes: enteros en guaraníes, sin decimales ni conversión en el frontend.
- Fechas: strings ISO 8601 con zona u offset. La presentación usa
  `America/Asuncion`/`es-PY`.
- Roles visibles: `PLAYER | ADMIN`; el frontend refleja la sesión, pero no
  concede permisos.
- IDs de juegos: los 6 tradicionales y 9 instantáneos definidos en
  `src/lib/gaming/types.ts`.
- Resultado y premio: siempre llegan en la respuesta autoritativa; los
  rodillos solo animan esos números.

Los DTO completos y sus schemas ejecutables viven en
`src/lib/backoffice/contracts.ts` y `src/lib/backoffice/validation.ts`.

## Autenticación

Login envía `documentOrPhone` y `password`. Registro envía `displayName`,
`documentOrPhone`, `password`, `acceptedTerms` y, cuando el contrato lo admita,
`email`/`phone`. La contraseña solo existe durante el envío del formulario y no
se guarda en storage, fixtures, logs o telemetría.

La respuesta autenticada contiene una sesión con `id`, `displayName`, `role`,
`balance` y `currency`. Un `401`, `419`, `440` o código `SESSION_EXPIRED`
limpia los datos privados y lleva la UI al estado no autorizado.

## Errores

El cliente acepta errores con objeto raíz o `{ error: ... }` y normaliza
`code`, `message`, `details/issues`, status HTTP y request/correlation ID. Las
familias estables son:

- HTTP/autorización;
- red;
- timeout;
- cancelación;
- JSON o payload incompatible;
- capacidad opcional no configurada.

Login/registro presentan estados específicos para credenciales rechazadas,
usuario existente, rate limit, sesión vencida e indisponibilidad. Los mensajes
del proveedor nunca se usan para decidir lógica.

## Preview y fixtures

`preview` existe para recorrido visual local. Sus rutas heredadas de Fase 1 no
forman parte de la arquitectura productiva. El registro preview está rotulado
como no persistente. Para pruebas de contrato se usa un gateway de fixtures con
respuestas predefinidas: no genera números, no calcula premios y no modifica
saldos.

## Pendientes para UAT

- Confirmar paths, payloads, códigos de error y versión real.
- Confirmar cookie, CORS y CSRF entre los dominios definitivos.
- Confirmar paginación, disponibilidad pública del catálogo/resultados y
  expiración de sesión.
- Confirmar contratos opcionales de billetera y comprobantes.
- Ejecutar pruebas de contrato contra el ambiente UAT antes de habilitar
  `backoffice`.
