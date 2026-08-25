# FASE 2 - Frontend integrable con backoffice

## Objetivo

Partiendo de la Fase 1 estable, preparar quinie.LA para consumir un backoffice externo sin acoplar la interfaz a una implementación concreta. Esta fase entrega contratos TypeScript, conectores intercambiables y los flujos frontend de inicio de sesión y registro de usuario.

La aplicación continúa siendo un frontend. El backoffice externo es la única fuente de verdad para identidad, sesión, catálogo, saldo, jugadas, resultados, comprobantes y estados operativos.

## Alcance

### Capa de contratos

- Definir DTO y tipos compartidos para sesión, usuario, catálogo, saldo, jugada, resultado, comprobante, paginación y error de API.
- Definir interfaces por capacidad, como mínimo `AuthGateway` y `GamingGateway`, detrás de un `BackofficeGateway` inyectable.
- Mantener separados los modelos de transporte y los modelos que usa la UI cuando una conversión sea necesaria.
- Versionar el contrato y documentar los campos obligatorios, opcionales, enums, unidades monetarias, fechas y zonas horarias.
- Modelar respuestas exitosas y errores sin depender de mensajes de texto del proveedor.

### Conectores

- Implementar un adaptador HTTP configurable por variable de entorno pública para conectarse al backoffice real.
- Implementar un adaptador mock de transporte, basado en fixtures deterministas, para desarrollo visual, pruebas y demostración sin backoffice disponible.
- Permitir cambiar de adaptador sin modificar componentes, páginas ni reglas de presentación.
- Centralizar serialización, deserialización, timeout, cancelación, encabezados y normalización de errores.
- Enviar credenciales con el mecanismo acordado por el backoffice. Preferir sesión mediante cookie `HttpOnly`, `Secure` y `SameSite`; el frontend no debe persistir secretos ni contraseñas.
- No registrar contraseñas, tokens, documentos ni otros datos personales en consola, telemetría o fixtures públicos.

El adaptador mock representa respuestas del backoffice; no implementa una segunda fuente de verdad ni contiene RNG, liquidación, cálculo de premios o contabilidad.

### Autenticación frontend

- Crear o completar las pantallas de inicio de sesión y registro de usuario.
- Conectar login, registro, consulta de sesión y cierre de sesión mediante `AuthGateway`.
- Incorporar validación de formulario para experiencia de usuario, sin tratarla como validación de seguridad.
- Representar claramente los estados inicial, enviando, éxito, credenciales rechazadas, conflicto de usuario, rate limit, indisponibilidad y error inesperado.
- Evitar doble envío y restaurar el formulario de forma segura después de un error recuperable.
- Aplicar la sesión recibida del backoffice a navegación, rutas protegidas y acciones que requieren autenticación.
- Mantener accesibilidad: etiquetas, mensajes asociados a campos, foco en errores, navegación por teclado y anuncios para lectores de pantalla.

### Integración de la experiencia existente

- Hacer que catálogo, saldo, jugadas, resultados y comprobantes consuman únicamente el gateway tipado.
- Mantener las 6 quinielas tradicionales y exactamente 9 Instantáneas de la Fase 1 en la experiencia visual.
- Animar los rodillos solamente después de recibir del conector el resultado autoritativo. El frontend no genera ni corrige números.
- Mostrar estados `loading`, `empty`, `error`, `unauthorized` y `success` en cada vista que dependa del backoffice.
- Ofrecer reintento solo para operaciones seguras o cuando el contrato externo indique cómo evitar duplicados.
- Conservar el diseño responsive, temas, sonido, accesibilidad y reducción de movimiento entregados en Fase 1.

## Fuera de alcance

- Backend local, rutas de negocio propias o servidor alternativo al backoffice.
- MySQL, Prisma, migraciones, seeds, ledger, auditoría o persistencia local de jugadas.
- RNG, reglas de premio, payouts, jackpots, liquidación, validación autoritativa o administración de saldo.
- Implementación de seguridad, roles o permisos del backoffice; el frontend solo refleja las capacidades declaradas por la sesión.
- Panel administrativo/backoffice.
- Integración con Kodexa.
- Despliegue, infraestructura o publicación productiva.

## Definition of Done

- Existe un contrato TypeScript documentado para todas las respuestas consumidas por la UI y no se usa `any` en la frontera del backoffice.
- `AuthGateway`, `GamingGateway` y el gateway compuesto pueden sustituirse mediante configuración o inyección.
- El adaptador HTTP toma su URL base desde configuración, maneja timeout/cancelación y normaliza errores.
- El adaptador mock usa fixtures deterministas, reproduce éxito y fallos previstos y no contiene lógica de negocio.
- Inicio de sesión, registro, consulta de sesión y cierre de sesión funcionan contra ambos adaptadores.
- Los formularios bloquean doble envío, preservan datos no sensibles cuando corresponde y muestran errores accesibles.
- Las vistas conectadas cubren `loading`, `empty`, `error`, `unauthorized` y `success`, sin quedar bloqueadas ante una respuesta fallida.
- Saldo, jugadas, resultados, comprobantes y números de rodillos provienen exclusivamente del gateway.
- Ningún componente genera resultados, calcula premios, modifica saldos o persiste credenciales.
- No existen secretos, contraseñas, tokens ni datos personales reales en el repositorio, logs o fixtures.
- Hay pruebas unitarias de mapeo y normalización, pruebas de contrato para ambos adaptadores y pruebas de componentes para login, registro y estados de red.
- Los E2E verifican login, registro, sesión expirada, error de red y al menos un recorrido de juego con respuesta fixture del gateway.
- Lint, typecheck, pruebas y build quedan verdes, sin regresiones visuales ni de accesibilidad en la Fase 1.
- Kodexa y despliegue permanecen sin implementar.
